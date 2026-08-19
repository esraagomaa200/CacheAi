import os
import sys
from pathlib import Path

# The unit test checks query text only; it does not connect to Qdrant.
os.environ.setdefault('QDRANT_URL', 'http://localhost:6333')
os.environ.setdefault('QDRANT_API_KEY', 'test-only')

ROOT = Path('/home/ubuntu/work/najda_rag/najda_rag')
sys.path.insert(0, str(ROOT / 'app'))
from retrieval import (
    _english_anchor_query,
    _local_normalize_query,
    expand_query_for_retrieval,
    has_retrieval_anchors,
    normalize_arabic,
)

assert normalize_arabic('الإدارة الأولية') == 'الاداره الاوليه'
assert 'initial management' in expand_query_for_retrieval('ما هي الإدارة الأولية لمريض STEMI؟')
local_stemi = _local_normalize_query('ما هي الإدارة الأولية لمريض STEMI؟')
assert local_stemi['in_scope'] and 'STEMI' in local_stemi['retrieval_query']
local_diabetes = _local_normalize_query('ما هو علاج مرض السكري؟')
assert not local_diabetes['in_scope'] and local_diabetes['retrieval_query'] == ''
assert 'stroke' in expand_query_for_retrieval('ما هي الإدارة الأولية للسكتة الدماغية؟')
assert 'intensive care unit' in expand_query_for_retrieval('متى يتم إدخال المريض إلى وحدة العناية المركزة؟')
assert 'oxygen' in expand_query_for_retrieval('امتى ادي المريض اوكسجين؟')
assert 'threshold' in expand_query_for_retrieval('ما هي حدود تشبع الأكسجين؟')
assert 'indications' in expand_query_for_retrieval('ما هي مؤشرات إعطاء الأكسجين؟')
assert 'give' in expand_query_for_retrieval('امتى ادي المريض اوكسجين؟')
assert has_retrieval_anchors('امتى ادي المريض اوكسجين؟')
assert 'chest pain' in expand_query_for_retrieval('قلبي بيوجعني اعمل ايه؟')
assert has_retrieval_anchors('قلبي بيوجعني اعمل ايه؟')
assert 'acute coronary syndrome' in expand_query_for_retrieval('حاسس ان قلبي هيقف')
assert has_retrieval_anchors('حاسس ان قلبي هيقف')
assert 'stroke' in expand_query_for_retrieval('وشي مائل وكلامي متلخبط')
assert 'numbness' in expand_query_for_retrieval('رجلي مش حاسس بيها وكلامي تقيل')
assert 'slurred speech' in expand_query_for_retrieval('رجلي مش حاسس بيها وكلامي تقيل')
assert has_retrieval_anchors('رجلي مش حاسس بيها وكلامي تقيل')
assert 'dyspnea' in expand_query_for_retrieval('نفسي ضيق ومش قادر اتنفس')
assert 'intensive care unit' in expand_query_for_retrieval('دخول العناية المركزة')
assert 'ICU admission' in expand_query_for_retrieval('إمتى الحالة تدخل العناية؟')
assert has_retrieval_anchors('إمتى الحالة تدخل العناية؟')
assert 'criteria' in expand_query_for_retrieval('ما هي معايير دخول وحدة العناية المركزة؟')
assert 'evaluation' in expand_query_for_retrieval('ما تقييم ألم الصدر؟')
assert not has_retrieval_anchors('ما علاج السكري؟')
assert not has_retrieval_anchors('عايز اخس اعمل ايه؟')
anchors = _english_anchor_query('ما هي الإدارة الأولية لمريض STEMI؟')
assert 'initial' in anchors and 'management' in anchors and 'STEMI' in anchors
assert expand_query_for_retrieval('What is STEMI?') == 'What is STEMI?'
print('arabic retrieval unit tests: PASS')
