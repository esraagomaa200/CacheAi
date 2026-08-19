# CacheAi — السجل الحي

> المرجع الرسمي للتغييرات الفعلية (كود/إعدادات/بيانات/نشر). الأحدث فوق.

## 2026-08-19 — سباق ليلة التسليم (المسابقة)

### Commit `9f2018c` — push على `origin/main` ✅
بوابة: pytest 2/2 · build ✅ · smoke **16/16** (مع اختبارات الـ 409 الجديدة) · فحص متصفح ✅

- **إصلاحات مراجعة Codex** (6 نتايج، كلها اتأكدت في الكود قبل التنفيذ):
  - prompts: بيانات المريض والـ chunks بقوا "بيانات مش تعليمات" بمحدِّدات صريحة + قاعدة ضد الحقن
  - ingest: parse + embed الكل **قبل** لمس الـ collection — الفشل مبقاش يدمر الفهرس الشغال
  - state machine للطوارئ اتقفل: respond من monitoring/alert_pending بس، escalate من
    alert_pending بس، الحالات المنتهية نهائية (409 لغير كده)
  - الرد عالي الخطورة مبقاش يعيد فتح حدث منتهي
  - Chat.jsx: فشل الـ escalation بيعيد المحاولة كل 5 ثواني بدل تجميد العداد؛ 409 "already"
    بيتبنى الحالة النهائية؛ تبديل الجلسة بيقتل تايمر الطوارئ المخفي؛ إصلاح guard الرجوع للجلسة
- **شاشة جديدة `/emergency-history`**: سجل أحداث الطوارئ كامل بالعربي (كروت: حالة/خطورة/
  status/لينك للمحادثة) + عنصر في سايدبار البروفايل — اتفحصت في المتصفح ببيانات حقيقية
- **توثيق**: README احترافي للحكام + `docs/DEMO-SCRIPT.md` سيناريو ديمو بالدقايق بالمصري
- git identity محلية للريبو اتظبطت (spoOOokii / إيميل المشروع)

### Commit `1ca4422` — push على `origin/main` ✅
بوابة الجودة قبل الدفع: pytest **2/2** · vite build ✅ · smoke test للـ API **15/15** · E2E متصفح ✅

**Backend (FastAPI):**
- حزمة `backend/ai/` جديدة: agent على **Gemini** (`gemini-2.5-flash`، strict JSON) + RAG على
  **Qdrant local mode** (`gemini-embedding-001`، 768-dim، collection `medical_docs`) +
  `ingest.py` CLI + fallback عربي آمن (الشات عمره ما يرجع 500 حتى من غير مفتاح)
- endpoints جديدة: `POST/GET /chat/sessions/{id}/messages` (مع sources + risk_level)،
  راوتر `/emergency` (respond / escalate / events history)
- `POST /chat/sessions` بيقبل `chat_type=emergency` وبينشئ `emergency_events` تلقائيًا،
  وجلسة الطوارئ عنوانها الافتراضي "محادثة طوارئ 🚨"
- جدول `emergency_events` جديد + عمودي `messages.sources` (JSON) و `messages.risk_level`
- **إصلاح:** `postgresql://` بيتحول لـ `postgresql+psycopg://` وقت التحميل — الباك كان
  **عاجز عن الاتصال بـ Neon أصلًا** (psycopg3 متثبت والـ URL بيطلب psycopg2) + fallback على sqlite
- **إصلاح:** `migrate_schema.py` كان بيفشل على SQLite (ADD COLUMN بـ DEFAULT غير ثابت)
- **إصلاح:** الاختبار الأحمر — `load_dotenv()` كان بيرجّع `GOOGLE_CLIENT_ID` اللي الاختبار شايله؛
  اتثبت كسلسلة فاضية

**Corpus:** 14 ملف طبي موثّق (WHO / AHA-ASA / NHS / CDC) — 4 stroke + 4 chest_heart +
4 breathing + 2 general، منهم 3 بالعربي. أرقام الطوارئ المصرية (إسعاف 123).

**Frontend (React):**
- `Chat.jsx` اتكتب من الصفر: شات حقيقي (كان mockup صامت 100%) — إرسال، هيستوري،
  source chips، typing indicator، **إدخال صوتي ar-EG**، وضع طوارئ كامل
  (risk badge + عداد 60 ثانية + "أنا بخير" / escalation + كارت جهة الاتصال)
- صفحة **Login** جديدة + route `/login` (المستخدم الراجع مكانش ليه أي طريق دخول) +
  catch-all route + إصلاح كل اللينكات الميتة + حذف Firebase (dependency ميتة بالكامل)
- SideBar: هيستوري حقيقية + Profile + Logout شغالين، حذف Saved/Settings/Reminders الميتين
- **إصلاح (لقيته بالـ E2E):** تكرار عرض الرسايل — سباق بين `handleSend` و effect التحميل
- **إصلاح (لقيته بالـ E2E):** deadlock في تهيئة جلسة الطوارئ تحت React StrictMode

**أمان:**
- `backend/.env` و `__pycache__` اتشالوا من git tracking + `.gitignore` اتضاف
- ⚠️ **معلّق على سبوكي:** تدوير باسورد Neon (متسرب في git history العام) + `SECRET_KEY` أقوى

### قاعدة البيانات (Neon — إضافي فقط، صفر حذف)
- `migrate_schema.py` ضاف `messages.sources` و `messages.risk_level`
- `init_db.py` أنشأ جدول `emergency_events`

### معلّق (blocked على GEMINI_API_KEY من سبوكي)
1. إضافة `GEMINI_API_KEY` في `backend/.env`
2. `python -m ai.ingest` — بناء فهرس Qdrant (مرة واحدة)
3. Smoke test حي لـ Gemini (إجابة حقيقية + sources + risk levels)
4. اختبار عداد الطوارئ بمخاطرة HIGH حقيقية في المتصفح

### التشغيل المحلي
- Backend: `backend/.venv` → `python -m uvicorn main:app --port 8000`
- Frontend: `npm run dev` (بورت 5173) — والـ preview متظبط في `.claude/launch.json`
