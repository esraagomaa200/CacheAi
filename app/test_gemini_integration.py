import os
import sys
from pathlib import Path

os.environ.setdefault('QDRANT_URL', 'http://localhost:6333')
os.environ.setdefault('QDRANT_API_KEY', 'test-only')
os.environ['GEMINI_NORMALIZER_ENABLED'] = 'true'
os.environ.pop('GEMINI_API_KEY', None)

ROOT = Path('/home/ubuntu/work/najda_rag/najda_rag')
sys.path.insert(0, str(ROOT / 'app'))

from google import genai  # noqa: F401
from retrieval import _gemini_normalize_query, _local_normalize_query

assert _gemini_normalize_query('امتى ادي المريض اوكسجين؟') is None
assert _local_normalize_query('امتى ادي المريض اوكسجين؟')['in_scope'] is True
assert _local_normalize_query('ما علاج السكري؟')['in_scope'] is False
print('Gemini SDK import and no-key fallback: PASS')
