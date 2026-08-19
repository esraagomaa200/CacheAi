"""
LAYER 2b — RETRIEVAL
Dense / BM25 / Hybrid-RRF / Reranker retrieval for the medical knowledge base.
"""
import json
import os
import pickle
import re
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder, SentenceTransformer

from build_index import COLLECTION_NAME, MODEL_NAME

load_dotenv()

QDRANT_URL = os.environ["QDRANT_URL"]
QDRANT_API_KEY = os.environ["QDRANT_API_KEY"]
RERANKER_MODEL_NAME = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
RRF_K = 60
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_NORMALIZER_ENABLED = os.getenv("GEMINI_NORMALIZER_ENABLED", "true").lower() in {
    "1", "true", "yes", "on"
}
GEMINI_NORMALIZER_INSTRUCTION = """You are a query-normalization component for a medical RAG system.
Do not answer the medical question and do not provide treatment, diagnosis, dosage, or emergency advice.
Convert the Arabic or Egyptian Arabic user question into a retrieval query for an English medical knowledge base.
Return valid JSON only with exactly these fields: language, normalized_question, retrieval_query, topic, in_scope, matched_terms, confidence.
Supported topics are only STEMI/acute coronary syndrome, chest pain/cardiac symptoms, oxygen administration/oxygen saturation, stroke/TIA, respiratory infection/cough/fever/dyspnea/pneumonia, and ICU admission/discharge/triage/critical care.
If the question is outside those topics, set in_scope=false, topic=unknown, and retrieval_query="".
Preserve medical abbreviations such as STEMI, PCI, ECG, ICU, P2Y12, and FMC exactly.
Never invent a medical topic merely because the question contains generic words such as treatment, pain, or patient."""
GEMINI_NORMALIZER_SCHEMA = {
    "type": "object",
    "properties": {
        "language": {"type": "string"},
        "normalized_question": {"type": "string"},
        "retrieval_query": {"type": "string"},
        "topic": {"type": "string"},
        "in_scope": {"type": "boolean"},
        "matched_terms": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "number"},
    },
    "required": [
        "language", "normalized_question", "retrieval_query", "topic",
        "in_scope", "matched_terms", "confidence",
    ],
}
SUPPORTED_TOPIC_ANCHORS = {
    "stroke", "myocardial", "coronary", "stemi", "pci", "ecg", "p2y12",
    "oxygen", "respiratory", "chest", "cardiac", "palpitations", "intensive",
            "icu", "critical", "triage", "pneumonia", "dyspnea", "cough", "fever", "sputum",

    "weakness", "paralysis", "facial", "slurred", "speech", "numbness",
    "angina", "heart", "shortness", "ischaemic", "ischemic", "acute",
}

# The knowledge base is currently English-only. These expansions are used only
# for retrieval; the original user question is preserved for generation.
ARABIC_QUERY_TERMS = {
    "اداره": "management",
    "الاداره": "management",
    "اداره اوليه": "initial management",
    "الاداره الاوليه": "initial management",
    "اوليه": "initial",
    "الاوليه": "initial",
    "تدبير": "management",
    "التدبير": "management",
    "تقييم": "evaluation",
    "التقييم": "evaluation",
    "فحص": "evaluation assessment",
    "المؤشرات": "indications",
    "مؤشرات": "indications",
    "المعايير": "criteria",
    "معايير": "criteria",
    "حدود": "thresholds",
    "الحدود": "thresholds",
    "عتبة": "threshold",
    "مستوى": "level",
    "مراقبة": "monitoring",
    "مريض": "patient",
    "المريض": "patient",
    "مرضى": "patients",
    "المرضى": "patients",
    "سكتة دماغية": "stroke",
    "السكتة الدماغية": "stroke",
    "للسكتة الدماغية": "stroke",
    "جلطة دماغية": "stroke",
    "الجلطة الدماغية": "stroke",
    "للجلطة الدماغية": "stroke",
    "سكتة": "stroke",
    "سكته": "stroke",
    "جلطة": "stroke",
    "جلطه": "stroke",
    "جلطة في المخ": "stroke",
    "جلطه في المخ": "stroke",
    "جلطة بالمخ": "stroke",
    "ضعف ناحية": "stroke weakness",
    "نص جسمي مش بيتحرك": "stroke weakness paralysis",
    "وشي مايل": "stroke facial droop",
    "وشي مائل": "stroke facial droop",
    "كلامي متلخبط": "stroke slurred speech",
    "مش عارف اتكلم": "stroke speech difficulty",
    "تنميل في ناحية": "stroke numbness",
    "رجلي مش حاسس بيها": "stroke numbness weakness",
    "رجلي مش حاسس فيها": "stroke numbness weakness",
    "رجلي بتنمل": "stroke numbness",
    "رجلي اتنملت": "stroke numbness",
    "ايدي ورجلي": "stroke numbness weakness",
    "إيدي ورجلي": "stroke numbness weakness",
    "كلامي تقيل": "stroke slurred speech",
    "لساني تقيل": "stroke slurred speech",
    "كلامي مش واضح": "stroke slurred speech",
    "بتكلم بصعوبة": "stroke speech difficulty",
    "مش عارف انطق": "stroke speech difficulty",
    "احتشاء عضلة القلب": "myocardial infarction",
    "متلازمة الشريان التاجي الحادة": "acute coronary syndrome",
    "متلازمات الشريان التاجي الحادة": "acute coronary syndromes",
    "المتلازمة التاجية الحادة": "acute coronary syndrome",
    "المتلازمات التاجية الحادة": "acute coronary syndromes",
    "ازمة قلبية": "heart attack myocardial infarction",
    "أزمة قلبية": "heart attack myocardial infarction",
    "جلطة قلبية": "heart attack myocardial infarction",
    "جلطه قلبيه": "heart attack myocardial infarction",
    "ذبحة صدرية": "angina chest pain",
    "ذبحه صدريه": "angina chest pain",
    "وجع القلب": "cardiac chest pain",
    "القلب": "cardiac coronary",
    "قلب": "cardiac coronary",
    "وحدة العناية المركزة": "intensive care unit ICU",
    "العناية المركزة": "intensive care unit ICU",
    "العناية": "critical care",
    "الرعاية المركزة": "intensive care unit ICU",
    "الرعايه المركزه": "intensive care unit ICU",
    "العنايه المركزه": "intensive care unit ICU",
    "العناية الحرجة": "critical care ICU",
    "العنايه الحرجه": "critical care ICU",
    "دخول العناية": "ICU admission",
    "دخول العنايه": "ICU admission",
    "ادخل العناية": "ICU admission",
    "يدخل العناية": "ICU admission",
    "خروج من العناية": "ICU discharge",
    "ترياج": "triage",
    "فرز الحالات": "triage",
    "الحالة تدخل العناية": "ICU admission",
    "الحاله تدخل العنايه": "ICU admission",
    "متى تدخل الحالة": "ICU admission",
    "امتى الحالة تدخل": "ICU admission",
    "المريض يدخل العناية": "ICU admission",
    "المريض محتاج عناية": "ICU admission",
    "امتى ندخل العناية": "ICU admission",
    "ادخال المريض": "patient admission",
    "إدخال المريض": "patient admission",
    "ألم الصدر": "chest pain",
    "الم الصدر": "chest pain",
    "وجع في الصدر": "chest pain",
    "وجع صدر": "chest pain",
    "صدري بيوجعني": "chest pain",
    "قلبي بيوجعني": "chest pain acute coronary syndrome",
    "وجع في قلبي": "chest pain acute coronary syndrome",
    "حاسس ان قلبي هيقف": "chest pain acute coronary syndrome",
    "حاسس ان قلبي هيوقف": "chest pain acute coronary syndrome",
    "قلبي بيقف": "chest pain acute coronary syndrome",
    "الم في صدري": "chest pain",
    "ألم في صدري": "chest pain",
    "وجع في صدري": "chest pain",
    "صدري وجعني": "chest pain",
    "وجع صدري": "chest pain",
    "الم في الصدر": "chest pain",
    "ألم في الصدر": "chest pain",
    "ضيق في الصدر": "chest pain",
    "ضيق صدري": "chest pain",
    "كتمة في الصدر": "chest pain shortness of breath",
    "كتمه في الصدر": "chest pain shortness of breath",
    "الم في قلبي": "cardiac chest pain",
    "ألم في قلبي": "cardiac chest pain",
    "حسيت قلبي هيقف": "chest pain acute coronary syndrome",
    "حسيت قلبي هيوقف": "chest pain acute coronary syndrome",
    "حاسس قلبي هيقف": "chest pain acute coronary syndrome",
    "حاسس قلبي هيوقف": "chest pain acute coronary syndrome",
    "خفقان": "palpitations cardiac",
    "نهجان": "dyspnea respiratory",
    "نفسى ضيق": "shortness of breath dyspnea",
    "نفسي ضيق": "shortness of breath dyspnea",
    "نفسه ضيق": "shortness of breath dyspnea",
    "مش قادر اتنفس": "shortness of breath dyspnea",
    "مش عارف اتنفس": "shortness of breath dyspnea",
    "كتمه": "shortness of breath dyspnea",
    "كتمة": "shortness of breath dyspnea",
    "ضيق النفس": "shortness of breath dyspnea",
    "ضيق التنفس": "shortness of breath dyspnea",
    "عدوى الجهاز التنفسي": "respiratory infection",
    "العدوى التنفسية": "respiratory infection",
    "التهاب الجهاز التنفسي": "respiratory infection",
    "التهاب رئوي": "pneumonia respiratory infection",
    "التهاب رئه": "pneumonia respiratory infection",
    "كحه": "cough respiratory infection",
    "كحة": "cough respiratory infection",
    "سعال": "cough respiratory infection",
    "حراره": "fever",
    "حرارة": "fever",
    "سخونيه": "fever",
    "سخونية": "fever",
    "برد": "cold respiratory infection",
    "زكام": "cold respiratory infection",
    "رشح": "runny nose respiratory infection",
    "بلغم": "sputum respiratory infection",
    "تشبع الاكسجين": "oxygen saturation",
    "تشبع الأكسجين": "oxygen saturation",
    "اشباع الاكسجين": "oxygen saturation",
    "إشباع الأكسجين": "oxygen saturation",
    "نسبه الاكسجين": "oxygen saturation",
    "نسبة الأكسجين": "oxygen saturation",
    "مستوى الاكسجين": "oxygen saturation level",
    "مستوى الأكسجين": "oxygen saturation level",
    "التنفس": "respiratory",
    "تشخيص": "diagnosis",
    "التشخيص": "diagnosis",
    "علاج": "treatment",
    "العلاج": "treatment",
    "دواء": "drug medication",
    "الدواء": "drug medication",
    "جرعة": "dose dosage",
    "الجرعة": "dose dosage",
    # Egyptian-Arabic and standard spellings for oxygen questions.
    "اكسجين": "oxygen",
    "الاكسجين": "oxygen",
    "اوكسجين": "oxygen",
    "الاوكسيجين": "oxygen",
    "أكسجين": "oxygen",
    "أوكسجين": "oxygen",
    "اعطاء الاكسجين": "oxygen administration",
    "إعطاء الأكسجين": "oxygen administration",
    "ادي": "give administer",
    "اديله": "give administer",
    "اعطي": "give administer",
    "ندي": "give administer",
    "ندي المريض": "give patient",
    "ياخد": "receive take",
    "يحتاج": "needs",
    "نعطي": "give administer",
    "يعطي": "give administer",
    "اعطاء": "administration",
    "إعطاء": "administration",
    "امتى": "when",
    "متى": "when",
    "امتى يحصل": "when does",
    "متى يحصل": "when does",
    "اعمل ايه": "what should I do",
    "اعمل اي": "what should I do",
    "اعمل إيه": "what should I do",
    "اعمل ايه دلوقتي": "what should I do now",
    "ماذا افعل": "what should I do",
    "ماذا أفعل": "what should I do",
    "اعمل ايه لو": "what should I do if",
    "متى نعطي": "when to give",
    "امتى ندي": "when to give",
    "متى يتم اعطاء": "when to administer",
    "امتى يتم اعطاء": "when to administer",
    "متى يحتاج": "when needs",
    "ايه السبب": "what is the cause",
    "ايه اسباب": "what are the causes",
    "ما السبب": "what is the cause",
    "ما أسباب": "what are the causes",
    "علامات": "signs symptoms",
    "اعراض": "symptoms",
    "أعراض": "symptoms",
    "مضاعفات": "complications",
    "ما هي": "what is",
    "ما هو": "what is",
    "ازاي": "how",
    "إزاي": "how",
    "كيف": "how",
}


def normalize_arabic(text: str) -> str:
    """Normalize Arabic spelling for lexical matching without changing meaning."""
    text = str(text).lower()
    text = text.replace("ـ", "")
    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)
    text = text.translate(str.maketrans({
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
        "ى": "ي", "ؤ": "و", "ئ": "ي", "ة": "ه",
    }))
    return re.sub(r"\s+", " ", text).strip()


def contains_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", str(text)))


def tokenize(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9\u0600-\u06FF]+", normalize_arabic(text))


def expand_query_for_retrieval(query: str) -> str:
    """Append English clinical anchors while retaining the user's Arabic text."""
    original = str(query).strip()
    if not contains_arabic(original):
        return original

    normalized = normalize_arabic(original)
    expansions = []
    for arabic_term, english_term in sorted(
        ARABIC_QUERY_TERMS.items(), key=lambda item: len(item[0]), reverse=True
    ):
        if normalize_arabic(arabic_term) in normalized:
            expansions.append(english_term)

    # Keep Latin clinical abbreviations such as STEMI, PCI, ECG, and ICU.
    expansions.extend(re.findall(r"[A-Za-z][A-Za-z0-9-]*", original))
    unique_expansions = list(dict.fromkeys(expansions))
    if not unique_expansions:
        return original
    return f"{original} {' '.join(unique_expansions)}"


def _english_anchor_query(query: str) -> str:
    """Return the English clinical anchors generated from an Arabic query."""
    expanded = expand_query_for_retrieval(query)
    if not contains_arabic(query):
        return expanded
    english_tokens = re.findall(r"[A-Za-z][A-Za-z0-9-]*", expanded)
    return " ".join(dict.fromkeys(english_tokens))


def _anchor_tokens(text: str) -> set[str]:
    tokens = set(re.findall(r"[a-z][a-z0-9-]*", str(text).lower()))
    return tokens.intersection(SUPPORTED_TOPIC_ANCHORS)


def has_retrieval_anchors(query: str) -> bool:
    """Whether a query has a topic anchor covered by the English-only KB."""
    return bool(_anchor_tokens(expand_query_for_retrieval(query)))


def _topic_from_anchors(anchors: set[str]) -> str:
    if anchors.intersection({"stemi", "myocardial", "coronary", "angina", "heart"}):
        return "STEMI and acute coronary syndrome"
    if anchors.intersection({"stroke", "ischaemic", "ischemic", "facial", "slurred", "weakness"}):
        return "stroke and transient ischemic attack"
    if anchors.intersection({"oxygen"}):
        return "oxygen administration and oxygen saturation"
    if anchors.intersection({"icu", "intensive", "critical", "triage"}):
        return "intensive care unit admission and critical care"
    if anchors.intersection({"respiratory", "pneumonia", "dyspnea", "cough", "fever", "shortness"}):
        return "respiratory infection and dyspnea"
    if anchors.intersection({"chest", "cardiac", "palpitations"}):
        return "chest pain and cardiac symptoms"
    return "unknown"


def _local_normalize_query(query: str) -> dict:
    expanded = expand_query_for_retrieval(query)
    anchors = _anchor_tokens(expanded)
    retrieval_query = _english_anchor_query(query) if contains_arabic(query) else str(query).strip()
    return {
        "language": "ar-eg" if contains_arabic(query) else "en",
        "normalized_question": str(query).strip(),
        "retrieval_query": retrieval_query if anchors else "",
        "topic": _topic_from_anchors(anchors),
        "in_scope": bool(anchors),
        "matched_terms": sorted(anchors),
        "confidence": 0.75 if anchors else 0.0,
    }


def _gemini_normalize_query(query: str) -> dict | None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not GEMINI_NORMALIZER_ENABLED or not api_key or not contains_arabic(query):
        return None
    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=str(query),
            config={
                "system_instruction": GEMINI_NORMALIZER_INSTRUCTION,
                "response_mime_type": "application/json",
                "response_schema": GEMINI_NORMALIZER_SCHEMA,
                "temperature": 0,
            },
        )
        result = json.loads(response.text or "")
        if not isinstance(result, dict):
            return None
        retrieval_query = str(result.get("retrieval_query", "")).strip()
        result["retrieval_query"] = retrieval_query
        result["in_scope"] = bool(result.get("in_scope")) and bool(_anchor_tokens(retrieval_query))
        if not result["in_scope"]:
            result["retrieval_query"] = ""
        return result
    except Exception as exc:
        print(f"Gemini query normalization fallback: {type(exc).__name__}: {exc}")
        return None


class Retriever:
    def __init__(self, data_dir="data"):
        data_dir = Path(data_dir)
        self.client = QdrantClient(
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY,
            timeout=120,
        )
        # Must match the model used in build_index.py.
        self.embedder = SentenceTransformer(MODEL_NAME)
        self.reranker = CrossEncoder(RERANKER_MODEL_NAME)

        with open(data_dir / "bm25.pkl", "rb") as f:
            bm25_data = pickle.load(f)
        self.bm25 = BM25Okapi(bm25_data["tokenized_corpus"])
        self.chunks = bm25_data["chunks"]
        self._query_cache = {}

    def normalize_query(self, query: str) -> dict:
        query = str(query).strip()
        if query in self._query_cache:
            return self._query_cache[query]

        local_result = _local_normalize_query(query)
        gemini_result = _gemini_normalize_query(query)
        result = gemini_result or local_result

        # Keep locally recognized topics if Gemini produces a false negative.
        # Gemini can expand the query, but it cannot remove a topic already
        # covered by the local safety vocabulary.
        if gemini_result and local_result.get("in_scope") and not gemini_result.get("in_scope"):
            result = local_result

        # Never trust a model's in_scope=true unless its retrieval query has
        # an anchor that is actually covered by this knowledge base.
        if result.get("in_scope") and not _anchor_tokens(result.get("retrieval_query", "")):
            result = local_result
        self._query_cache[query] = result
        return result

    def dense_search(self, query, top_k=30):
        query = expand_query_for_retrieval(query)
        vec = self.embedder.encode([query], normalize_embeddings=True)[0].tolist()
        hits = self.client.query_points(
            collection_name=COLLECTION_NAME, query=vec, limit=top_k
        ).points
        return [{"array_index": h.id, **h.payload, "dense_score": h.score} for h in hits]

    def bm25_search(self, query, top_k=30):
        query = expand_query_for_retrieval(query)
        scores = np.asarray(self.bm25.get_scores(tokenize(query)))
        ranked = np.argsort(scores)[::-1][:top_k]
        return [
            {"array_index": int(i), **self.chunks[i], "bm25_score": float(scores[i])}
            for i in ranked
        ]

    def hybrid_search(self, query, final_k=10):
        dense = self.dense_search(query, top_k=50)
        bm25 = self.bm25_search(query, top_k=50)
        fused = {}

        def ensure(item):
            idx = item["array_index"]
            if idx not in fused:
                fused[idx] = {**item, "rrf_score": 0.0}
            return fused[idx]

        for rank, item in enumerate(dense, 1):
            ensure(item)["rrf_score"] += 1.0 / (RRF_K + rank)
        for rank, item in enumerate(bm25, 1):
            ensure(item)["rrf_score"] += 1.0 / (RRF_K + rank)

        return sorted(fused.values(), key=lambda x: x["rrf_score"], reverse=True)[:final_k]

    def rerank_search(self, query, candidate_k=20, final_k=10):
        candidates = self.hybrid_search(query, final_k=candidate_k)
        if not candidates:
            return []
        rerank_query = _english_anchor_query(query)
        pairs = [[rerank_query or query, c["text"]] for c in candidates]
        scores = self.reranker.predict(pairs)
        for c, score in zip(candidates, scores):
            c["rerank_score"] = float(score)
        candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return candidates[:final_k]

    def retrieve(self, query, method="reranker", top_k=5):
        if method == "dense":
            return self.dense_search(query, top_k)
        if method == "bm25":
            return self.bm25_search(query, top_k)
        if method == "hybrid":
            return self.hybrid_search(query, top_k)
        if method == "reranker":
            return self.rerank_search(query, candidate_k=max(40, top_k), final_k=top_k)
        raise ValueError(f"Unknown method: {method}")
