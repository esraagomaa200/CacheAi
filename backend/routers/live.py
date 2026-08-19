"""Full-duplex live voice call with نجدة over a single WebSocket.

Shape of the thing:

    browser mic ──PCM16 16kHz──▶ /chat/live ──▶ Gemini Live session
    browser speakers ◀─PCM16 24kHz── /chat/live ◀── Gemini Live session

The endpoint is a pure relay with two independent pumps running
concurrently — that's what makes it *full duplex*: the user can start
talking while the model is still speaking, and Gemini's server-side VAD
raises `interrupted`, which we forward so the browser can dump its queued
audio (barge-in).

Deliberately stateless: no DB writes, no history persistence. A dropped
call leaves nothing behind. Auth is the one DB read (verifying the user
still exists), done once at connect time and then released.

Model/voice/transcription config mirrors ai/tts.py, which is the proven
working Live API pattern in this project.
"""

import asyncio
import json
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ai import rag  # reuses env loading + GEMINI_API_KEY handling
from ai.prompts import LIVE_CALL_SYSTEM_PROMPT
from database import SessionLocal
from models import User
from security import verify_token

router = APIRouter(prefix="/chat", tags=["Live"])

LIVE_CHAT_MODEL = os.getenv("LIVE_CHAT_MODEL", "gemini-3.1-flash-live-preview")
# Pinned explicitly — without it the Live API picks a random voice per
# session, so the same assistant would sound like a different person on
# every call. Iapetus is what ai/tts.py already ships with.
LIVE_TTS_VOICE = os.getenv("LIVE_TTS_VOICE", "Iapetus")

# Browser mic capture rate. Must match the AudioContext sampleRate on the
# frontend and the rate advertised in the Blob mime type below.
INPUT_SAMPLE_RATE = 16000

# WebSocket close codes (4000-4999 is the application-defined range).
WS_UNAUTHORIZED = 4401
WS_INTERNAL_ERROR = 4500


def _authenticate(token: str | None) -> User | None:
    """Same checks as dependencies.get_current_user, minus the Depends().

    A WebSocket handshake carries no Authorization header we can rely on
    from the browser API, so the JWT arrives as a query param instead.
    Returns the User on success, None on any failure — the caller turns
    that into a 4401 close.

    The DB session is opened and closed inside this function: a voice call
    can run for minutes and must not pin a pooled connection for its
    lifetime.
    """
    if not token:
        return None

    subject = verify_token(token)
    if subject is None:
        return None

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        return None

    db = SessionLocal()
    try:
        return db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()


def _build_config():
    """LiveConnectConfig for the call. Imports the SDK lazily so this
    module stays importable when google-genai isn't installed."""
    from google.genai import types

    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=LIVE_TTS_VOICE
                )
            )
        ),
        system_instruction=types.Content(
            parts=[types.Part(text=LIVE_CALL_SYSTEM_PROMPT)]
        ),
        # Empty configs = "on, auto-detect language". Without these the
        # session returns audio only and the on-screen transcript stays
        # blank.
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        # Default VAD waits too long after the user stops talking (felt as
        # "delay" in live testing) — detect end-of-speech aggressively and
        # start answering after ~0.5s of silence instead of ~1s.
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                silence_duration_ms=500,
            )
        ),
    )


async def _pump_browser_to_gemini(ws: WebSocket, session) -> None:
    """Binary frames are raw PCM16 mono 16kHz mic chunks; the only text
    frame we honour is {"type":"end"}, which hangs up."""
    from google.genai import types

    while True:
        message = await ws.receive()

        if message.get("type") == "websocket.disconnect":
            return

        chunk = message.get("bytes")
        if chunk:
            await session.send_realtime_input(
                audio=types.Blob(
                    data=chunk,
                    mime_type=f"audio/pcm;rate={INPUT_SAMPLE_RATE}",
                )
            )
            continue

        raw = message.get("text")
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except (ValueError, TypeError):
            continue
        if isinstance(payload, dict) and payload.get("type") == "end":
            return


async def _pump_gemini_to_browser(ws: WebSocket, session) -> None:
    """Relay model audio + transcripts + barge-in signals to the browser.

    Attribute names verified against the installed google-genai 2.18.1
    types (LiveServerContent.input_transcription / output_transcription /
    interrupted / turn_complete), not guessed.
    """
    async for message in session.receive():
        # PCM16 mono 24kHz. Straight through — the browser schedules it.
        if message.data:
            await ws.send_bytes(message.data)

        server_content = getattr(message, "server_content", None)
        if server_content is None:
            continue

        # Barge-in first: the browser must drop its queued audio before it
        # gets any newer audio, otherwise the interrupted reply keeps
        # playing over the fresh one.
        if getattr(server_content, "interrupted", False):
            await ws.send_json({"type": "interrupted"})

        user_text = getattr(server_content, "input_transcription", None)
        if user_text is not None and user_text.text:
            await ws.send_json(
                {
                    "type": "transcript",
                    "role": "user",
                    "text": user_text.text,
                    "final": bool(getattr(user_text, "finished", False)),
                }
            )

        model_text = getattr(server_content, "output_transcription", None)
        if model_text is not None and model_text.text:
            await ws.send_json(
                {
                    "type": "transcript",
                    "role": "assistant",
                    "text": model_text.text,
                    "final": bool(getattr(model_text, "finished", False)),
                }
            )

        # Transcriptions stream as deltas; this is the boundary the client
        # uses to seal a bubble instead of appending forever.
        if getattr(server_content, "turn_complete", False):
            await ws.send_json({"type": "turn_complete"})


async def _run_call(ws: WebSocket) -> None:
    """Open the Gemini session and run both pumps until either one ends."""
    client = rag.get_genai_client()
    config = _build_config()

    async with client.aio.live.connect(
        model=LIVE_CHAT_MODEL, config=config
    ) as session:
        await ws.send_json({"type": "ready"})

        tasks = [
            asyncio.create_task(_pump_browser_to_gemini(ws, session)),
            asyncio.create_task(_pump_gemini_to_browser(ws, session)),
        ]
        try:
            done, pending = await asyncio.wait(
                tasks, return_when=asyncio.FIRST_COMPLETED
            )
        finally:
            for task in tasks:
                task.cancel()
            # Await the cancellations so neither pump outlives the session
            # context manager and touches a closed socket.
            await asyncio.gather(*tasks, return_exceptions=True)

        # Surface a real failure (as opposed to a clean hang-up) to the
        # outer handler, which turns it into an error frame + close.
        for task in done:
            if not task.cancelled() and task.exception() is not None:
                raise task.exception()


@router.websocket("/live")
async def live_call(ws: WebSocket) -> None:
    """Full-duplex voice call: /chat/live?token=<JWT>.

    Accept-then-close is intentional: closing before accept makes the
    handshake fail with a bare HTTP 403 and the browser never sees our
    4401, so the UI can't tell "logged out" from "server down".
    """
    await ws.accept()

    user = _authenticate(ws.query_params.get("token"))
    if user is None:
        await ws.close(code=WS_UNAUTHORIZED, reason="Invalid or expired token")
        return

    try:
        await _run_call(ws)
    except WebSocketDisconnect:
        # User hung up / navigated away — nothing to clean up, nothing to
        # report.
        return
    except asyncio.CancelledError:
        raise
    except Exception:
        # Never let a live-call failure bubble into the app. The browser
        # gets a readable Arabic reason; the socket closes either way.
        try:
            await ws.send_json(
                {
                    "type": "error",
                    "message": "حصلت مشكلة في المكالمة، حاول تاني. "
                    "لو الأعراض شديدة اتصل بالإسعاف 123",
                }
            )
        except Exception:
            pass
        try:
            await ws.close(code=WS_INTERNAL_ERROR)
        except Exception:
            pass
        return

    try:
        await ws.close()
    except Exception:
        pass
