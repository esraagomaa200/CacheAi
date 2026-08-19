"""Egyptian Arabic TTS via Gemini **Live API** — ported from Rex (ear/liveTts.js).

Why Live API and not a TTS model:
- gemini-*-tts models: ~15 requests/day on free tier — useless.
- Live API: unlimited requests (limit is tokens/minute), returns raw
  PCM 24kHz mono 16-bit. Measured and proven in the Rex Discord bot.

The model is conversational by nature — without a strict system
instruction it answers the text instead of reading it. The instruction
below pins it to verbatim Egyptian delivery.

Any failure (network/quota/timeout) returns None — callers degrade
gracefully (frontend falls back to silent text).
"""

import asyncio
import io
import os
import struct

from ai import rag  # reuses env loading + GEMINI_API_KEY handling

LIVE_TTS_MODEL = os.getenv("LIVE_TTS_MODEL", "models/gemini-3.1-flash-live-preview")
# The voice MUST be pinned explicitly — without it the model picks a random
# voice per session. Iapetus is the voice Rex ships with.
LIVE_TTS_VOICE = os.getenv("LIVE_TTS_VOICE", "Iapetus")
TIMEOUT_SECONDS = 14

SYSTEM = """انت محرك نطق (TTS) مصري — مش محاور.

مهمتك الوحيدة: **اقرا نص المستخدم بالحرف** بصوتك، بلهجة **مصرية عامية** طبيعية.

قواعد صارمة:
- اقرا نفس الكلمات بالظبط. متزوّدش ولا كلمة، متشيلش ولا كلمة، متعلّقش، متردّش.
- متسألش أسئلة ومتقولش «أهلًا» أو أي حاجة من عندك.
- النطق مصري: الجيم G (جامد = gaamed)، القاف همزة (قوي = أَوي).
- نبرة ودودة وطبيعية زي شاب مصري بيتكلم مع صحابه."""


def _pcm_to_wav(pcm: bytes, sample_rate: int = 24000) -> bytes:
    """Wrap raw PCM 16-bit mono in a minimal WAV container."""
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE"
    header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, sample_rate,
                                    sample_rate * 2, 2, 16)
    header += b"data" + struct.pack("<I", len(pcm))
    return header + pcm


async def _synthesize_async(text: str, voice: str | None = None) -> bytes | None:
    from google.genai import types

    client = rag.get_genai_client()
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice or LIVE_TTS_VOICE
                )
            )
        ),
        system_instruction=types.Content(parts=[types.Part(text=SYSTEM)]),
    )

    chunks: list[bytes] = []
    async with client.aio.live.connect(model=LIVE_TTS_MODEL, config=config) as session:
        await session.send_client_content(
            turns=types.Content(role="user", parts=[types.Part(text=text)]),
            turn_complete=True,
        )
        async for message in session.receive():
            if message.data:
                chunks.append(message.data)
            server_content = getattr(message, "server_content", None)
            if server_content and (
                getattr(server_content, "turn_complete", False)
                or getattr(server_content, "generation_complete", False)
            ):
                break

    if not chunks:
        return None
    return _pcm_to_wav(b"".join(chunks))


def synthesize(text: str, voice: str | None = None) -> bytes | None:
    """Blocking wrapper: returns WAV bytes or None. Never raises.

    `voice` overrides the prebuilt voice for this call only; None keeps the
    LIVE_TTS_VOICE env/default behaviour.

    Safe to call from FastAPI sync routes (they run in a worker thread, so
    asyncio.run gets a fresh event loop).
    """
    say = (text or "").strip()
    if not say or os.getenv("LIVE_TTS_ENABLED", "1") == "0":
        return None
    try:
        return asyncio.run(
            asyncio.wait_for(_synthesize_async(say, voice), timeout=TIMEOUT_SECONDS)
        )
    except Exception:
        return None
