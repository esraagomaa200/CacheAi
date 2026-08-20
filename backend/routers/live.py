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
from models import ChatSession, Message, User
from routers.chat import TITLE_PREVIEW_LENGTH, _is_untitled
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
WS_SESSION_NOT_FOUND = 4404
WS_INTERNAL_ERROR = 4500


class TranscriptRecorder:
    """Persists what was said during a call as regular chat Messages.

    Deltas accumulate in memory; a flush happens on each turn boundary
    (turn_complete / interrupted) and once more at call end. Every flush
    opens a short-lived DB session in a worker thread — a Neon roundtrip
    on the event loop would stutter the audio relay.

    With session_id=None (no ?session= param, e.g. the legacy overlay)
    the recorder is a no-op and the call stays stateless as before.
    """

    def __init__(self, user_id: int, session_id: int | None):
        self.user_id = user_id
        self.session_id = session_id
        self._user_buf: list[str] = []
        self._assistant_buf: list[str] = []

    @property
    def enabled(self) -> bool:
        return self.session_id is not None

    def add_user(self, text: str) -> None:
        if self.enabled and text:
            self._user_buf.append(text)

    def add_assistant(self, text: str) -> None:
        if self.enabled and text:
            self._assistant_buf.append(text)

    async def flush(self) -> None:
        if not self.enabled:
            return
        user_text = "".join(self._user_buf).strip()
        assistant_text = "".join(self._assistant_buf).strip()
        self._user_buf.clear()
        self._assistant_buf.clear()
        if not user_text and not assistant_text:
            return
        await asyncio.to_thread(self._flush_sync, user_text, assistant_text)

    def _flush_sync(self, user_text: str, assistant_text: str) -> None:
        db = SessionLocal()
        try:
            if user_text:
                db.add(Message(
                    chat_session_id=self.session_id,
                    sender="user",
                    content=user_text,
                ))
                session = db.query(ChatSession).filter(
                    ChatSession.id == self.session_id
                ).first()
                if session is not None and _is_untitled(session.title):
                    session.title = user_text[:TITLE_PREVIEW_LENGTH]
            if assistant_text:
                db.add(Message(
                    chat_session_id=self.session_id,
                    sender="assistant",
                    content=assistant_text,
                ))
            db.commit()
        except Exception:
            # Persistence must never take the live call down with it.
            db.rollback()
        finally:
            db.close()


def _owned_session_id(user: User, raw: str | None) -> int | None | bool:
    """Resolve ?session= → int (valid), None (absent), False (invalid)."""
    if raw is None or raw == "":
        return None
    try:
        session_id = int(raw)
    except (TypeError, ValueError):
        return False
    db = SessionLocal()
    try:
        owned = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == user.id,
        ).first()
        return session_id if owned is not None else False
    finally:
        db.close()


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
        # Empty configs = "on, auto-detect language". ⚠️ Do NOT add
        # language_codes/adaptation_phrases here: the session accepts them at
        # setup but DIES on the first audio turn (measured live — reconnect
        # loop after every utterance). Language flapping is instead mitigated
        # upstream by the Silero gate (noise never reaches the recognizer).
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        # Default VAD waits too long after the user stops talking (felt as
        # "delay" in live testing) — detect end-of-speech aggressively and
        # start answering after ~0.5s of silence instead of ~1s.
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                # LOW start sensitivity: ambient noise kept hallucinating
                # phantom user turns (transcribed as random foreign phrases)
                # and the model answered them / repeated itself.
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_LOW,
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                silence_duration_ms=500,
            )
        ),
    )


CONTEXT_WRAPPER = (
    "[رسالة نظام — المكالمة اتقطعت واتوصلت تاني. ده اللي اتقال قبل الانقطاع، "
    "افتكره كله وكمّل من نفس النقطة: ممنوع تعيد سؤال اتسأل، وممنوع تبدأ من "
    "الأول. رد دلوقتي بجملة واحدة قصيرة بس تطمّن إنك لسه معاه (زي: أنا معاك، "
    "كمّل) ومتعيدش أي محتوى.]\n\n{summary}"
)


async def _pump_browser_to_gemini(ws: WebSocket, session) -> None:
    """Binary frames are raw PCM16 mono 16kHz mic chunks. Text frames:
    {"type":"end"} hangs up; {"type":"context","summary":...} restores the
    conversation after an auto-reconnect (Gemini Live sessions have hard
    time limits — without this the model forgets the whole call)."""
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
        if not isinstance(payload, dict):
            continue
        if payload.get("type") == "end":
            return
        if payload.get("type") == "context":
            summary = str(payload.get("summary") or "").strip()[:4000]
            if summary:
                await session.send_client_content(
                    turns=types.Content(
                        role="user",
                        parts=[types.Part(text=CONTEXT_WRAPPER.format(summary=summary))],
                    ),
                    turn_complete=True,
                )


async def _pump_gemini_to_browser(
    ws: WebSocket, session, recorder: TranscriptRecorder
) -> None:
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
        # playing over the fresh one. The cut-off partial reply is still a
        # thing the user heard — persist it before the next turn begins.
        if getattr(server_content, "interrupted", False):
            await ws.send_json({"type": "interrupted"})
            await recorder.flush()

        user_text = getattr(server_content, "input_transcription", None)
        if user_text is not None and user_text.text:
            recorder.add_user(user_text.text)
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
            recorder.add_assistant(model_text.text)
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
            await recorder.flush()


async def _run_call(ws: WebSocket, recorder: TranscriptRecorder) -> None:
    """Open the Gemini session and run both pumps until either one ends."""
    client = rag.get_genai_client()
    config = _build_config()

    async with client.aio.live.connect(
        model=LIVE_CHAT_MODEL, config=config
    ) as session:
        await ws.send_json({"type": "ready"})

        tasks = [
            asyncio.create_task(_pump_browser_to_gemini(ws, session)),
            asyncio.create_task(_pump_gemini_to_browser(ws, session, recorder)),
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
            # Whatever was mid-turn when the call ended still belongs to
            # the conversation history.
            await recorder.flush()

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

    # Optional ?session=<id>: ties the call to a chat session so the spoken
    # conversation persists as regular messages. Absent → stateless call.
    session_id = _owned_session_id(user, ws.query_params.get("session"))
    if session_id is False:
        await ws.close(code=WS_SESSION_NOT_FOUND, reason="Chat session not found")
        return
    recorder = TranscriptRecorder(user.id, session_id)

    try:
        await _run_call(ws, recorder)
    except WebSocketDisconnect:
        # User hung up / navigated away — nothing to clean up, nothing to
        # report.
        return
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        # Never let a live-call failure bubble into the app — but LOG it,
        # or reconnect loops are undiagnosable (never user content).
        print(f"[live] call failed: {type(exc).__name__}: {str(exc)[:300]}")
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
