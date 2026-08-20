"""Contract tests: no medical reply ships without a visible trusted source.

Pure unit tests — no network, no DB. They pin the behaviors that broke when
the triage engine moved from Gemini (schema-enforced citations) to Groq
(json_object, citations optional): every engine reply that had sources
attached MUST cite at least one, or the router must reject it and move on.
"""

import json

import pytest

from ai import agent, rag


CHUNKS = [
    {"title": "علامات الأزمة القلبية التحذيرية", "org": "American Heart Association",
     "url": "https://aha.example/warning-signs", "condition": "chest_heart",
     "text": "ألم الصدر مع عرق بارد وضيق نفس من العلامات التحذيرية"},
    {"title": "أعراض السكتة الدماغية", "org": "WHO",
     "url": "https://who.example/stroke", "condition": "stroke",
     "text": "تنميل مفاجئ في نص الجسم وصعوبة الكلام"},
]


def _raw(answer="اتصل بالإسعاف 123 فورًا", used_sources=None, risk="high", condition="chest_heart"):
    return json.dumps({
        "answer": answer,
        "used_sources": used_sources if used_sources is not None else [],
        "risk_level": risk,
        "condition": condition,
    }, ensure_ascii=False)


# --------------------------------------------------------------------------
# _parse_triage_json — the citation gate
# --------------------------------------------------------------------------

def test_uncited_answer_with_chunks_is_rejected():
    with pytest.raises(ValueError):
        agent._parse_triage_json(_raw(used_sources=[]), CHUNKS)


def test_out_of_range_citations_with_chunks_are_rejected():
    with pytest.raises(ValueError):
        agent._parse_triage_json(_raw(used_sources=[0, 99, "x"]), CHUNKS)


def test_valid_citation_maps_to_source_chips():
    result = agent._parse_triage_json(_raw(used_sources=[1]), CHUNKS)
    assert result["sources"] == [{
        "title": "علامات الأزمة القلبية التحذيرية",
        "org": "American Heart Association",
        "url": "https://aha.example/warning-signs",
    }]


def test_no_chunks_allows_empty_citations():
    result = agent._parse_triage_json(_raw(used_sources=[]), [])
    assert result["sources"] == []
    assert result["content"]


# --------------------------------------------------------------------------
# Groq strict response_format — structural enforcement
# --------------------------------------------------------------------------

def test_strict_schema_requires_a_citation_when_chunks_attached():
    fmt = agent._groq_response_format("openai/gpt-oss-120b", num_chunks=4)
    assert fmt["type"] == "json_schema"
    assert fmt["json_schema"]["strict"] is True
    used = fmt["json_schema"]["schema"]["properties"]["used_sources"]
    assert used["minItems"] == 1
    assert used["items"]["maximum"] == 4


def test_strict_schema_forbids_citations_without_chunks():
    fmt = agent._groq_response_format("openai/gpt-oss-20b", num_chunks=0)
    used = fmt["json_schema"]["schema"]["properties"]["used_sources"]
    assert used["maxItems"] == 0


def test_non_strict_models_fall_back_to_json_object():
    assert agent._groq_response_format("qwen/qwen3.6-27b", num_chunks=4) == {
        "type": "json_object"
    }


# --------------------------------------------------------------------------
# Clinical tier — NAJDA must bring real sources, not just grounded=True
# --------------------------------------------------------------------------

def test_najda_grounded_without_sources_falls_through(monkeypatch):
    monkeypatch.setattr(agent, "_call_najda", lambda q: {
        "answer": "إجابة إكلينيكية", "grounded": True, "sources": [],
    })
    monkeypatch.setattr(agent, "_risk_assessment", lambda *a: {
        "risk_level": "moderate", "condition": "chest_heart",
    })
    assert agent._clinical_answer("العلاج إيه؟", [], "normal") is None


def test_najda_with_sources_is_accepted(monkeypatch):
    monkeypatch.setattr(agent, "_call_najda", lambda q: {
        "answer": "إجابة إكلينيكية", "grounded": True,
        "sources": [{"source_file": "AHA_STEMI_Cleaned_v2.json", "page_start": 12}],
    })
    monkeypatch.setattr(agent, "_risk_assessment", lambda *a: {
        "risk_level": "moderate", "condition": "chest_heart",
    })
    result = agent._clinical_answer("العلاج إيه؟", [], "normal")
    assert result is not None
    assert result["sources"][0]["title"].startswith("AHA STEMI")


# --------------------------------------------------------------------------
# Contextual retrieval — follow-ups keep the symptom context
# --------------------------------------------------------------------------

def test_retrieval_query_includes_recent_user_turns():
    history = [
        {"sender": "user", "content": "عندي ألم في الصدر"},
        {"sender": "assistant", "content": "من إمتى؟"},
        {"sender": "user", "content": "من امبارح"},
    ]
    query = agent._retrieval_query(history, "من امبارح")
    assert "ألم في الصدر" in query
    assert "من امبارح" in query
    assert "من إمتى" not in query  # assistant turns stay out


def test_retrieval_query_without_history_is_the_current_turn():
    assert agent._retrieval_query([], "عندي صداع") == "عندي صداع"


# --------------------------------------------------------------------------
# rag.search — embedding outage degrades to keyword search, not to nothing
# --------------------------------------------------------------------------

class _FakeQdrant:
    def __init__(self, payloads):
        self._payloads = payloads

    def collection_exists(self, name):
        return True

    def query_points(self, **kwargs):
        raise RuntimeError("vector path must not be reached in this test")

    def scroll(self, collection_name, limit, with_payload):
        class Point:
            def __init__(self, payload):
                self.payload = payload
        return [Point(p) for p in self._payloads], None


def test_search_falls_back_to_keywords_when_embedding_dies(monkeypatch):
    payloads = [
        {"title": "علامات الأزمة القلبية التحذيرية", "org": "AHA", "url": "u1",
         "condition": "chest_heart", "text": "ألم الصدر وضيق النفس والعرق البارد"},
        {"title": "أعراض الربو", "org": "NHS", "url": "u2",
         "condition": "breathing", "text": "كحة وصفير في النفس"},
    ]
    monkeypatch.setattr(rag, "get_qdrant_client", lambda: _FakeQdrant(payloads))
    monkeypatch.setattr(rag, "embed_query", lambda q: (_ for _ in ()).throw(
        RuntimeError("429 quota exhausted")
    ))

    chunks = rag.search("عندي ألم الصدر وضيق النفس", k=2)
    assert chunks, "keyword fallback must return results, not an empty list"
    assert chunks[0]["title"] == "علامات الأزمة القلبية التحذيرية"
