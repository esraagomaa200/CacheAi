# NAJDA — دليل محرك الـ RAG الطبي (تفصيلي)

هذا الملف هو النسخة التفصيلية/الهندسية لإعداد محرك NAJDA — الجزء الملخّص للحكام موجود في
[`README.md`](../README.md#retrieval--grounding-engine-najda). الملف الأصلي اللي كتبه المهندس
(`NAJDA — Medical RAG Backend.md` في روت المشروع) اتسيب زي ما هو من غير تعديل؛ الملف ده بيوسّعه
بتفاصيل إضافية (دعم العربي، وحالة النشر الحالية على Qdrant Cloud).

المحرك ده **مش جوه `backend/`** — عنده الفولدر بتاعه في روت المشروع (`app/`)، وقاعدة المعرفة
بتاعته في `data/json_kb/`، ومتطلباته في `requirements.txt` على الروت.

---

## 0. التثبيت

```bash
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```
(الأوامر دي من روت المشروع مباشرة، مش من جوه `app/`.)

---

## 1. المفاتيح المطلوبة

### Groq (الـ generator)
1. https://console.groq.com → Sign up (مجاني، من غير كارت ائتمان)
2. API Keys → Create key

### Qdrant Cloud (الـ vector store)
1. https://cloud.qdrant.io → أنشئ Cluster (فيه Free tier 1GB بدون كارت ائتمان)
2. هاتك الـ Cluster URL والـ API Key

اعمل ملف `.env` في **روت المشروع** (مش `backend/.env`):
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
QDRANT_URL=https://xxx.cloud.qdrant.io
QDRANT_API_KEY=xxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxx        # للـ query normalizer بتاع الأسئلة العربية
GEMINI_MODEL=gemini-3.6-flash               # اختياري، ده الافتراضي أصلاً
GEMINI_NORMALIZER_ENABLED=true              # اختياري، شغّال افتراضيًا
```

---

## 2. قاعدة المعرفة (Knowledge Base)

الملفات موجودة بالفعل في `data/json_kb/` — 9 ملفات `*_Cleaned.json` مصادرها WHO / NICE /
STEMI guideline / Ischemic Stroke Management / ICU admission-discharge-triage:

```
data/json_kb/
  9789240103665-eng_Cleaned.json
  9789241513081-eng_Cleaned_v2.json
  acute-coronary-syndromes-pdf-66142023361477_Cleaned.json
  intensive care unit admission, discharge, and triage_Cleaned.json
  Ischemic Stroke Management_Cleaned.json
  recentonset-chest-pain-of-suspected-cardiac-origin-assessment-and-diagnosis-pdf-975751034821_Cleaned.json
  STEMI guidelines.final_Cleaned.json
  stroke-and-transient-ischaemic-attack-in-over-16s-diagnosis-and-initial-management-pdf-66141665603269_Cleaned.json
  suspected-acute-respiratory-infection-in-over-16s-assessment-at-first-presentation-and-initial-management-pdf-66143901172165_Cleaned.json
```

---

## 3. الـ Pipeline (مرة واحدة، أو كل ما تحدّث المصادر)

**ملاحظة مهمة عن حالة النشر الحالية:** الفهرسة دي **اتعملت خلاص** — كولكشن Qdrant Cloud اسمه
`najda_medical_chunks` **جاهز ومبني بـ 574 نقطة**. المفيش داعي تعيد الخطوات دي إلا لو غيّرت
مصدر أو ضفت مستند جديد.

```bash
cd app
python ingest.py ../data/json_kb ../data/chunks.jsonl
python build_index.py ../data/chunks.jsonl ../data
```

ده بيعمل:
- Chunking للمستندات التسعة
- Embeddings بموديل `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (نفس اللي
  فاز في تقييم المهندس للموديلات)
- رفع النقط في **Qdrant Cloud** (كولكشن `najda_medical_chunks`) — مش local file، الانتقال من
  Qdrant local (ملف على الجهاز) لـ Qdrant Cloud **اتعمل خلاص** بتغيير سطر واحد في
  `build_index.py` و `retrieval.py`: `QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)`
  بدل `QdrantClient(path=...)`
- KMeans clustering (يختار عدد الـ clusters تلقائي بالـ silhouette score) — بيتحفظ كـ
  `cluster_id` على كل chunk، واسم تقريبي لكل cluster في `cluster_names.json`. ممكن يتستخدم في
  الفرونت اند كـ "تصنيف موضوعي" (Cardiac / Stroke / ICU / Respiratory) أو يفضل internal بس.
- بناء BM25 index

---

## 4. تشغيل المحرك

```bash
cd app
uvicorn main:app --port 8001
```

> استخدم `--port 8001` (مش الافتراضي `8000`) لما تشغّله جنب الباك اند الرئيسي بتاع NajdaAI،
> لأن ده شغال على `8000` أصلاً. لو بتشغّل المحرك لوحده من غير باقي المشروع، `--port 8000`
> شغالة برضه.

اختبار:
```bash
curl -X POST http://localhost:8001/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the initial management of STEMI?"}'
```

الرد:
```json
{
  "answer": "...",
  "sources": [
    {"source_file": "...", "page_start": 1, "page_end": 2, "section": "...", "score": 0.8}
  ],
  "grounded": true
}
```

---

## 5. دعم الأسئلة العربية

قاعدة المعرفة الحالية باللغة الإنجليزية بالكامل، فتمت إضافة طبقتين في `app/retrieval.py`:

1. **قاموس توسيع محلي (Arabic → English)**: قاموس كبير مبني يدويًا بيحوّل مصطلحات ولهجات
   مصرية شائعة (زي "كلامي تقيل"، "رجلي بتنمل"، "نفسي ضيق") لمرادفات إنجليزية سريرية (stroke
   slurred speech, numbness, shortness of breath...) — ده اللي بيحدد أصلًا هل السؤال داخل
   نطاق قاعدة المعرفة (`in_scope`) ولا لأ، حتى لو Gemini مش شغال أو رجع نتيجة غلط.
2. **Gemini query normalizer (اختياري، `GEMINI_NORMALIZER_ENABLED`)**: بياخد السؤال العربي
   ويرجّع JSON منظم (`retrieval_query`, `topic`, `in_scope`, `matched_terms`, `confidence`)
   لتحسين جودة البحث. **Gemini هنا query normalizer بس** — مش بيجاوب على السؤال الطبي
   ومش بيقدر يوسّع نطاق المصادر؛ لو رجع `in_scope=true` بموضوع مش مغطى فعليًا في القاموس
   المحلي، النظام بيتجاهله ويرجع للقرار المحلي (`_local_normalize_query`).

النص الأصلي اللي المستخدم كتبه هو اللي بيتبعت لطبقة التوليد (Groq) — يعني النظام بيقدر يصيغ
الإجابة بنفس لغة السؤال، حتى لو البحث نفسه بيحصل بمصطلحات إنجليزية.

الإصلاح ده بيحصل وقت البحث (query time) ولا يحتاج إعادة بناء embeddings ولا BM25. لاختباره:

```bash
python tests/test_arabic_retrieval.py
```
(من روت المشروع؛ فيه نسخة مماثلة كمان جوه `app/test_arabic_retrieval.py`.)

---

## 6. ملاحظات هندسية قبل أي تعديل مستقبلي

1. **`MIN_RERANK_SCORE` في `app/agent.py`** (القيمة الحالية `0.5`): دي أهم جزء في الـ Safety
   layer. لو غيّرت المصادر أو الـ reranker، اعمل 5-10 أسئلة برا نطاق المصادر (مثلاً "What's
   the treatment for diabetes?") وشوف الـ `rerank_score` بتاعها، واظبط العتبة على أساسها —
   هدف الاختبار إنه يرفض صح، ده شرط في الـ Terms (بند 4.1 و4.2).

2. **الأسئلة خارج التسع ملفات**: الـ Safety layer بيرفض بس لو مفيش نتائج قوية — جرّب سؤال
   عام زي "What's the weather today?" وسؤال طبي بعيد عن نطاقك (مثلاً سرطان أو سكر) عشان
   تتأكد إنه بيرفض صح بدل ما يهلوسن من معرفته العامة.

3. **الـ Clustering**: نتيجة `KMeans` على الـ embeddings بتتحط كـ payload field (`cluster_id`)
   على كل chunk، واسم تقريبي لكل cluster بيتحفظ في `cluster_names.json` (مبني حاليًا من أكتر
   `source_file` تكرار في الـ cluster، مش labeling بالـ LLM).

4. **الفرق بين `app/retrieval.py` و`retrieval.py` اللي على الروت**: نسخة `app/` هي المستخدمة
   فعليًا من `app/main.py` (لأن التشغيل بيكون `cd app` الأول). نسخة الروت أقدم واتسابت بدون
   استخدام حي — لو هتنضّف الريبو بعد التسليم، دي مرشحة للحذف.
