# CacheAi — السجل الحي

> المرجع الرسمي للتغييرات الفعلية (كود/إعدادات/بيانات/نشر). الأحدث فوق.

## 2026-08-21 — المصادر الموثوقة رجعت إلزامية في كل رد (شات + مكالمة حية)

### مدفوع على main
- `dfcdbfc` **إصلاح اختفاء الـ source chips** — السبب الجذري: تحويل محرك الـ triage
  الأساسي من Gemini (كان بيفرض `used_sources` بالـ schema) لـ Groq + قاعدة برومبت
  كانت بتعفي أسئلة المتابعة من الاستشهاد (الاتنين من `d82708a`). الإنفاذ بقى على 3 طبقات:
  1. **Groq strict json_schema** لموديلات gpt-oss: `used_sources minItems=1` ما دام فيه
     chunks مرفقة (اتقاس حيًا: 120b قبل الـ schema ورجّع مصادر) + retry بـ json_object لو اترفض
  2. `_parse_triage_json` **بيرفض الرد غير المستشهد** والسلسلة تكمّل للموديل التالي؛
     ورد NAJDA بـ `grounded=true` من غير مصادر فعلية بيسقط لطبقة الـ triage
  3. الـ retrieval بقى **سياقي** (آخر رسايل المستخدم مش المتابعة القصيرة بس) وبينجو من
     سقوط embedding (كوتة Gemini) بـ **keyword-search محلي** بدل ما المصادر تختفي كلها
- **اللايف كول**: كل دور كلام بياخد أقرب مصادر موثوقة من الـ corpus — بتتسجل على
  رسالة الـ DB وبتتبعت للمتصفح كـ frame `{"type":"sources"}` فالـ chips بتظهر أثناء
  المكالمة (باك: `live.py` recorder/relay + فرونت: `useLiveVoice` + `Chat.jsx`)
- اختبارات عقد المصادر: `backend/tests/test_sources_contract.py` — ‏12 جديدة، السيوت 14/14
- ⚠️ **متحقق منه E2E للشات النصي** (chips ظهرت في الواجهة برسالتين حقيقيتين)؛ مسار
  المكالمة الصوتية متغطي كود واختبارات بس **من غير E2E صوتي** (محتاج مايك)
- ⚠️ ملاحظتين جودة مفتوحين: الموديل أحيانًا بيستشهد بمصدر مش الأنسب للحالة (اتقاس:
  سؤال قلب استشهد بمصدر stroke) + الـ `risk_level` بيفضل `low` لأعراض مقلقة أول
  المحادثة (ألم صدر + عرق بارد ⟵ ‏low)

## 2026-08-20 (المرحلة الأخيرة قبل التحكيم) — المايك = مكالمة حية + التسليمات

### مدفوع على main (أحدث → أقدم)
- **منع القطع + الوداع الطبيعي** (آخر كوميت): البوت كان بيتقطع في نص كلامه —
  بوابة barge-in أصلبت (فتح 0.6 + ‏3 فريمات متتالية أثناء تشغيل صوت البوت)؛
  و"مع السلامة" / "خلاص شكرًا" / "باي" بتقفل المكالمة زي "اقفل المكالمة" —
  والقفلة **event-driven**: بتستنى رد الوداع يخلص توليدًا (turn_complete) وتشغيلًا
  (آخر chunk صوت) مش تايمر أعمى (تايمر الـ 10 ثواني backstop بس)
- `4bc4939` + `81a152a` **تجهيز التيم**: ملفات `.env` الحقيقية متكوميتة (ريبو **برايفت**
  — قرار المالك؛ ⚠️ تدوير المفاتيح إجباري قبل أي إتاحة عامة) + سكربت
  `scripts/setup-team.ps1` (‏clone → سكربت واحد → 3 أوامر تشغيل) + قوالب `.env.example`
- `f8e42aa` **تسليمات المسابقة**: بريزنتيشن 18 شريحة بثيم التطبيق
  (`docs/NajdaAI-Presentation.pptx` — إعادة البناء: `build.js` ثم `fixrtl.py` وإلا العربي
  يبوظ) + 3 تقارير PDF للتيم (`docs/team-reports/`: ‏UI/UX+DB، ‏Backend+Frontend، ‏AI Agent)
  + `docs/PRESENTATION-CONTENT.md` و `docs/DEMO-SCRIPT.md`
- `77a9cf4` **"جاري إعادة الاتصال" بعد كل جملة اتصلح**: السبب الجذري إن
  `session.receive()` بيخلص مع كل turn — اتلف في `while True` (اتبرهن: turn-ين على
  اتصال واحد). ⚠️ **ممنوع** إعادة تثبيت لغة الـ ASR (`8ec7e95`→`8752a2a`): بتقتل الجلسة
  عند أول صوت — فيه كومنت تحذيري في `live.py`
- `1ba5f85` + `404f510` **المايك = مكالمة حية جوّه الشات** (الأوفرلاي 📞 اتشال):
  محرك صوت جديد `useLiveVoice.js` — ‏WebRTC-loopback AEC (البوت مبقاش يسمع نفسه —
  الحل الجذري بدل ترقيعات RMS) + ‏Silero VAD v5 (ملفات ort متضمنة في
  `src/assets/vad/`) + بوابة كلام مرنة (12/30 فريم، ‏hysteresis ‏0.35/0.2) +
  ‏zero-frame keepalive (أساسي — من غيره الجلسة بتموت) + فقاعات المكالمة بتتسجل
  في الشات + اختبار fake-mic ‏E2E (الدرس: eslint كامل من غير truncation)
- `a880597` مكالمات حية بتتحفظ في الهيستوري (`?session=`) + `2af5ab5` **كشف الطوارئ
  في الشات العادي** بيشغّل نفس فلو الأمان كامل (alert_pending مش مجرد badge)
- `6efd19d` risk badge في هيدر الشات العادي + `2094fd2` الإيميل بقى اختياري في بوابة الإكمال
- **E2E ‏43/43** (زادت 5 اختبارات عن 38: بوابة الإكمال + محرك الصوت)

### قرارات تشغيلية
- 🔴 **قاعدة معتمدة من سبوكي: ممنوع أي git commit/push إلا بأمر صريح منه ("زامن")**
- كوتات: ‏Groq TPD ‏200k/يوم لكل موديل · ‏Gemini المجاني 20 طلب/يوم · ‏Gemini Live
  (المكالمة + TTS) بلا حد طلبات — يُفضَّل ترقية Groq Dev Tier قبل التحكيم
- الموبايل ريسبونسيف مؤجَّل بقرار سبوكي

## 2026-08-20 — الصوت والمكالمة الحية والواجهة الثنائية

### مدفوع على main (أحدث → أقدم)
- `aa4bde7` **بوابة إكمال البيانات**: جهة اتصال الطوارئ إجبارية (`/complete-profile`)،
  الباقي skip بتذكير بانر كل جلسة؛ مسار الطوارئ لا يُحبس (كارت سريع + تخطي فوري). E2E ‏38/38
- `49d7d2a` **سرينة + اهتزاز** مع عداد الطوارئ لحد "أنا بخير" أو الـ escalation
- `e4244d7` إصلاح الصندوق الأبيض حوالين زرار جوجل في الدارك (Chromium color-scheme mismatch)
- `f690723` E2E متوافقة مع الواجهة الثنائية — 38/38 (baseURL→3000، لغة مثبتة en)
- دمج **codex/bilingual-ui**: واجهة عربي/إنجليزي كاملة + دارك مود (شغل Codex في worktree منفصل)
- `4795600` + `c1d1e63` **عكس لغة المستخدم** في كل الطبقات (تحية/triage/مكالمة) — hi→English
- `2b856da`→`0d628c6` **المكالمة الحية 📞**: WS relay ‏`/chat/live`، صوت مصري (Charon)،
  مقاطعة، إعادة اتصال تلقائي **مع استعادة السياق** (الجلسة الجديدة بتفتكر المكالمة)،
  إنهاء بالصوت ("اقفل المكالمة")، بروتوكول ما بعد التصعيد (أوامر نجاة مرقمة، "مش قادر
  أتحرك" = علامة حمرا)، VAD أسرع (500ms)
- `9ba30e3` **محادثة صوتية turn-based**: مايك → إرسال تلقائي → رد منطوق (`POST /chat/tts`
  عبر Gemini Live — طلبات بلا حد)
- `c690e6b` **سلسلة موديلات للـ triage**: gpt-oss-120b ← 20b ← qwen ← Gemini ← ثابت
  (كوتات Groq اليومية per-model 200k توكن؛ Gemini المجاني **20 طلب/يوم** فقط)
- **اللينك العام**: Tailscale Funnel ‏https://spooookii.tailad1353.ts.net → بورت 3000
  (proxy ‏`/api` نفس الـ origin). لو وقع خارجيًا: `tailscale down && tailscale up`

(اتكوميت كل المعلّق أعلاه لاحقًا — راجع قسم "المرحلة الأخيرة" فوق)
- **برزنتيشن المسابقة** (وكيل بحث): مشكلة بمصادر + منافسون + فلو + ماركتينج

### معلق على سبوكي
- 🔴 تدوير باسورد Neon (متسرب في git history العام)
- ربط ذاكرة المشروع بـ OneDrive (بلوك §1-أ) — ممنوع كتابة ذاكرة قبلها
- تأكيد دخول جوجل من اللينك العام بعد إضافة الـ origin
- الريسبونسيف: مقيس ومكسور على الموبايل — **مؤجل بقرار سبوكي**

## 2026-08-19 — سباق ليلة التسليم (المسابقة)

### الصوت — commits `9ba30e3` + `c690508` ✅ (سبوكي جرّب المكالمة: «شغالة جامد»)
- **محادثة صوتية turn-based**: مايك → ASR ‏ar-EG → إرسال تلقائي → الرد نص + **نطق مصري**
  (`POST /chat/tts` — Gemini Live API، طلبات بلا حد عكس موديلات TTS ~15/يوم)
- **مكالمة حية 📞 full-duplex**: WS relay ‏`/chat/live` (JWT، المفتاح مش بيوصل للمتصفح) —
  صوت لايف بالاتجاهين + نصوص لحظية + مقاطعة شغالة. متبرهن ببروبات صوت حقيقي:
  سؤال متابعة للعرض الغامض، تصعيد 123 كأول جملة لعلامات FAST
- **الصوت: Charon** (اختيار سبوكي من audition لـ30 صوت — `voice-samples/voices.html`)،
  متثبت في `backend/.env` وكـ default في `tts.py`
- ⚠️ درس مدفوع: كتم المايك client-side يعلّق المكالمة — VAD بتاع Gemini محتاج السكوت يوصله
- **Codex شغال بالتوازي في worktree منفصل** (`.worktrees/dark-mode` على بورت 5173) —
  نسختنا الرئيسية للتجربة على بورت **3000**

### Commit `3ef9ada` — push ✅ — E2E suite كاملة 18/18
- **Playwright E2E**: 18 اختبار (auth/profile/chat/emergency UI/state-machine API) — كلهم خضر.
  تشغيل مرئي: `E2E_HEADED=1 npx playwright test` من `frontend/`
- **٤ باجات حقيقية اكتشفتها الـ suite واتصلحوا**: التسجيل كان مقفول فعليًا (patient_id ""
  بدل null → 409 unique)، ثريد فاضي عند الرجوع لجلسة self-created، عناوين السايدبار
  الثابتة "New Chat"، وlogout بتاع صفحات البروفايل مش بيمسح التوكن
- **تسريع NAJDA**: مرشحين reranker 20→12، reasoning_effort=low + سقف tokens،
  top_k 3 → السؤال السريري (warm) من ~60 لـ ~20 ثانية، والرفض خارج النطاق ~1 ثانية

### Commit `d82708a` — push ✅ — دمج NAJDA + الـ router + شخصية triage جديدة
- **Router بالصعوبة**: تحية → Groq gpt-oss-20b (~1-3 ث) · triage → **Groq gpt-oss-120b أساسي**
  وGemini 3.6-flash احتياطي (كوتة Gemini المجانية ضربت 429 مستمر live) · سؤال سريري →
  **محرك NAJDA** (بورت 8001) مع تصنيف الخطورة بالتوازي على Groq
- **شخصية "نجدة" الجديدة**: مسعف بيسأل سؤال متابعة واحد للأعراض الغامضة، تصعيد بالعلامات
  الحمرا الصريحة أو الأدلة المتراكمة بس (feedback مباشر من سبوكي) — اتحقق live بالمتصفح
- **دمج شغل الزميلة**: app/ (hybrid retrieval + reranker + Qdrant Cloud 574 نقطة +
  9 مصادر guidelines منضفة) — اتصلّح فيه: كراش cp1252 مع الأسئلة العربي (UTF-8 env)،
  الـ normalizer اتقفل لصالح البديل المحلي، وgemini-2.5→3.6-flash
- **أمان**: استعادة `.gitignore` بعد ما اتمسح (كان هيكشف كل مفاتيح root .env الجديدة)

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
