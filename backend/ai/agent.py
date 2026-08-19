"""Difficulty-based model router for the medical triage agent.

answer() is the only entry point routers should call. It never raises: any
Gemini/Groq/NAJDA/RAG failure is caught and turned into a safe Arabic
fallback answer, per contract, so a chat request can never 500 because of
the AI layer.

Three tiers, routed by the zero-latency heuristic _route():
  1. "smalltalk" — pure greetings, handled by a tiny Groq call.
  2. "clinical"  — knowledge/treatment questions, handled by the NAJDA RAG
                    engine (http://127.0.0.1:8001 by default) running in
                    parallel with a small Groq risk-classification call.
  3. "triage"    — the default: single-call Gemini flow, with an automatic
                    Groq fallback (same prompt) if Gemini raises for any
                    reason (429 quota exhaustion, network, bad JSON, ...).
Any tier that fails (engine down, bad response, unexpected exception) falls
through to "triage" rather than surfacing an error to the user, and triage
itself falls through Gemini -> Groq -> static fallback text before ever
raising.
"""

import concurrent.futures
import json
import os
import re
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

from ai import prompts, rag

# backend/ — main.py/database.py already load backend/.env at app startup,
# but this module can also be imported standalone (tests, scripts), and the
# Groq/Qdrant keys live in the PROJECT ROOT .env, not backend/.env. Load
# both here; load_dotenv() defaults to override=False so neither call can
# clobber a var the process already has set.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

# gemini-2.5-flash 404s for newly-created API keys (Google migrated new users
# to gemini-3.6-flash) — keep the model overridable via env.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
# llama-3.1-8b-instant is not served for this Groq key (checked via
# models.list) — gpt-oss-20b is the fastest available chat model.
GROQ_SMALLTALK_MODEL = os.getenv("GROQ_SMALLTALK_MODEL", "openai/gpt-oss-20b")
# Risk classifier moved off Gemini entirely (free-tier quota is tiny and
# this call fires on every "clinical" tier message) — gpt-oss-20b is fast
# and cheap, plenty for a two-field classification.
GROQ_CLASSIFIER_MODEL = os.getenv("GROQ_CLASSIFIER_MODEL", "openai/gpt-oss-20b")
# Triage fallback when Gemini raises (429 quota exhaustion, network, bad
# JSON, ...) — gpt-oss-120b is the larger model since this one has to write
# the actual user-facing answer, not just classify.
GROQ_TRIAGE_MODEL = os.getenv("GROQ_TRIAGE_MODEL", "openai/gpt-oss-120b")
NAJDA_RAG_URL = os.getenv("NAJDA_RAG_URL", "http://127.0.0.1:8001")

RISK_LEVELS = {"low", "moderate", "high", "emergency"}
CONDITIONS = {"stroke", "chest_heart", "breathing", "unknown"}

# How many trailing history turns to feed the risk-only classifier — it only
# needs recent context, not the full conversation.
RISK_HISTORY_TURNS = 6

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

# Heuristic keywords routing a question to the "clinical" tier (NAJDA RAG +
# risk classifier) instead of the default single-call triage flow. Case is
# normalized before matching, so mixed-case English terms still match.
_CLINICAL_KEYWORDS = [
    "علاج", "العلاج", "جرعة", "جرعات", "دواء", "أدوية", "بروتوكول",
    "جايدلاين", "إرشادات", "تشخيص", "يتعالج", "إسعافات أولية",
    "first aid", "treatment", "dose", "dosage", "management", "guideline",
    "protocol", "drug", "medication", "therapy", "pci", "stemi",
    "thrombolysis", "cpr",
]

# Keyword fallback for risk classification when the Groq classifier call
# itself fails — deliberately conservative phrases for red-flag symptoms.
_HIGH_RISK_KEYWORDS = [
    "مش قادر أتنفس", "ألم في الصدر", "إغماء", "فقدان وعي", "تنميل مفاجئ",
]

# Trailing suffixes NAJDA appends to its cleaned corpus filenames — stripped
# when building a human-readable source title.
_NAJDA_TITLE_SUFFIXES = ("_Cleaned_v2", "_Cleaned")
_NAJDA_TITLE_MAX_LEN = 70

# requests.Session at module scope for connection reuse across calls to the
# NAJDA RAG engine.
_najda_session = requests.Session()


def _is_smalltalk(text: str) -> bool:
    normalized = re.sub(r"[^\w\s]", " ", text or "", flags=re.UNICODE).strip().lower()
    if not normalized:
        return False
    words = normalized.split()
    if not words or len(words) > 4:
        return False
    return all(word in _GREETING_WORDS for word in words)


def _route(user_content: str) -> str:
    """Zero-latency tier heuristic — no network calls, just string matching."""
    if _is_smalltalk(user_content):
        return "smalltalk"
    lowered = (user_content or "").lower()
    if any(keyword in lowered for keyword in _CLINICAL_KEYWORDS):
        return "clinical"
    return "triage"


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


def _get_groq_client():
    """Lazily build a groq.Groq client from GROQ_API_KEY.

    Reads the key only at call time via os.getenv, mirroring
    rag.get_genai_client()'s pattern. Shared by every Groq call site
    (smalltalk, risk classifier, triage fallback).
    """
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return Groq(api_key=api_key)


def _parse_triage_json(raw: str, chunks: list[dict]) -> dict:
    """Parse + validate a triage-shaped JSON response (Gemini or Groq).

    Raises if the JSON is malformed or the answer is empty — callers decide
    what to do next (try another engine, or give up to _fallback()).
    """
    parsed = json.loads(raw)

    answer_text = str(parsed.get("answer") or "").strip()
    if not answer_text:
        raise ValueError("engine returned an empty answer")

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


def _call_groq_triage(system_prompt: str, contents: str, model: str | None = None) -> str:
    """Groq triage call for a specific model (default: the big triage model).

    Groq's response_format=json_object only guarantees valid JSON, not a
    specific shape (unlike Gemini's response_schema), so the exact key
    contract is restated right before the user turn to maximize compliance.
    """
    client = _get_groq_client()
    completion = client.chat.completions.create(
        model=model or GROQ_TRIAGE_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt + "\n\n" + prompts.GROQ_TRIAGE_JSON_SUFFIX},
            {"role": "user", "content": contents},
        ],
    )
    return completion.choices[0].message.content or ""


def _triage_answer(
    user_content: str, history: list[dict], profile_ctx: dict | None, chat_type: str
) -> tuple[dict, str]:
    """Default tier 3: single-call triage flow.

    Groq is the PRIMARY engine: the Gemini free-tier quota proved too small
    for live traffic (persistent 429s measured tonight), and leading with a
    doomed Gemini call costs a wasted round-trip on every message. Gemini
    stays as the fallback for Groq bursts/outages.

    Returns (result_dict, engine) where engine is "groq", "gemini-fallback",
    or "fallback" (both engines failed — the static Arabic fallback text).
    This function itself never raises.
    """
    try:
        # Retrieval failing (query embedding needs the Gemini key — its quota
        # can die) must NOT kill the tier: degrade to no sources and let the
        # Groq/Gemini answer engines still respond.
        try:
            chunks = [] if _is_smalltalk(user_content) else rag.search(user_content, k=4)
        except Exception:
            chunks = []
        system_prompt = prompts.build_system_prompt(profile_ctx, chunks, chat_type)
        contents = _build_contents(history, user_content)

        # Groq token-per-day quotas are PER MODEL (measured live: 120b hit
        # its 200k TPD while 20b kept answering) — so try a chain of models,
        # each with its own separate daily budget.
        groq_chain = [GROQ_TRIAGE_MODEL, GROQ_SMALLTALK_MODEL, "qwen/qwen3.6-27b"]
        for groq_model in dict.fromkeys(groq_chain):
            try:
                raw = _call_groq_triage(system_prompt, contents, model=groq_model)
                return _parse_triage_json(raw, chunks), f"groq:{groq_model.split('/')[-1]}"
            except Exception as exc:
                # Never log user content — engine + error class/message only.
                print(f"[router] triage {groq_model} failed: {type(exc).__name__}: {str(exc)[:160]}")

        try:
            raw = _call_gemini(system_prompt, contents)
            return _parse_triage_json(raw, chunks), "gemini-fallback"
        except Exception as exc:
            print(f"[router] triage gemini failed: {type(exc).__name__}: {exc}")
            return _fallback(), "fallback"
    except Exception as exc:
        print(f"[router] triage setup failed: {type(exc).__name__}: {exc}")
        return _fallback(), "fallback"


# ---------------------------------------------------------------------------
# Tier 1 — smalltalk (Groq)
# ---------------------------------------------------------------------------

def _groq_smalltalk(user_content: str) -> dict:
    client = _get_groq_client()
    completion = client.chat.completions.create(
        model=GROQ_SMALLTALK_MODEL,
        max_tokens=150,
        messages=[
            {"role": "system", "content": prompts.SMALLTALK_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    )
    content = (completion.choices[0].message.content or "").strip()
    if not content:
        raise ValueError("Groq returned an empty smalltalk answer")

    return {"content": content, "sources": [], "risk_level": "low", "condition": "unknown"}


# ---------------------------------------------------------------------------
# Tier 2 — clinical (NAJDA RAG + Groq risk classifier, in parallel)
# ---------------------------------------------------------------------------

def _call_najda(user_content: str) -> dict | None:
    """POST to the NAJDA RAG engine. Returns None on any failure (engine
    down, non-200, unparseable body) — callers fall through to triage."""
    try:
        response = _najda_session.post(
            f"{NAJDA_RAG_URL.rstrip('/')}/chat",
            json={"question": user_content, "top_k": 3},
            timeout=(2, 30),
        )
    except Exception:
        return None
    if response.status_code != 200:
        return None
    try:
        return response.json()
    except Exception:
        return None


def _keyword_risk_fallback(user_content: str, chat_type: str) -> dict:
    text = user_content or ""
    if any(keyword in text for keyword in _HIGH_RISK_KEYWORDS):
        risk_level = "high"
    elif chat_type == "emergency":
        risk_level = "moderate"
    else:
        risk_level = "low"
    return {"risk_level": risk_level, "condition": "unknown"}


def _classify_risk(user_content: str, history: list[dict], chat_type: str) -> dict:
    """Risk-only classification for the clinical tier — on Groq, not Gemini,
    since this fires on every clinical-tier message and the Gemini free-tier
    quota is tiny. response_format=json_object only guarantees valid JSON
    (no schema enforcement like Gemini), so the system prompt spells out the
    exact {"risk_level", "condition"} shape."""
    client = _get_groq_client()
    system_prompt = prompts.build_risk_classifier_prompt(chat_type)
    recent_history = (history or [])[-RISK_HISTORY_TURNS:]
    contents = _build_contents(recent_history, user_content)

    completion = client.chat.completions.create(
        model=GROQ_CLASSIFIER_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": contents},
        ],
    )
    parsed = json.loads(completion.choices[0].message.content or "")

    risk_level = parsed.get("risk_level")
    if risk_level not in RISK_LEVELS:
        risk_level = "moderate"

    condition = parsed.get("condition")
    if condition not in CONDITIONS:
        condition = "unknown"

    return {"risk_level": risk_level, "condition": condition}


def _risk_assessment(user_content: str, history: list[dict], chat_type: str) -> dict:
    try:
        return _classify_risk(user_content, history, chat_type)
    except Exception:
        return _keyword_risk_fallback(user_content, chat_type)


def _clean_najda_title(source_file: str) -> str:
    name = (source_file or "").strip()
    if name.lower().endswith(".json"):
        name = name[: -len(".json")]
    for suffix in _NAJDA_TITLE_SUFFIXES:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    name = name.replace("-", " ").replace("_", " ").strip()
    if len(name) > _NAJDA_TITLE_MAX_LEN:
        name = name[:_NAJDA_TITLE_MAX_LEN].rstrip()
    return name


def _map_najda_sources(raw_sources) -> list[dict]:
    mapped: list[dict] = []
    for src in raw_sources or []:
        if not isinstance(src, dict):
            continue
        title = _clean_najda_title(src.get("source_file", ""))
        page_start = src.get("page_start")
        if page_start is not None:
            title = f"{title} (p.{page_start})"
        mapped.append({"title": title, "org": "Clinical Guideline", "url": ""})
    return mapped


def _clinical_answer(user_content: str, history: list[dict], chat_type: str) -> dict | None:
    """NAJDA RAG call + Gemini risk classification, run in parallel.

    Returns None (never raises) if NAJDA is down, returns non-200, or
    responds with grounded=False — callers fall through to the triage tier
    instead of surfacing NAJDA's refusal text to the user.
    """
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            najda_future = executor.submit(_call_najda, user_content)
            risk_future = executor.submit(_risk_assessment, user_content, history, chat_type)
            najda_result = najda_future.result()
            risk = risk_future.result()

        if not najda_result or not najda_result.get("grounded"):
            return None

        content = str(najda_result.get("answer") or "").strip()
        if not content:
            return None

        return {
            "content": content,
            "sources": _map_najda_sources(najda_result.get("sources")),
            "risk_level": risk["risk_level"],
            "condition": risk["condition"],
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Router entry point
# ---------------------------------------------------------------------------

def _route_and_answer(
    user_content: str, history: list[dict], profile_ctx: dict | None, chat_type: str
) -> tuple[dict, str, str]:
    """Returns (result, tier, engine) for logging purposes.

    engine is one of: "groq" (smalltalk), "najda" (clinical, grounded),
    "gemini" / "groq-fallback" / "fallback" (triage, see _triage_answer).
    """
    tier = _route(user_content)

    if tier == "smalltalk":
        try:
            return _groq_smalltalk(user_content), "smalltalk", "groq"
        except Exception:
            pass  # fall through to triage below
        result, engine = _triage_answer(user_content, history, profile_ctx, chat_type)
        return result, "triage", engine

    if tier == "clinical":
        clinical = _clinical_answer(user_content, history, chat_type)
        if clinical is not None:
            return clinical, "clinical", "najda"
        result, engine = _triage_answer(user_content, history, profile_ctx, chat_type)
        return result, "triage", engine

    result, engine = _triage_answer(user_content, history, profile_ctx, chat_type)
    return result, "triage", engine


def answer(user_content: str, history: list[dict], profile_ctx: dict | None, chat_type: str) -> dict:
    """Return {"content", "sources", "risk_level", "condition"} for one turn.

    Routes to one of three tiers (smalltalk / clinical / triage) via the
    zero-latency _route() heuristic. Every tier degrades gracefully to the
    next on failure, and this function itself never raises: any unexpected
    exception anywhere returns the safe Arabic fallback dict instead.
    """
    start = time.monotonic()
    tier = "triage"
    engine = "fallback"
    try:
        result, tier, engine = _route_and_answer(user_content, history, profile_ctx, chat_type)
        return result
    except Exception:
        tier = "triage"
        engine = "fallback"
        return _fallback()
    finally:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        print(f"[router] tier={tier} engine={engine} ms={elapsed_ms}")
