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


def search(query: str, k: int = 4) -> list[dict]:
    """Return up to k relevant chunks as {title, org, url, condition, text, score}.

    Resilient by design: an empty/missing collection (corpus not ingested
    yet) or any lookup error returns an empty list rather than raising, so
    the agent can still answer without grounding instead of failing outright.
    """
    try:
        client = get_qdrant_client()
        if not client.collection_exists(COLLECTION_NAME):
            return []

        vector = embed_query(query)
        result = client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector,
            limit=k,
        )
        chunks = []
        for point in result.points:
            payload = point.payload or {}
            chunks.append(
                {
                    "title": payload.get("title", ""),
                    "org": payload.get("org", ""),
                    "url": payload.get("url", ""),
                    "condition": payload.get("condition", ""),
                    "text": payload.get("text", ""),
                    "score": point.score,
                }
            )
        return chunks
    except Exception:
        return []
