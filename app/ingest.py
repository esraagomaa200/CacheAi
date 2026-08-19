"""
LAYER 1 — INGESTION
يقرأ ملفات JSON (schema: source_file -> pages -> {page, text})
ويقسمها chunks بنفس منطق النوتبوك بتاعك (450 كلمة / overlap 75).
"""
import json
import re
import hashlib
from pathlib import Path

CHUNK_WORDS = 450
OVERLAP_WORDS = 75


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def load_documents(json_dir: str) -> list[dict]:
    """يحمّل كل ملفات الـ JSON من فولدر، ويشيل التكرار الكامل (fingerprint)."""
    json_dir = Path(json_dir)
    files = sorted(json_dir.glob("*.json"))
    documents, seen = [], set()

    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            doc = json.load(f)
        if not isinstance(doc, dict) or "pages" not in doc:
            print(f"SKIP (bad schema): {path.name}")
            continue

        fp = hashlib.sha256(
            json.dumps({"source_file": doc.get("source_file"), "pages": doc["pages"]},
                       ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
        if fp in seen:
            print(f"DEDUPLICATED: {path.name}")
            continue
        seen.add(fp)
        doc["_json_path"] = str(path)
        documents.append(doc)

    print(f"Loaded {len(documents)} documents from {json_dir}")
    return documents


def make_chunks(documents: list[dict], chunk_words=CHUNK_WORDS, overlap_words=OVERLAP_WORDS) -> list[dict]:
    """يقسّم كل صفحة/ملف لـ chunks بعدد كلمات ثابت مع overlap، مع الحفاظ على رقم الصفحة."""
    chunks = []
    for doc in documents:
        source_file = doc.get("source_file", Path(doc["_json_path"]).stem)
        pages = doc["pages"]

        # ندمج نص الصفحات مع تتبع رقم الصفحة لكل كلمة (approx via page boundaries)
        words_with_page = []
        for p in pages:
            page_num = p.get("page")
            text = clean_text(p.get("text", ""))
            for w in text.split(" "):
                if w:
                    words_with_page.append((w, page_num))

        i = 0
        chunk_idx = 0
        while i < len(words_with_page):
            window = words_with_page[i:i + chunk_words]
            if not window:
                break
            words = [w for w, _ in window]
            page_nums = [pg for _, pg in window if pg is not None]

            chunk_text = " ".join(words)
            chunk_id = f"chunk_{chunk_idx:04d}"
            chunk_uid = f"{source_file}::{chunk_id}"

            chunks.append({
                "chunk_uid": chunk_uid,
                "chunk_id": chunk_id,
                "source_file": source_file,
                "page_start": min(page_nums) if page_nums else None,
                "page_end": max(page_nums) if page_nums else None,
                "section": doc.get("title") or source_file,
                "text": chunk_text,
            })

            chunk_idx += 1
            if i + chunk_words >= len(words_with_page):
                break
            i += (chunk_words - overlap_words)

    print(f"Built {len(chunks)} chunks")
    return chunks


if __name__ == "__main__":
    import sys
    json_dir = sys.argv[1] if len(sys.argv) > 1 else "data/json_kb"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "data/chunks.jsonl"

    docs = load_documents(json_dir)
    chunks = make_chunks(docs)

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    print(f"Saved chunks -> {out_path}")
