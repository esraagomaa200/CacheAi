"""Retrieval helpers backed by a local (embedded, on-disk) Qdrant collection.

All SDK imports (google-genai, qdrant-client) are done lazily inside the
functions that need them, so importing this module never fails even if those
optional packages aren't installed yet — the FastAPI app can still boot.
"""

import os
import threading
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
QDRANT_PATH = BASE_DIR / "qdrant_data"

# Entry points like `python -m ai.ingest` import this module without going
# through main.py/database.py, so the env files must be loaded here too
# (override=False keeps already-set process vars authoritative).
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

COLLECTION_NAME = "medical_docs"
VECTOR_SIZE = 768
EMBEDDING_MODEL = "gemini-embedding-001"
EMBED_BATCH_SIZE = 16

_client = None
_client_lock = threading.Lock()


def get_genai_client():
    """Lazily build a google-genai client from GEMINI_API_KEY.

    Reads the key only at call time via os.getenv — never logged, never
    hardcoded. Shared by rag.embed_texts() and agent.py's Gemini call.
    """
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=api_key)


def get_qdrant_client():
    """Lazy singleton QdrantClient in local (embedded) mode."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                from qdrant_client import QdrantClient

                QDRANT_PATH.mkdir(parents=True, exist_ok=True)
                _client = QdrantClient(path=str(QDRANT_PATH))
    return _client


def embed_texts(texts: list[str], task_type: str, batch_size: int = EMBED_BATCH_SIZE) -> list[list[float]]:
    """Embed a batch of texts with gemini-embedding-001 at 768 dimensions.

    task_type is "RETRIEVAL_QUERY" for search queries or "RETRIEVAL_DOCUMENT"
    for corpus ingestion, per the Gemini embeddings API.
    """
    if not texts:
        return []

    from google.genai import types

    client = get_genai_client()
    vectors: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=batch,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=VECTOR_SIZE,
            ),
        )
        vectors.extend(embedding.values for embedding in response.embeddings)
    return vectors


def embed_query(text: str) -> list[float]:
    return embed_texts([text], task_type="RETRIEVAL_QUERY")[0]


def embed_documents(texts: list[str]) -> list[list[float]]:
    return embed_texts(texts, task_type="RETRIEVAL_DOCUMENT")


def ensure_collection(recreate: bool = False) -> None:
    """Make sure the medical_docs collection exists. If recreate is True,
    drop and recreate it first (used by the idempotent ingest CLI)."""
    from qdrant_client.models import Distance, VectorParams

    client = get_qdrant_client()
    exists = client.collection_exists(COLLECTION_NAME)
    if exists and recreate:
        client.delete_collection(COLLECTION_NAME)
        exists = False
    if not exists:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


def write_chunks(chunks: list[dict], vectors: list[list[float]]) -> int:
    """Write pre-embedded corpus chunks as points into the collection.

    Each chunk dict needs: title, org, url, condition, text; vectors must be
    the same length as chunks (one embedding per chunk, already computed via
    embed_documents()). Returns the number of points written. Point ids are
    freshly assigned 0..N-1, so this is meant to be called once per full
    ingest run right after ensure_collection(recreate=True).
    """
    if not chunks:
        return 0

    from qdrant_client.models import PointStruct

    client = get_qdrant_client()
    points = [
        PointStruct(
            id=idx,
            vector=vector,
            payload={
                "title": chunk.get("title", ""),
                "org": chunk.get("org", ""),
                "url": chunk.get("url", ""),
                "condition": chunk.get("condition", ""),
                "text": chunk.get("text", ""),
            },
        )
        for idx, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    client.upsert(collection_name=COLLECTION_NAME, points=points)
    return len(points)


def _payload_to_chunk(payload: dict, score: float) -> dict:
    return {
        "title": payload.get("title", ""),
        "org": payload.get("org", ""),
        "url": payload.get("url", ""),
        "condition": payload.get("condition", ""),
        "text": payload.get("text", ""),
        "score": score,
    }


def _tokenize(text: str) -> set[str]:
    import re

    return {w for w in re.findall(r"[\w؀-ۿ]+", (text or "").lower()) if len(w) > 2}


def _keyword_search(query: str, k: int) -> list[dict]:
    """Embedding-free fallback: token-overlap scoring over the whole local
    collection. Exists so a dead Gemini embeddings quota degrades retrieval
    quality instead of silently stripping every answer of its sources —
    the corpus is small (tens of chunks), a full scan is cheap."""
    client = get_qdrant_client()
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    points, _ = client.scroll(
        collection_name=COLLECTION_NAME, limit=1000, with_payload=True
    )
    scored = []
    for point in points:
        payload = point.payload or {}
        doc_tokens = _tokenize(f"{payload.get('title', '')} {payload.get('text', '')}")
        overlap = len(query_tokens & doc_tokens)
        if overlap:
            scored.append((overlap / len(query_tokens), payload))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [_payload_to_chunk(payload, score) for score, payload in scored[:k]]


def search(query: str, k: int = 4) -> list[dict]:
    """Return up to k relevant chunks as {title, org, url, condition, text, score}.

    Resilient by design: vector search first; if the query embedding fails
    (Gemini quota/network), fall back to local keyword search so answers
    keep their source grounding. An empty/missing collection (corpus not
    ingested yet) or a total failure returns an empty list rather than
    raising, so the agent can still answer instead of failing outright.
    """
    try:
        client = get_qdrant_client()
        if not client.collection_exists(COLLECTION_NAME):
            return []
    except Exception as exc:
        print(f"[rag] qdrant unavailable: {type(exc).__name__}: {str(exc)[:200]}")
        return []

    try:
        vector = embed_query(query)
        result = client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector,
            limit=k,
        )
        return [_payload_to_chunk(point.payload or {}, point.score) for point in result.points]
    except Exception as exc:
        # Never silent: a dead embedding path means degraded grounding — it
        # must be visible in the server log, not swallowed.
        print(f"[rag] vector search failed ({type(exc).__name__}: {str(exc)[:160]}) — keyword fallback")

    try:
        return _keyword_search(query, k)
    except Exception as exc:
        print(f"[rag] keyword fallback failed: {type(exc).__name__}: {str(exc)[:200]}")
        return []
