import sys
from pathlib import Path

ROOT = Path('/home/ubuntu/work/najda_rag/najda_rag')
sys.path.insert(0, str(ROOT / 'app'))
from retrieval import normalize_arabic, expand_query_for_retrieval, _english_anchor_query

assert normalize_arabic('الإدارة الأولية') == 'الاداره الاوليه'
assert 'initial management' in expand_query_for_retrieval('ما هي الإدارة الأولية لمريض STEMI؟')
assert 'stroke' in expand_query_for_retrieval('ما هي الإدارة الأولية للسكتة الدماغية؟')
assert 'intensive care unit' in expand_query_for_retrieval('متى يتم إدخال المريض إلى وحدة العناية المركزة؟')
anchors = _english_anchor_query('ما هي الإدارة الأولية لمريض STEMI؟')
assert 'initial' in anchors and 'management' in anchors and 'STEMI' in anchors
assert expand_query_for_retrieval('What is STEMI?') == 'What is STEMI?'
print('arabic retrieval unit tests: PASS')
