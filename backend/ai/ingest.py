"""Corpus ingestion CLI.

Reads backend/corpus/*.md (YAML frontmatter + markdown body), chunks each
body on paragraph boundaries (~1500 chars, 200 overlap), embeds the chunks
with gemini-embedding-001, and upserts them into the local Qdrant
`medical_docs` collection. Idempotent: the collection is recreated on every
run, so re-running never duplicates points.

Usage (from the backend/ directory, with GEMINI_API_KEY set):
    python -m ai.ingest
"""

import re
from pathlib import Path

import yaml

from ai import rag

CORPUS_DIR = rag.BASE_DIR / "corpus"
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def _parse_file(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    match = _FRONTMATTER_RE.match(raw)
    if not match:
        raise ValueError(f"{path.name}: missing YAML frontmatter (---title...---body)")

    meta = yaml.safe_load(match.group(1)) or {}
    if not isinstance(meta, dict):
        raise ValueError(f"{path.name}: frontmatter did not parse to a mapping")

    body = match.group(2).strip()
    return meta, body


def _chunk_text(body: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Pack paragraphs into ~size-char chunks, carrying a trailing overlap
    of the previous chunk into the next one so context isn't lost at the
    boundary."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}" if current else paragraph
        if not current or len(candidate) <= size:
            current = candidate
            continue

        chunks.append(current)
        tail = current[-overlap:] if overlap else ""
        current = f"{tail}\n\n{paragraph}" if tail else paragraph

    if current:
        chunks.append(current)
    return chunks


def _iter_file_chunks(path: Path):
    meta, body = _parse_file(path)
    for text in _chunk_text(body):
        yield {
            "title": meta.get("title", path.stem),
            "org": meta.get("org", ""),
            "url": meta.get("url", ""),
            "condition": meta.get("condition", "unknown"),
            "text": text,
        }


def main() -> None:
    if not CORPUS_DIR.exists():
        print(f"No corpus directory found at {CORPUS_DIR}")
        return

    files = sorted(CORPUS_DIR.glob("*.md"))
    if not files:
        print(f"No .md files found in {CORPUS_DIR}")
        return

    rag.ensure_collection(recreate=True)

    all_chunks: list[dict] = []
    for path in files:
        file_chunks = list(_iter_file_chunks(path))
        all_chunks.extend(file_chunks)
        print(f"{path.name}: {len(file_chunks)} chunks")

    written = rag.upsert_chunks(all_chunks)
    print(f"Total: {written} chunks upserted into '{rag.COLLECTION_NAME}'")


if __name__ == "__main__":
    main()
