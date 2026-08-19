# نسخة Backend مدموجة مع مشروعك الحالي

هذه النسخة مبنية على الملفات التي أرسلتيها، وليست مشروعاً منفصلاً عن شغلك. تم الحفاظ على موديلات `User` و`PatientProfile` و`EmergencyContact` و`ChatSession` و`Message`، وتم الحفاظ على مسارات الـ Chat الموجودة.

## ما تم تعديله

تم توحيد إعدادات JWT في `security.py` مع دعم `SECRET_KEY` و`JWT_SECRET_KEY`، وإضافة password hashing، وتعديل `dependencies.py` ليقرأ المستخدم الحالي من خلال user ID داخل التوكن. تم توسيع `schemas.py` ليقبل بيانات البروفايل المسطحة التي ترسلها الواجهة، مع دعم الشكل القديم المتداخل لـ `emergency_contact`.

تم تحديث `routers/auth.py` ليشمل التسجيل مع Patient Profile وEmergency Contact، وتسجيل الدخول بـ email/password، وGoogle ID-token login، و`GET /auth/me`. وتم تحديث `routers/profile.py` ليشمل `GET /profile/me` و`PUT /profile/me` وعمليات Emergency Contact المنفصلة. أما `routers/chat.py` فتم الاحتفاظ به كما أرسلتيه.

تم جعل `init_db.py` وStartup في `main.py` غير تدميريين؛ لا يوجد حذف لجداول قديمة. كما تم جعل قائمة الأمراض المزمنة تعمل مع SQLite محلياً وتستخدم JSONB مع PostgreSQL.

## طريقة استبدال الملفات بأمان

قبل النسخ، خذي نسخة احتياطية من فولدر مشروعك الحالي بالكامل، مثلاً `BACKEND_backup`. بعد ذلك انسخي من هذه النسخة الملفات التالية فوق الملفات المقابلة في مشروعك:

| الملف | الإجراء |
|---|---|
| `database.py` | استبدال |
| `dependencies.py` | استبدال |
| `main.py` | استبدال |
| `models.py` | استبدال |
| `schemas.py` | استبدال |
| `security.py` | استبدال |
| `init_db.py` | استبدال |
| `routers/auth.py` | استبدال |
| `routers/profile.py` | استبدال |
| `routers/chat.py` | اتركي الموجود عندك كما هو، أو قارنيه بالنسخة المرفقة؛ النسخة المرفقة هي نفس الكود الذي أرسلتيه |
| `routers/users.py` | اتركيه كما هو |

لا تستبدلي `venv/` ولا `.env` ولا قاعدة البيانات. انسخي `.env.example` إلى ملف مرجعي فقط، ولا تنقلي قيمه فوق `.env` الحقيقي.

## تعديل ملف .env عندك

أضيفي إلى `.env` الحالي، مع الاحتفاظ بقيمة `DATABASE_URL` الحالية:

```env
SECRET_KEY=ضعِي_هنا_قيمة_عشوائية_طويلة
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
GOOGLE_CLIENT_ID=
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
```

إذا كان عندك بالفعل `JWT_SECRET_KEY` بدلاً من `SECRET_KEY`، يمكن تركه؛ الكود يدعمه. يفضّل توحيده لاحقاً إلى `SECRET_KEY`.

## التشغيل

من داخل فولدر الباك وبعد تفعيل البيئة الافتراضية الموجودة عندك:

```bash
pip install -r requirements.txt
python init_db.py
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

اختبري:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/docs
```

## ملاحظة عن التوكنات القديمة

النسخة الجديدة تضع `user.id` داخل JWT بدلاً من البريد، حتى يكون التحقق موحداً بين Authentication والـ Chat. لذلك بعد استبدال الملفات، سجّلي الدخول مرة أخرى للحصول على توكن جديد. لا تحتاجين إلى حذف المستخدمين أو قاعدة البيانات.

## نتيجة الاختبار

تم تشغيل اختبارات التكامل على نسخة SQLite مؤقتة، ونجحت اختبارات التسجيل، تسجيل الدخول، قراءة وتعديل البروفايل، Emergency Contact، ومنشئ Chat Session وقراءة جلسات Chat: **2 passed**.
