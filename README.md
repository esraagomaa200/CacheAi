# NajdaAI

**AI-powered medical triage assistant for stroke, chest/heart, and breathing emergencies — with Egyptian Arabic conversation, source-cited answers, and a simulated emergency escalation flow.**

> Engineering codename: `CacheAi`. The product name shown throughout the UI is **NajdaAI** ("نجدة" — Arabic for "help/rescue").

NajdaAI helps a user describe symptoms in plain Egyptian Arabic (or English), get a cautious, source-grounded triage response, and — if the situation looks dangerous — walk through a timed emergency flow that would notify their emergency contact. It focuses deliberately on three time-critical conditions where fast recognition saves lives: **stroke**, **chest / heart symptoms**, and **breathing problems**. Deeper clinical questions (treatment protocols, drug doses) are answered with guideline-level precision by a dedicated retrieval engine, **NAJDA**, described below.

---

## Table of contents

- [Focus conditions](#focus-conditions)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Medical knowledge base & citations](#medical-knowledge-base--citations)
- [Retrieval & grounding engine (NAJDA)](#retrieval--grounding-engine-najda)
- [Model routing](#model-routing)
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
- A second, deeper retrieval engine (NAJDA — see below) answers clinical-protocol-level questions from a dedicated 9-document guideline knowledge base with a stricter grounding and refusal policy
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
- Full **emergency event history**: every emergency session is logged with its condition, risk level, timer, response time, and final status, viewable on its own `/emergency-history` page

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
      │   (Neon, or SQLite    │                  │  gemini-3.6-flash       │
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

A second, independent service — the **NAJDA retrieval engine** — runs alongside this stack (project root `app/`, its own Qdrant Cloud index, port `8001`) to answer deep clinical questions with stronger, guideline-level grounding than the lightweight corpus above. It exposes its own `POST /chat` endpoint and can be called directly. See [Retrieval & grounding engine (NAJDA)](#retrieval--grounding-engine-najda) and [Model routing](#model-routing).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic |
| Database | PostgreSQL (Neon, serverless) — falls back to SQLite when `DATABASE_URL` isn't set |
| Vector store (triage corpus) | Qdrant, embedded local mode (no Docker, no cloud service) |
| LLM — conversation & triage | Google Gemini `gemini-3.6-flash` via the `google-genai` SDK |
| LLM — deep clinical grounding | Groq (`openai/gpt-oss-120b`), via the NAJDA retrieval engine — see below |
| Embeddings (triage corpus) | `gemini-embedding-001`, 768 dimensions, cosine distance |
| Auth | JWT (python-jose) + bcrypt password hashing, Google Sign-In (ID token verification) |
| Voice input | Web Speech API (`webkitSpeechRecognition`, `lang: ar-EG`) |
| Testing | pytest + httpx |

> `gemini-2.5-flash` is no longer used: it 404s for newly-created Gemini API keys (Google migrated new projects to newer model IDs), so both the triage agent and the NAJDA query normalizer target `gemini-3.6-flash` instead (overridable via the `GEMINI_MODEL` env var).

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

This corpus is intentionally lightweight (short, condensed passages) so the conversational triage agent stays fast. For clinical-protocol-level detail, see the NAJDA engine below.

---

## Retrieval & grounding engine (NAJDA)

NAJDA is a teammate-built, independently evaluated retrieval pipeline that answers deep clinical questions — treatment protocols, drug doses, admission criteria — against full clinical guideline text rather than condensed summaries. It lives at the **project root**, not inside `backend/` (`app/`, `data/json_kb/`, `requirements.txt`), and runs as its own FastAPI service.

**Knowledge base:** 9 cleaned clinical guideline documents in `data/json_kb/`, covering WHO guidance, NICE guidelines (chest pain assessment, stroke/TIA diagnosis and initial management, respiratory infection assessment, ICU admission/discharge/triage), a STEMI guideline, an Ischemic Stroke Management guideline, and an acute coronary syndromes guideline.

**Pipeline:**

| Stage | How it works |
|---|---|
| Indexing (`app/build_index.py`) | Chunks the 9 source documents, embeds each chunk, upserts into Qdrant Cloud, builds a BM25 index, and runs KMeans topic clustering |
| Retrieval (`app/retrieval.py`) | Hybrid search — dense (Qdrant) + BM25 — fused with Reciprocal Rank Fusion (RRF), then re-ranked with a CrossEncoder |
| Arabic query handling | A hand-built Arabic→English clinical term-expansion dictionary, plus an optional Gemini query normalizer that converts an Egyptian-Arabic question into an English retrieval query and topic label — it only routes/classifies, it never answers or adds medical knowledge |
| Generation (`app/agent.py`) | Groq generates the answer strictly from the retrieved chunks, under a system prompt that forbids adding any fact not present in the retrieved context, requires a citation per medical claim (source file + page), and preserves drug names/doses/units verbatim |
| Safety gate | If no chunks are retrieved, or the top reranked score falls under a minimum threshold, the engine refuses with a fixed "not covered by the available sources" answer instead of letting the model guess |

| Component | Technology |
|---|---|
| Vector store | Qdrant Cloud — collection `najda_medical_chunks`, **prebuilt with 574 points** |
| Dense embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Lexical search | BM25 (`rank_bm25`) |
| Reranker | CrossEncoder `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` |
| Query normalizer | Gemini `gemini-3.6-flash` (Arabic → English, topic classification only) |
| Generator | Groq `openai/gpt-oss-120b` |

**Terms-compliance safety gate:** the competition Terms (clauses 4.1/4.2) require that answers stay grounded in approved sources and that out-of-scope questions get refused rather than answered from general knowledge. The safety gate above is what enforces that — ask it something outside the 9-document scope (e.g. diabetes management) and it declines instead of guessing.

Response shape: `{"answer": str, "sources": [{"source_file", "page_start", "page_end", "section", "score"}], "grounded": bool}`.

Full setup, indexing commands, reranker-threshold tuning notes, and the Arabic-retrieval test script are documented in **[docs/RAG-ENGINE.md](docs/RAG-ENGINE.md)**.

---

## Model routing

NajdaAI is designed to answer each question with the tier suited to its difficulty:

| Tier | Question type | Model | Serves it from |
|---|---|---|---|
| Small talk | Greetings, chit-chat | Groq `llama-3.1-8b-instant` | fast, no medical grounding needed |
| Symptom triage | Describing symptoms, emergency mode | Gemini `gemini-3.6-flash` + the 14-document corpus | `backend/` — `POST /chat/sessions/{id}/messages`, port `8000` |
| Deep clinical | Treatment protocols, drug doses, guideline detail | Groq `openai/gpt-oss-120b` + the 9-document guideline KB (NAJDA) | the NAJDA engine — `POST /chat`, port `8001` |

Risk classification (`risk_level` / `condition`) runs alongside the symptom-triage tier for every message in an emergency session, independent of which tier answers the clinical content.

> All three tiers are live: the backend routes each message with a zero-latency heuristic, runs risk classification in parallel with answer generation on the clinical tier, and gracefully falls back to the triage tier if the NAJDA engine is unreachable.

---

## Safety

This project is a **triage aid, not a diagnostic tool**, and that boundary is enforced at the prompt level, not just described in this document:

- The system prompt explicitly forbids definitive diagnosis language ("you have a stroke"); the model is instructed to describe symptom patterns and their possible severity instead, and to always recommend professional evaluation.
- For any recognized high-risk pattern (FAST stroke signs, chest pain radiating to the arm/jaw with sweating or breathlessness, sudden severe difficulty breathing, loss of consciousness), the assistant is instructed to state the risk clearly and recommend calling emergency services immediately — **Egypt's ambulance number, 123** — without burying that advice at the end of a long reply.
- If the Gemini call or the retrieval step fails for any reason, the backend never returns a 500 error to the user. It returns a fixed, safe fallback message advising the user to call **123** if symptoms are severe, with `risk_level="moderate"` and no fabricated sources.
- The NAJDA engine applies its own, stricter form of the same principle: it refuses rather than answers when a question falls outside its grounded sources (see [Retrieval & grounding engine (NAJDA)](#retrieval--grounding-engine-najda)).
- **The emergency escalation is simulated.** When the 60-second countdown expires, the app displays a card stating that the registered emergency contact is being notified. No real SMS, phone call, or third-party emergency-services integration is triggered — this is intentionally out of scope for a demo build and would require a licensed telephony/SMS provider and explicit user consent in a production version.

---

## Getting started

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Gemini API key ([Google AI Studio](https://aistudio.google.com/))
- (Optional) A Postgres connection string (e.g. from [Neon](https://neon.tech/)) — otherwise the backend falls back to a local SQLite file automatically
- (For the NAJDA engine) A Groq API key ([console.groq.com](https://console.groq.com)) and a Qdrant Cloud cluster URL/key ([cloud.qdrant.io](https://cloud.qdrant.io))

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

# Optional — override the Gemini model id (defaults to gemini-3.6-flash)
GEMINI_MODEL=gemini-3.6-flash
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

### NAJDA retrieval engine

A second, independent FastAPI service — it does **not** run inside `backend/`. It powers the deep-clinical tier described in [Retrieval & grounding engine (NAJDA)](#retrieval--grounding-engine-najda). From the **project root**:

```bash
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file **in the project root** (not `backend/.env`):

```env
GROQ_API_KEY=your-groq-api-key
QDRANT_URL=your-qdrant-cloud-cluster-url
QDRANT_API_KEY=your-qdrant-cloud-api-key
GEMINI_API_KEY=your-gemini-api-key
```

The knowledge base index is **prebuilt**: the Qdrant Cloud collection `najda_medical_chunks` (574 points, built from the 9 documents in `data/json_kb/`) already exists, so you don't need to re-run indexing to use the engine. Only re-index after changing a source document:

```bash
cd app
python ingest.py ../data/json_kb ../data/chunks.jsonl
python build_index.py ../data/chunks.jsonl ../data
```

Run the engine — use a different port than the main backend, which defaults to 8000:

```bash
cd app
uvicorn main:app --port 8001
```

Test it directly:

```bash
curl -X POST http://localhost:8001/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the initial management of STEMI?"}'
```

Full setup detail, reranker-threshold tuning guidance, and the Arabic-retrieval test are in **[docs/RAG-ENGINE.md](docs/RAG-ENGINE.md)**.

---

## Testing

```bash
cd backend
pytest
```

Backend tests exercise the FastAPI app via `httpx` (see `backend/tests/`). The NAJDA engine has its own Arabic-retrieval test — see [docs/RAG-ENGINE.md](docs/RAG-ENGINE.md).

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
  src/pages/     Chat, Login, SignUp, Profile, EditProfile, EmergencyAuth,
                 EmergencyHistory, Home
  src/components/ SideBar, EmergencyMode, and shared UI
  src/lib/api.js  fetch helpers + auth token storage

app/             NAJDA retrieval engine — main.py, retrieval.py, build_index.py,
                 ingest.py, agent.py (its own FastAPI service, port 8001)
data/json_kb/    9 cleaned clinical guideline source documents (WHO / NICE / STEMI /
                 Ischemic Stroke / ICU triage)
requirements.txt NAJDA engine's Python dependencies (root-level, separate from backend/)
docs/            DEMO-SCRIPT.md (judge demo walkthrough), RAG-ENGINE.md (engine deep-dive)
```
