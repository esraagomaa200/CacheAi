"""
LAYER 2a — INDEXING
- يبني embeddings بموديل MiniLM (نفس اللي فاز في تقييمك).
- يرفعها في Qdrant LOCAL MODE (ملف على الجهاز، من غير Docker ولا سيرفر).
- يبني BM25 index ويحفظه (pickle).
- يعمل KMeans clustering على الـ embeddings ويحفظ cluster_id كـ payload
  (للتصنيف الموضوعي: STEMI / Stroke / ICU triage / Respiratory infection ...الخ)
  وده بيفيد في: (1) طلب المهندس نفسه، (2) فلترة أسرع لو عايز تحصر البحث
  في cluster معين، (3) تحليل أي الملفات قريبة من بعض موضوعياً.
"""
import json
import pickle
import re
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

import os
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
COLLECTION_NAME = "najda_medical_chunks"

QDRANT_URL = os.environ["QDRANT_URL"]
QDRANT_API_KEY = os.environ["QDRANT_API_KEY"]

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


def pick_k_clusters(embeddings: np.ndarray, k_min=4, k_max=12) -> int:
    """يختار عدد clusters تلقائي بأعلى silhouette score."""
    best_k, best_score = k_min, -1
    n = len(embeddings)
    k_max = min(k_max, max(k_min, n // 20))  # ما يعملش clusters أكتر من المعقول
    for k in range(k_min, max(k_min + 1, k_max + 1)):
        if k >= n:
            break
        labels = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(embeddings)
        score = silhouette_score(embeddings, labels)
        if score > best_score:
            best_k, best_score = k, score
    print(f"Chosen k={best_k} (silhouette={best_score:.3f})")
    return best_k


def build(chunks_path="data/chunks.jsonl", out_dir="data"):
    out_dir = Path(out_dir)
    chunks = [json.loads(l) for l in open(chunks_path, "r", encoding="utf-8")]
    texts = [c["text"] for c in chunks]
    print(f"Embedding {len(texts)} chunks with {MODEL_NAME} ...")

    embedder = SentenceTransformer(MODEL_NAME)
    embeddings = embedder.encode(
        texts, batch_size=32, show_progress_bar=True,
        normalize_embeddings=True, convert_to_numpy=True
    ).astype("float32")

    # ---------- Clustering ----------
    k = pick_k_clusters(embeddings)
    labels = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(embeddings)
    for c, lbl in zip(chunks, labels):
        c["cluster_id"] = int(lbl)

    # اسم مبدئي لكل cluster = أكتر source_file شائع فيه (تقدر تحسّنه بـ LLM labeling)
    cluster_names = {}
    for cid in set(labels.tolist()):
        members = [c["source_file"] for c, l in zip(chunks, labels) if l == cid]
        cluster_names[cid] = max(set(members), key=members.count)
    with open(out_dir / "cluster_names.json", "w", encoding="utf-8") as f:
        json.dump({str(k_): v for k_, v in cluster_names.items()}, f, ensure_ascii=False, indent=2)
    print("Cluster -> dominant source_file:", cluster_names)

    # ---------- Qdrant (local mode, no docker) ----------
    client = QdrantClient(url=QDRANT_URL,
                          api_key=QDRANT_API_KEY,
                          timeout=120)
    if client.collection_exists(COLLECTION_NAME):
        client.delete_collection(COLLECTION_NAME)
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=embeddings.shape[1], distance=Distance.COSINE),
    )
    points = [
        PointStruct(id=i, vector=embeddings[i].tolist(), payload=chunks[i])
        for i in range(len(chunks))
    ]
    BATCH_SIZE = 50

    for start in range(0, len(points), BATCH_SIZE):
        batch = points[start:start + BATCH_SIZE]

        client.upsert(
            collection_name=COLLECTION_NAME,
            points=batch,
            wait=True,
        )

        print(
            f"Uploaded {min(start + BATCH_SIZE, len(points))}/{len(points)}"
        )

    print(
        f"Upserted {len(points)} vectors "
        f"into Qdrant collection '{COLLECTION_NAME}'"
    )
    print(f"Upserted {len(points)} vectors into Qdrant collection '{COLLECTION_NAME}'")

    # ---------- BM25 ----------
    tokenized_corpus = [tokenize(t) for t in texts]
    with open(out_dir / "bm25.pkl", "wb") as f:
        pickle.dump({"tokenized_corpus": tokenized_corpus, "chunks": chunks}, f)

    # metadata كامل احتياطي
    with open(out_dir / "chunks_with_clusters.jsonl", "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    print("DONE. Qdrant local DB saved at:", out_dir / "qdrant_local")


if __name__ == "__main__":
    import sys
    chunks_path = sys.argv[1] if len(sys.argv) > 1 else "../data/chunks.jsonl"
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "../data"
    build(chunks_path=chunks_path, out_dir=out_dir)
