# CacheAi
An AI-powered medical chatbot that helps users understand their symptoms through natural language and voice interaction, with support for Egyptian Arabic and intelligent medical information retrieval.

أيوه، دلوقتي نقدر **نثبت الـ scope** ونبدأ Backend + Database من غير ما نرجع نغيّر الـ schema كل شوية.

بما إن المشروع مركز على **Stroke + Chest/Heart symptoms + Breathing problems**، فأنا أنصحكم تعملوا الـ MVP بالشكل ده:

## 1. الـ Features الأساسية — دي لازم تتعمل

### 👤 Authentication

* Sign up / Login   done
* Google Login      done
* JWT/session       done
* Patient profile   done 
* Emergency contact  done

### 🤖 AI Medical Chat

* Chat عادي
* Chat history
* الـ AI يستخدم الـ RAG بتاعكم
* Qdrant للـ medical knowledge
* الـ Agent يقرر إمتى يستخدم retrieval / tools
* **Source citations** مع إجابة الـ AI

مثلاً:

> Possible causes...
> **Sources:** WHO guideline, STEMI guideline...

وده Feature مهم جدًا في مشروع طبي.

---

### 🚨 Emergency Chat

ده يبقى Mode مختلف:

```text
Normal Chat
      │
      └── Emergency Chat
              │
              ├── Timer
              ├── Symptoms
              ├── Risk assessment
              ├── Emergency contact
              └── Escalation
```

والـ Emergency Chat **يتطلب Authentication** زي ما قلتي.

مهم: في المشروع نقدر نعمل **escalation workflow**، لكن ما نعتمدش على إن النظام يتصل بالإسعاف تلقائيًا في الواقع بدون integration/سياسة واضحة وموافقة المستخدم.

---

### 🔔 Smart Notifications

دي من أقوى الـ features عندكم.

مثلاً:

```text
Patient condition:
Stroke risk

       ↓

Scheduled reminder

       ↓

Patient doesn't respond

       ↓

Escalation

       ↓

Emergency contact
```

والـ notification تكون حسب condition.

---

### 🩺 Disease-specific support

بدل ما الـ AI يكون Medical Chatbot عام فقط:

```text
Stroke
Chest / Heart
Breathing
```

كل واحدة لها:

* symptoms
* risk indicators
* reminders
* emergency flow
* relevant medical documents
* sources

وده هيخلي المشروع واضح جدًا في الـ demo.

---

# 2. Features أنصح تضيفوها لأنها ترفع قيمة المشروع

### ⭐ A. Patient Medical Profile

خلو المستخدم يسجل:

```text
Blood type
Chronic conditions
Medications
Allergies
Emergency contact
```

**الأدوية والحساسيات بالذات مهمين** لو الـ AI هيستخدم patient context.

---

### ⭐ B. Symptom Assessment

قبل الـ AI أو داخل Emergency Mode:

```text
What are you experiencing?

Chest pain
Difficulty breathing
Weakness
Speech difficulty
Dizziness
...
```

وبناءً عليها النظام يعمل **risk classification**:

```text
LOW
MODERATE
HIGH / EMERGENCY
```

مش تشخيص طبي، وإنما triage/risk escalation.

---

### ⭐ C. Emergency Event History

كل Emergency Chat يتسجل:

```text
when started
symptoms
risk level
timer
user response
escalation status
```

وده ممتاز جدًا للـ demo والـ backend architecture.

---

### ⭐ D. Sources

كل response من الـ RAG يرجع:

```json
{
  "answer": "...",
  "sources": [
    {
      "title": "WHO Framework...",
      "page": 21
    }
  ]
}
```

دي مهمة جدًا لأن مشروعكم Medical AI.

---

### ⭐ E. Dark Mode

دي **Frontend feature**، مش محتاجة Database.

---

# 3. حاجات لا أنصح بها دلوقتي

بما إن الوقت قليل، **ما تدخلّوش في**:

* Doctor marketplace
* Video calls
* Full hospital management system
* Appointment booking
* Payment
* Huge medical records system
* Wearable integration
* Real ambulance API integration

دي هتضيع وقتكم.

---

# 4. الـ Database النهائية

أنا أعملها كده:

```text
users
│
├── patient_profiles
│
├── emergency_contacts
│
├── patient_conditions
│
├── medications
│
├── chat_sessions
│      │
│      └── messages
│
├── emergency_events
│
└── notifications
```

وفي ناحية الـ AI:

```text
                    FastAPI
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
     PostgreSQL      Agent        Qdrant
          │            │            │
      User data      LLM        Embeddings
      Chat history   Tools      Medical docs
      Alerts         RAG
```

---

# 5. Tables اللي أعتبرها Final

### `users`

```text
id
name
email
password_hash
auth_provider
provider_id
created_at
updated_at
```

### `patient_profiles`

```text
id
user_id
patient_id
blood_type
created_at
updated_at
```

### `patient_conditions`

بدل JSON، مع الـ 3 diseases بتوعكم أنا أفضل جدول:

```text
id
patient_id
condition
severity
diagnosed_at
created_at
```

مثلاً:

```text
stroke
chest_condition
breathing_condition
```

---

### `medications`

```text
id
patient_id
name
dosage
frequency
created_at
```

### `emergency_contacts`

```text
id
user_id
name
phone
email
relationship
```

---

### `chat_sessions`

```text
id
user_id
chat_type
title
created_at
updated_at
```

`chat_type`:

```text
normal
emergency
```

### `messages`

```text
id
chat_session_id
sender
content
created_at
```

ممكن:

```text
sender = user / assistant
```

---

### `emergency_events`

دي مهمة جدًا:

```text
id
user_id
chat_session_id
condition
risk_level
started_at
timer_seconds
responded_at
escalation_status
resolved_at
```

مثلاً:

```text
condition = breathing
risk_level = high
timer_seconds = 60
escalation_status = emergency_contact
```

---

### `notifications`

```text
id
user_id
condition
type
message
scheduled_at
sent_at
responded_at
status
```

مثلاً:

```text
type = medication_reminder
status = pending
```

---

# 6. والـ Sources؟

أنا **مش هحط الـ medical documents نفسها في PostgreSQL**.

لأن عندكم Qdrant.

يبقى:

```text
PostgreSQL
    │
    └── source metadata

Qdrant
    │
    ├── chunks
    ├── embeddings
    └── metadata
```

والـ metadata ممكن تحتوي:

```text
document_id
title
page
source
chunk_id
```

---

# 7. والـ Agent؟

الـ Agent مش Database.

هيبقى فوق الـ RAG:

```text
User
 ↓
FastAPI
 ↓
Agent
 ├── decide: normal/emergency
 ├── retrieve from Qdrant
 ├── get patient context from PostgreSQL
 ├── call LLM
 └── return answer + sources
```

---

# 8. يبقى الـ Architecture النهائية

```text
                    ┌─────────────┐
                    │   React     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   FastAPI   │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
      ┌────────────┐ ┌────────────┐ ┌───────────┐
      │ PostgreSQL │ │   Agent    │ │  Qdrant   │
      │            │ │            │ │           │
      │ Users      │ │ LLM        │ │ Documents │
      │ Profiles   │ │ RAG        │ │ Embeddings│
      │ Chats      │ │ Tools      │ │ Sources   │
      │ Alerts     │ └────────────┘ └───────────┘
      └────────────┘
```

## 🎯 إذن الـ Features النهائية اللي أبني عليها الـ Backend

**Must have:**

1. Authentication
2. Patient profile
3. Emergency contact
4. AI Chat
5. Chat history
6. RAG + Qdrant
7. Agent
8. Sources/citations
9. Emergency Chat + timer
10. Symptom assessment
11. Risk level
12. Disease-specific workflows:

* Stroke
* Chest/heart
* Breathing

13. Notifications/reminders
14. Escalation to emergency contact
15. Emergency event history

**Nice-to-have:**
16. Medications
17. Allergies
18. Dark mode
19. Voice input

**مش محتاجين أكتر من كده للـ MVP.**

وبالتالي **أيوه: PostgreSQL + Qdrant هو اختيار مناسب جدًا** للمشروع؛ PostgreSQL للـ structured/user/application data، وQdrant للـ vector retrieval. والأهم إننا دلوقتي نثبت الـ schema ده ثم نبني عليه FastAPI، بدل ما نبدأ كتابة endpoints وبعدين نكتشف إننا ناقصنا جداول للـ emergency والnotifications.
