# NAJDA — Medical RAG Backend

## 0. التثبيت
```bash
cd najda_rag
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 1. المفتاح المجاني (Groq)
1. https://console.groq.com → Sign up (مجاني، من غير كارت ائتمان)
2. API Keys → Create key
3. اعمل ملف `.env` في روت المشروع:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

## 2. حط ملفات الـ JSON بتاعتك
انسخ كل ملفات `*_Cleaned.json` (السبعة الأصليين، من غير الـ "Copy") في:
```
najda_rag/data/json_kb/
```

## 3. شغّل الـ pipeline (مرة واحدة، أو كل ما تحدّث المصادر)
```bash
cd app
python ingest.py ../data/json_kb ../data/chunks.jsonl
python build_index.py ../data/chunks.jsonl ../data
```
ده هيعمل:
- Chunking
- Embeddings (MiniLM)
- Qdrant local DB جوه `data/qdrant_local` (ملف على الجهاز، مفيش سيرفر مطلوب)
- KMeans clustering (يختار عدد الـ clusters تلقائي بالـ silhouette score)
- BM25 index

## 4. شغّل الباك اند
```bash
uvicorn main:app --reload --port 8000
```
اختبار:
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the initial management of STEMI?"}'
```

## 5. دعم الأسئلة العربية

قاعدة المعرفة الحالية باللغة الإنجليزية، لذلك تمت إضافة طبقة query expansion في `app/retrieval.py`. عند ورود سؤال عربي، يحتفظ النظام بالسؤال الأصلي، ويضيف مصطلحات سريرية إنجليزية مثل `stroke`, `initial management`, `intensive care unit`, و`STEMI` إلى البحث الهجين والـ reranker. هذا يحسن الوصول إلى المصادر الإنجليزية، بينما يظل السؤال الأصلي هو الذي يُرسل إلى طبقة التوليد، ولذلك يستطيع النظام صياغة الإجابة بلغة المستخدم.

هذا الإصلاح يتم وقت البحث ولا يحتاج إلى إعادة بناء embeddings أو BM25. لاختباره:

```bash
cd najda_rag
python tests/test_arabic_retrieval.py
```

## ملاحظات مهمة قبل التسليم

1. **`MIN_RERANK_SCORE` في `agent.py`**: القيمة `-2.0` تقريبية. اعمل 5-10
   أسئلة برا نطاق المصادر (مثلاً "What's the treatment for diabetes?" لو
   مش موجود عندك) وشوف الـ rerank_score بتاعها، واظبط العتبة على أساسها —
   ده أهم جزء في الـ Safety layer وهيتقيّم في الحكم.

2. **الانتقال من Qdrant local لـ Qdrant Cloud (اختياري، أفضل للعرض الحي)**:
   لو عايز نسخة سحابية بدل الملف المحلي (فيه Free tier 1GB على
   https://cloud.qdrant.io بدون كارت ائتمان)، غيّر سطر واحد بس في
   `build_index.py` و `retrieval.py`:
   ```python
   client = QdrantClient(url="https://xxx.cloud.qdrant.io", api_key="...")
   ```
   بدل `QdrantClient(path=...)`. باقي الكود يفضل زي ما هو.

3. **الـ Clustering**: دلوقتي بيتحط كـ payload field (`cluster_id`) على كل
   chunk وبيتحفظ اسم تقريبي لكل cluster في `cluster_names.json`. تقدر
   تستخدمه في الفرونت اند كـ "تصنيف موضوعي" (مثلاً فلتر: Cardiac / Stroke /
   ICU / Respiratory) أو تسيبه internal بس. لو عايزه أسماء أدق (مش بس
   أكتر source_file تكرار) قولّي أعملّك labeling بالـ LLM لكل cluster.

4. **الأسئلة خارج الـ 7 ملفات**: الـ Safety layer بيرفض بس لو مفيش نتائج
   قوية — جرّب سؤال زي "What's the weather today?" وسؤال طبي بعيد عن
   نطاقك (مثلاً سرطان) عشان تتأكد إنه بيرفض صح، ده شرط في الـ Terms
   (بند 4.1 و4.2).
