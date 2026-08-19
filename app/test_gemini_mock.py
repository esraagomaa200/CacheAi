import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace

os.environ['QDRANT_URL'] = 'http://localhost:6333'
os.environ['QDRANT_API_KEY'] = 'test-only'
os.environ['GEMINI_API_KEY'] = 'test-only'

ROOT = Path('/home/ubuntu/work/najda_rag/najda_rag')
sys.path.insert(0, str(ROOT / 'app'))
import retrieval

retrieval.GEMINI_NORMALIZER_ENABLED = True

class FakeModels:
    output = ''
    def generate_content(self, **kwargs):
        return SimpleNamespace(text=self.output)

class FakeClient:
    def __init__(self, **kwargs):
        self.models = FakeModels()

fake_client = FakeClient()
original_client = retrieval.genai.Client if hasattr(retrieval, 'genai') else None
# The function imports google.genai locally, so patch the installed module object.
from google import genai
genai.Client = lambda **kwargs: fake_client

fake_client.models.output = json.dumps({
    'language': 'ar-eg',
    'normalized_question': 'متى يتم إعطاء الأكسجين لمريض STEMI؟',
    'retrieval_query': 'oxygen therapy STEMI oxygen saturation thresholds',
    'topic': 'STEMI and acute coronary syndrome',
    'in_scope': True,
    'matched_terms': ['STEMI', 'oxygen'],
    'confidence': 1.0,
})
valid = retrieval._gemini_normalize_query('امتى ادي المريض اوكسجين في STEMI؟')
assert valid['in_scope'] is True
assert 'oxygen' in valid['retrieval_query']

fake_client.models.output = '{not valid json'
assert retrieval._gemini_normalize_query('امتى ادي المريض اوكسجين؟') is None

if original_client is not None:
    genai.Client = original_client
print('Gemini valid JSON and malformed JSON fallback: PASS')
