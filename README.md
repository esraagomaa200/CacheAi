# NajdaAI

**AI-powered medical triage assistant for stroke, chest/heart, and breathing emergencies — with Egyptian Arabic conversation, source-cited answers, and a simulated emergency escalation flow.**

> Engineering codename: `CacheAi`. The product name shown throughout the UI is **NajdaAI** ("نجدة" — Arabic for "help/rescue").

NajdaAI helps a user describe symptoms in plain Egyptian Arabic (or English), get a cautious, source-grounded triage response, and — if the situation looks dangerous — walk through a timed emergency flow that would notify their emergency contact. It focuses deliberately on three time-critical conditions where fast recognition saves lives: **stroke**, **chest / heart symptoms**, and **breathing problems**.

---

## Table of contents

- [Focus conditions](#focus-conditions)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Medical knowledge base & citations](#medical-knowledge-base--citations)
- [Safety](#safety)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Project structure](#project-structure)

---

## Focus conditions

| Condition | Why it's time-critical |
|---|---|
| 🧠 **Stroke** | FAST warning signs (Face, Arms, Speech, Time) — treatment window is minutes to hours. |
| ❤️ **Chest / heart symptoms** | Heart attack signs are often dismissed or misread; early ambulance contact changes outcomes. |
| 🫁 **Breathing problems** | Severe shortness of breath, asthma attacks, and choking can escalate within minutes. |

---

## Features

All items below are implemented and working end-to-end in this build.

**Authentication & profile**
- Email/password sign-up and login (JWT access tokens)
- Google Sign-In (Google Identity Services, verified server-side)
- Patient profile: date of birth, gender, blood type, chronic conditions
- Emergency contact management (name, phone, email)

**AI medical chat**
- Free-form chat in Egyptian Arabic by default; mirrors the user's language if they write in English
- Retrieval-Augmented Generation (RAG) over a curated medical corpus — the model grounds its answers in retrieved passages instead of relying purely on parametric knowledge
- Every assistant answer that used retrieved material shows clickable **source citation chips** (organization + document title, linking to the original source)
- Persistent chat history — sessions are saved and can be reopened from the sidebar
- Risk level is computed for every assistant turn (`low` / `moderate` / `high` / `emergency`)

**Voice input**
- Microphone button using the Web Speech API, configured for Egyptian Arabic (`ar-EG`), with live interim transcription into the message box
- Automatically hidden on browsers that don't support the API

**Emergency mode**
- Dedicated emergency chat mode with a persistent risk-level banner
- When the AI assesses `high` or `emergency` risk, a **60-second countdown** appears with an "أنا بخير ✅" ("I'm OK") button
- If the user confirms they're OK, the event is marked resolved
- If the countdown reaches zero, the flow **escalates**: the UI shows a card announcing that the user's registered emergency contact is being notified (see [Safety](#safety) — this notification is simulated)
- Full **emergency event history**: every emergency session is logged with its condition, risk level, timer, response time, and final status

---

## Architecture

```
                         ┌───────────────────────┐
                         │        Browser         │
                         │  React + Vite + Tailwind│
                         └───────────┬────────────┘
                                     │ REST / JSON (JWT bearer)
                                     ▼
                         ┌───────────────────────┐
                         │        FastAPI          │
                         │  auth · profile · chat  │
                         │      · emergency         │
                         └───────┬───────┬─────────┘
                                 │       │
                 ┌───────────────┘       └───────────────┐
                 ▼                                        ▼
      ┌─────────────────────┐                  ┌───────────────────────┐
      │      PostgreSQL       │                  │     Gemini Agent       │
      │   (Neon, or SQLite    │                  │  gemini-2.5-flash       │
      │    fallback locally)  │                  │  single structured-JSON │
      │                        │                  │  call: answer + risk +  │
      │  users, profiles,      │                  │  condition + citations  │
      │  chat sessions,        │                  └───────────┬────────────┘
      │  messages, emergency   │                              │
      │  events                │                              ▼
      └─────────────────────┘                  ┌───────────────────────┐
                                                 │        Qdrant           │
                                                 │  local embedded mode    │
                                                 │  medical_docs collection │
                                                 │  768-dim cosine vectors  │
                                                 │  (gemini-embedding-001) │
                                                 └───────────────────────┘
```

Request flow for a chat message: the frontend calls `POST /chat/sessions/{id}/messages` → the backend loads the patient profile and recent history from PostgreSQL → retrieves the top-k relevant chunks from Qdrant → sends one structured-JSON request to Gemini with the profile, history, and retrieved sources → stores the assistant reply (with its risk level and cited sources) back to PostgreSQL → returns it to the frontend, updating the emergency event if the session is in emergency mode.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic |
| Database | PostgreSQL (Neon, serverless) — falls back to SQLite when `DATABASE_URL` isn't set |
| Vector store | Qdrant, embedded local mode (no Docker, no cloud service) |
| LLM | Google Gemini `gemini-2.5-flash` via the `google-genai` SDK |
| Embeddings | `gemini-embedding-001`, 768 dimensions, cosine distance |
| Auth | JWT (python-jose) + bcrypt password hashing, Google Sign-In (ID token verification) |
| Voice input | Web Speech API (`webkitSpeechRecognition`, `lang: ar-EG`) |
| Testing | pytest + httpx |

---

## Medical knowledge base & citations

The RAG corpus lives in `backend/corpus/` as 14 curated Markdown documents, each with YAML frontmatter (`title`, `org`, `url`, `condition`, `lang`) and a condensed, faithfully-summarized body sourced from public guidance published by:

- **World Health Organization (WHO)**
- **American Heart Association / American Stroke Association (AHA/ASA)**
- **NHS (UK National Health Service)**
- **CDC (US Centers for Disease Control and Prevention)**

Coverage: stroke warning signs and risk factors, chest pain / heart attack symptoms and first aid, asthma attacks, choking first aid, COPD/shortness of breath, and Egypt-specific emergency numbers and when-to-call guidance. **Three documents are written in Arabic** so that Arabic-language queries retrieve naturally in the same language, without relying on translation at query time.

At ingest time (`python -m ai.ingest`), each document is chunked (~1,500 characters with 200-character overlap, on paragraph boundaries), embedded with `gemini-embedding-001`, and upserted into the local Qdrant `medical_docs` collection.

At answer time, the agent retrieves the top 4 relevant chunks, labels them `[1]`–`[4]` in the prompt, and asks Gemini to return which sources it actually used. **Every AI answer that draws on the corpus displays its sources as clickable citation chips** (`📚 {organization} — {title}`) linking back to the original publication — this is deliberate: a medical assistant's claims should be traceable, not just stated.

---

## Safety

This project is a **triage aid, not a diagnostic tool**, and that boundary is enforced at the prompt level, not just described in this document:

- The system prompt explicitly forbids definitive diagnosis language ("you have a stroke"); the model is instructed to describe symptom patterns and their possible severity instead, and to always recommend professional evaluation.
- For any recognized high-risk pattern (FAST stroke signs, chest pain radiating to the arm/jaw with sweating or breathlessness, sudden severe difficulty breathing, loss of consciousness), the assistant is instructed to state the risk clearly and recommend calling emergency services immediately — **Egypt's ambulance number, 123** — without burying that advice at the end of a long reply.
- If the Gemini call or the retrieval step fails for any reason, the backend never returns a 500 error to the user. It returns a fixed, safe fallback message advising the user to call **123** if symptoms are severe, with `risk_level="moderate"` and no fabricated sources.
- **The emergency escalation is simulated.** When the 60-second countdown expires, the app displays a card stating that the registered emergency contact is being notified. No real SMS, phone call, or third-party emergency-services integration is triggered — this is intentionally out of scope for a demo build and would require a licensed telephony/SMS provider and explicit user consent in a production version.

---

## Getting started

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Gemini API key ([Google AI Studio](https://aistudio.google.com/))
- (Optional) A Postgres connection string (e.g. from [Neon](https://neon.tech/)) — otherwise the backend falls back to a local SQLite file automatically

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
# Optional — omit to use a local SQLite fallback (sqlite:///./cacheai.db)
DATABASE_URL=postgresql://user:password@host/dbname

# Required — JWT signing secret
SECRET_KEY=replace-with-a-long-random-string

# Required for Google Sign-In
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com

# Required for chat/RAG — never commit this value
GEMINI_API_KEY=your-gemini-api-key
```

Build the vector index once (reads `backend/corpus/*.md`, embeds, and upserts into the local Qdrant collection):

```bash
python -m ai.ingest
```

Run the API:

```bash
uvicorn main:app --reload
```

The backend serves at `http://127.0.0.1:8000` (docs at `/docs`).

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

```bash
npm run dev
```

The app serves at `http://localhost:5173`.

---

## Testing

```bash
cd backend
pytest
```

Backend tests exercise the FastAPI app via `httpx` (see `backend/tests/`).

---

## Project structure

```
backend/
  ai/            agent.py (Gemini orchestration), rag.py (Qdrant + embeddings),
                 prompts.py, ingest.py (corpus indexing CLI)
  corpus/        14 curated Markdown medical documents (WHO / AHA / NHS / CDC)
  routers/       auth, chat, emergency, profile
  models.py      SQLAlchemy models
  main.py        FastAPI app entrypoint
  tests/         pytest suite

frontend/
  src/pages/     Chat, Login, SignUp, Profile, EditProfile, EmergencyAuth, Home
  src/components/ SideBar, EmergencyMode, and shared UI
  src/lib/api.js  fetch helpers + auth token storage
```
