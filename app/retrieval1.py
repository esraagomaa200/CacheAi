"""
LAYER 2b — RETRIEVAL
نفس منطق تقييمك (Dense / BM25 / Hybrid-RRF / Reranker) لكن Dense بقى
من Qdrant مش FAISS. الـ Reranker هو الفايز عندك في التقييم فهو default.
"""
import pickle
import re
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer, CrossEncoder
from rank_bm25 import BM25Okapi
from qdrant_client import QdrantClient

from build_index import MODEL_NAME, COLLECTION_NAME

import os
from dotenv import load_dotenv

load_dotenv()

QDRANT_URL = os.environ["QDRANT_URL"]
QDRANT_API_KEY = os.environ["QDRANT_API_KEY"]

RERANKER_MODEL_NAME = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
RRF_K = 60


def normalize_arabic(text: str) -> str:
    text = str(text).lower()

    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)

    text = text.replace("أ", "ا")
    text = text.replace("إ", "ا")
    text = text.replace("آ", "ا")
    text = text.replace("ى", "ي")
    text = text.replace("ة", "ه")

    return text


def tokenize(text: str) -> list[str]:
    text = normalize_arabic(text)

    return re.findall(
        r"[A-Za-z0-9\u0600-\u06FF]+",
        text
    )


class Retriever:
    def __init__(self, data_dir="data"):
        data_dir = Path(data_dir)
        self.client = QdrantClient(
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY,
            timeout=120
        )       
        # IMPORTANT: must match the model used in build_index.py to embed the
        # chunks stored in Qdrant, otherwise query vectors and stored vectors
        # live in different embedding spaces and dense search silently breaks
        # (this was the root cause of bad/negative rerank scores, especially
        # for Arabic queries, since BM25 was doing all the work alone).
        self.embedder = SentenceTransformer(MODEL_NAME)
        self.reranker = CrossEncoder(RERANKER_MODEL_NAME)
        
        with open(data_dir / "bm25.pkl", "rb") as f:
            bm25_data = pickle.load(f)
        self.bm25 = BM25Okapi(bm25_data["tokenized_corpus"])
        self.chunks = bm25_data["chunks"]  # نفس ترتيب النقاط في Qdrant (id = index)

    def dense_search(self, query, top_k=30):
        vec = self.embedder.encode([query], normalize_embeddings=True)[0].tolist()
        hits = self.client.query_points(
            collection_name=COLLECTION_NAME, query=vec, limit=top_k
        ).points
        return [{"array_index": h.id, **h.payload, "dense_score": h.score} for h in hits]

    def bm25_search(self, query, top_k=30):
        scores = np.asarray(self.bm25.get_scores(tokenize(query)))
        ranked = np.argsort(scores)[::-1][:top_k]
        return [
            {"array_index": int(i), **self.chunks[i], "bm25_score": float(scores[i])}
            for i in ranked
        ]

    def hybrid_search(self, query, final_k=10):
        # Widened from 30->50: Arabic queries against an English-only corpus
        # get almost nothing useful from BM25 (lexical match on Arabic tokens
        # vs English text), so dense retrieval has to do all the work. A
        # narrow pool meant the correct chunk often never reached the
        # reranker at all.
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
        pairs = [[query, c["text"]] for c in candidates]
        scores = self.reranker.predict(pairs)
        for c, s in zip(candidates, scores):
            c["rerank_score"] = float(s)
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