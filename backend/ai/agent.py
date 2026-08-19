"""Single-call Gemini triage agent.

answer() is the only entry point routers should call. It never raises: any
Gemini/RAG failure is caught and turned into a safe Arabic fallback answer,
per contract, so a chat request can never 500 because of the AI layer.
"""

import json
import re

from ai import prompts, rag

GEMINI_MODEL = "gemini-2.5-flash"

RISK_LEVELS = {"low", "moderate", "high", "emergency"}
CONDITIONS = {"stroke", "chest_heart", "breathing", "unknown"}

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "answer": {"type": "STRING"},
        "used_sources": {"type": "ARRAY", "items": {"type": "INTEGER"}},
        "risk_level": {"type": "STRING", "enum": sorted(RISK_LEVELS)},
        "condition": {"type": "STRING", "enum": sorted(CONDITIONS)},
    },
    "required": ["answer", "used_sources", "risk_level", "condition"],
}

# Heuristic greeting-only detector — used purely to skip a wasted retrieval
# call for pure small talk ("hi", "ازيك"), never to skip the safety rules.
_GREETING_WORDS = {
    "سلام", "السلام", "عليكم", "وعليكم", "ازيك", "ازيكم", "عامل", "عاملة",
    "اخبارك", "اهلا", "أهلا", "هاي", "هلا", "صباح", "مساء", "الخير", "النور",
    "hi", "hii", "hiii", "hello", "hey", "yo", "hola", "morning", "evening",
}


def _is_smalltalk(text: str) -> bool:
    normalized = re.sub(r"[^\w\s]", " ", text or "", flags=re.UNICODE).strip().lower()
    if not normalized:
        return False
    words = normalized.split()
    if not words or len(words) > 4:
        return False
    return all(word in _GREETING_WORDS for word in words)


def _build_contents(history: list[dict], user_content: str) -> str:
    lines = []
    for msg in history or []:
        speaker = "المستخدم" if msg.get("sender") == "user" else "المساعد"
        content = (msg.get("content") or "").strip()
        if content:
            lines.append(f"{speaker}: {content}")
    if lines:
        return "\n".join(lines)
    # No stored history (e.g. called outside the normal chat flow) — fall
    # back to just the current turn.
    return f"المستخدم: {user_content}"


def _call_gemini(system_prompt: str, contents: str) -> str:
    from google.genai import types

    client = rag.get_genai_client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=RESPONSE_SCHEMA,
        ),
    )
    return response.text


def _map_sources(used_sources, chunks: list[dict]) -> list[dict]:
    mapped: list[dict] = []
    seen_titles: set[str] = set()
    for raw_idx in used_sources or []:
        try:
            idx = int(raw_idx)
        except (TypeError, ValueError):
            continue
        if not (1 <= idx <= len(chunks)):
            continue
        chunk = chunks[idx - 1]
        title = chunk.get("title", "")
        if title in seen_titles:
            continue
        seen_titles.add(title)
        mapped.append(
            {
                "title": title,
                "org": chunk.get("org", ""),
                "url": chunk.get("url", ""),
            }
        )
    return mapped


def _fallback() -> dict:
    return {
        "content": prompts.FALLBACK_ANSWER,
        "sources": [],
        "risk_level": "moderate",
        "condition": "unknown",
    }


def answer(user_content: str, history: list[dict], profile_ctx: dict | None, chat_type: str) -> dict:
    """Return {"content", "sources", "risk_level", "condition"} for one turn.

    - rag.search() is skipped for pure small talk.
    - A single gemini-2.5-flash call returns strict JSON (enforced via
      response_mime_type + response_schema).
    - On ANY exception (network, auth, malformed JSON, ...) this returns the
      safe fallback dict instead of raising — callers can rely on this never
      throwing.
    """
    try:
        chunks = [] if _is_smalltalk(user_content) else rag.search(user_content, k=4)
        system_prompt = prompts.build_system_prompt(profile_ctx, chunks, chat_type)
        contents = _build_contents(history, user_content)

        raw = _call_gemini(system_prompt, contents)
        parsed = json.loads(raw)

        answer_text = str(parsed.get("answer") or "").strip()
        if not answer_text:
            raise ValueError("Gemini returned an empty answer")

        risk_level = parsed.get("risk_level")
        if risk_level not in RISK_LEVELS:
            risk_level = "moderate"

        condition = parsed.get("condition")
        if condition not in CONDITIONS:
            condition = "unknown"

        sources = _map_sources(parsed.get("used_sources"), chunks)

        return {
            "content": answer_text,
            "sources": sources,
            "risk_level": risk_level,
            "condition": condition,
        }
    except Exception:
        return _fallback()
