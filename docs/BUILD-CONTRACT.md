# CacheAi Sprint Contract — 2026-08-19 (deadline 22:00 tonight)

This is the single source of truth for tonight's build. Every agent builds EXACTLY to this
contract. Do not invent endpoints, fields, or names not listed here.

## 0. Stack decisions (final)
- LLM: **Google Gemini** via the `google-genai` Python SDK (`from google import genai`).
  - Chat model: `gemini-2.5-flash`
  - Embeddings: `gemini-embedding-001`, `output_dimensionality=768`
  - API key from env var `GEMINI_API_KEY` (backend/.env — NEVER hardcode, NEVER print).
- Vector DB: **Qdrant local mode** — `QdrantClient(path=str(BASE_DIR / "qdrant_data"))`.
  No docker, no cloud. Collection name: `medical_docs`, vector size 768, cosine distance.
- DB: existing SQLAlchemy setup. FIX: `DATABASE_URL` scheme must be rewritten
  `postgresql://` → `postgresql+psycopg://` at load time in `database.py` (code-level fix so
  the committed .env format keeps working). If `DATABASE_URL` is missing → fallback
  `sqlite:///./cacheai.db` so the demo can always run offline.
- Language: assistant replies in **Egyptian Arabic** by default; mirror the user's language
  if they write in English. Answers must be cautious/triage-style, never diagnosis claims,
  always advise seeing a doctor for high-risk signs.

## 1. DB model additions (backend/models.py — additive only, keep existing tables)
### `messages` — add columns
- `sources` PortableJSON nullable — list of `{"title": str, "org": str, "url": str}`
- `risk_level` String(20) nullable — one of `low|moderate|high|emergency` (assistant msgs in
  emergency sessions only; null otherwise)

### new table `emergency_events`
- id (pk), user_id (fk users.id), chat_session_id (fk chat_sessions.id)
- condition String(50) nullable        # stroke | chest_heart | breathing | unknown
- risk_level String(20) default "low"
- started_at DateTime (server default now)
- timer_seconds Integer default 60
- responded_at DateTime nullable
- escalation_status String(30) default "monitoring"
  # monitoring → alert_pending → resolved | escalated
- resolved_at DateTime nullable

Update `migrate_schema.py` COLUMN_DEFINITIONS so existing DBs get the new columns, and
ensure `Base.metadata.create_all` covers the new table (init_db.py already imports models).

## 2. Backend API (exact shapes)
### PATCH to existing: `POST /chat/sessions`
Body: `{"title": str|null, "chat_type": "normal"|"emergency"}` (chat_type optional,
default "normal"). If `chat_type == "emergency"`: also create an `emergency_events` row
(status "monitoring") and include it in the response as `"emergency_event"`.

### NEW `POST /chat/sessions/{session_id}/messages`  (auth required, owner only)
Body: `{"content": str}`
Server flow:
1. Save user Message (sender="user").
2. Build context: patient profile summary (name, age from DOB, gender, blood type,
   chronic_conditions, emergency contact name) + last 10 messages of this session.
3. Call the agent (section 3).
4. Save assistant Message (sender="assistant", content, sources, risk_level).
5. If session is emergency AND risk_level in ("high","emergency"): set the session's
   emergency_event `risk_level`, `condition`, and `escalation_status="alert_pending"`.
6. If this was the first user message and session title is null/"New chat": set title to
   first 40 chars of the user message.
Response 200:
```json
{
  "user_message":      {"id":1,"sender":"user","content":"...","created_at":"..."},
  "assistant_message": {"id":2,"sender":"assistant","content":"...",
                        "sources":[{"title":"...","org":"WHO","url":"..."}],
                        "risk_level":"high","created_at":"..."},
  "emergency_event":   { ...full event or null... }
}
```

### NEW `GET /chat/sessions/{session_id}/messages` → `{"messages":[...same shape...]}`

### NEW router `backend/routers/emergency.py`, prefix `/emergency` (auth required)
- `POST /emergency/events/{event_id}/respond`  → user tapped "أنا بخير":
  set responded_at=now, escalation_status="resolved", resolved_at=now. Return event.
- `POST /emergency/events/{event_id}/escalate` → timer expired:
  set escalation_status="escalated". Return
  `{"event": {...}, "emergency_contact": {"name":..,"phone":..,"email":..} | null}`
  (contact from the user's EmergencyContact row; escalation is SIMULATED — we display the
  contact being notified, we do not actually send SMS).
- `GET /emergency/events` → `{"events":[...]}` newest first (history).

Wire the new router in `main.py`.

## 3. Agent (backend/ai/ package — files: __init__.py, prompts.py, rag.py, agent.py, ingest.py)
`agent.py :: answer(user_content, history, profile_ctx, chat_type) -> dict`
Single Gemini call design (fast + reliable for tonight):
1. `rag.search(user_content, k=4)` → chunks with metadata. Skip retrieval only for pure
   small-talk (heuristic: greeting-only messages).
2. One `gemini-2.5-flash` call with a system prompt (prompts.py) that includes: role
   (medical triage assistant for stroke/heart/breathing, Egyptian Arabic), the profile
   context, retrieved chunks labeled [1]..[4] with title/org, and instructions to return
   STRICT JSON: `{"answer": str, "used_sources": [1,3], "risk_level": "low|moderate|high|emergency",
   "condition": "stroke|chest_heart|breathing|unknown"}`.
   Use `response_mime_type="application/json"` for enforced JSON.
3. Map used_sources indices → sources list (dedupe by title). risk_level only meaningful
   for emergency sessions but always computed.
4. On ANY Gemini/RAG exception: return a safe fallback answer (Arabic: "حصلت مشكلة تقنية،
   لو الأعراض شديدة اتصل بالإسعاف 123") with sources=[], risk_level="moderate". NEVER 500.

`rag.py`: lazy singleton QdrantClient + embed helper (gemini-embedding-001, 768 dims,
task_type RETRIEVAL_QUERY for queries / RETRIEVAL_DOCUMENT for ingest).

`ingest.py` (CLI: `python -m ai.ingest`): read `backend/corpus/*.md`. Each file has YAML
frontmatter: `title`, `org`, `url`, `condition`, `lang`. Chunk body ~1500 chars with 200
overlap on paragraph boundaries. Embed + upsert to `medical_docs` with payload
`{title, org, url, condition, text}`. Idempotent: recreate collection on each run.
Print per-file chunk counts and total at the end.

`requirements.txt` additions: `google-genai`, `qdrant-client`.

## 4. Frontend contract
API base stays `lib/api.js` `apiFetch`. New helpers in lib/api.js (owned by chat agent):
`createSession(chatType)`, `listSessions()`, `getMessages(sessionId)`,
`sendMessage(sessionId, content)`, `respondEvent(eventId)`, `escalateEvent(eventId)`,
`listEmergencyEvents()`.

### Chat.jsx (full rewrite, keep visual style/classes)
- On mount: if `?session=<id>` load its messages; else lazily create session on first send.
  Read `?mode=emergency` → create session with chat_type="emergency".
- Real input state, Enter-to-send, send button onClick, loading indicator (typing dots),
  auto-scroll. Messages render with `dir="auto"`; container RTL-friendly.
- Assistant bubbles: render `sources` as small chips under the bubble: `📚 {org} — {title}`
  (clickable → url, target _blank). If risk_level high/emergency in emergency mode, show a
  red risk banner above the input.
- **Voice input**: mic button using Web Speech API (`webkitSpeechRecognition`), `lang:
  "ar-EG"`, interim results into the input field. Hide button if API unsupported.
- Emergency mode extras (rendered inside Chat when mode=emergency):
  - Sticky header strip: "🚨 وضع الطوارئ" + risk level badge.
  - When emergency_event.escalation_status === "alert_pending": show 60s countdown + big
    "أنا بخير ✅" button (→ respondEvent) ; countdown hitting 0 → escalateEvent, then show
    "📞 جاري إبلاغ {contact.name} — {contact.phone}" card.
- SideBar "Chat History": fetch listSessions(), render clickable list →
  `/chat?session=<id>`; "New Chat" → `/chat`.

### Auth/routes agent (separate files — do NOT touch Chat.jsx, EmergencyMode.jsx, SideBar.jsx, lib/api.js)
- Create proper `src/pages/Login.jsx` (email/password → POST /auth/login via apiFetch,
  setAccessToken, navigate /profile; + Google Sign-In button reusing the GSI pattern from
  EmergencyAuth.jsx but reading client id from `import.meta.env.VITE_GOOGLE_CLIENT_ID` with
  the current literal as fallback). Delete the old `src/pages/Login .jsx` (space filename).
- Register `/login` route in App.jsx. Add catch-all `*` route → redirect to `/`.
- Fix dead links: SignupFormFields "Sign in" → /login; SidebarProfile items for
  /health-records /appointments /medications /settings → remove those items entirely;
  keep Profile & Edit Profile links. Header anchor links → point to `/` sections or remove.
- Delete `src/firebase.js` and remove `firebase` from package.json dependencies.
- Fix `index.html` favicon href case → `/Logo2.png`.
- Wire About page OR leave unrouted — leave unrouted (out of scope tonight).

## 5. Corpus (backend/corpus/*.md — content agent)
12–15 files across the 3 conditions (stroke, chest_heart, breathing) + 2 general
(emergency numbers Egypt = 123 ambulance, when to call). Sources: WHO, AHA/ASA, NHS, CDC —
fetch REAL content from their public pages, condense faithfully (no invention), keep
medical facts verbatim where possible. Each file:
```
---
title: Stroke Warning Signs (FAST)
org: American Stroke Association
url: https://www.stroke.org/...
condition: stroke
lang: en
---
<clean markdown body, 300-900 words>
```
Include 2-3 files translated/written in Arabic (lang: ar) so Arabic retrieval works too.
File naming: `stroke-01-warning-signs.md` etc.

## 6. Out of scope tonight (do NOT build)
Notifications/scheduler, medications table, dark mode, appointments, real SMS/calls,
Alembic, refresh tokens, About page routing.

## 7. Env (سبوكي adds manually — agents NEVER write or read values aloud)
```
GEMINI_API_KEY=<his key>          # backend/.env
```
