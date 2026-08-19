from datetime import date

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ai.agent import answer as agent_answer
from database import get_db
from models import ChatSession, EmergencyContact, EmergencyEvent, Message, PatientProfile, User
from routers.auth import get_current_user
from schemas import ChatSessionCreateRequest, SendMessageRequest


router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


TITLE_PREVIEW_LENGTH = 40
HISTORY_LIMIT = 10
ALERT_RISK_LEVELS = {"high", "emergency"}


# ==========================================
# Helpers
# ==========================================

def _get_owned_session(session_id: int, db: Session, current_user: User) -> ChatSession:
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Chat session not found"
        )
    return session


def _latest_event(session_id: int, db: Session) -> EmergencyEvent | None:
    return db.query(EmergencyEvent).filter(
        EmergencyEvent.chat_session_id == session_id
    ).order_by(EmergencyEvent.id.desc()).first()


def _serialize_event(event: EmergencyEvent | None) -> dict | None:
    if event is None:
        return None
    return {
        "id": event.id,
        "user_id": event.user_id,
        "chat_session_id": event.chat_session_id,
        "condition": event.condition,
        "risk_level": event.risk_level,
        "started_at": event.started_at,
        "timer_seconds": event.timer_seconds,
        "responded_at": event.responded_at,
        "escalation_status": event.escalation_status,
        "resolved_at": event.resolved_at,
    }


def _serialize_message(message: Message) -> dict:
    return {
        "id": message.id,
        "sender": message.sender,
        "content": message.content,
        "sources": message.sources or [],
        "risk_level": message.risk_level,
        "created_at": message.created_at,
    }


def _profile_context(current_user: User, db: Session) -> dict:
    patient = db.query(PatientProfile).filter(
        PatientProfile.user_id == current_user.id
    ).first()
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == current_user.id
    ).first()

    age = None
    if patient and patient.date_of_birth:
        dob = patient.date_of_birth
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    return {
        "name": current_user.name,
        "age": age,
        "gender": patient.gender if patient else None,
        "blood_type": patient.blood_type if patient else None,
        "chronic_conditions": (
            patient.chronic_conditions if patient and patient.chronic_conditions else []
        ),
        "emergency_contact_name": contact.name if contact else None,
    }


def _is_untitled(title: str | None) -> bool:
    return title is None or title.strip().lower() in ("", "new chat")


# ==========================================
# Create Chat Session
# ==========================================

@router.post("/sessions")
def create_chat_session(
    data: ChatSessionCreateRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    payload = data or ChatSessionCreateRequest()

    default_title = "محادثة طوارئ 🚨" if payload.chat_type == "emergency" else None
    chat_session = ChatSession(
        user_id=current_user.id,
        title=payload.title or default_title,
        chat_type=payload.chat_type
    )
    db.add(chat_session)
    db.flush()

    emergency_event = None
    if payload.chat_type == "emergency":
        emergency_event = EmergencyEvent(
            user_id=current_user.id,
            chat_session_id=chat_session.id,
            escalation_status="monitoring"
        )
        db.add(emergency_event)
        db.flush()

    db.commit()
    db.refresh(chat_session)
    if emergency_event:
        db.refresh(emergency_event)

    return {
        "message": "Chat session created successfully",
        "session": {
            "id": chat_session.id,
            "title": chat_session.title,
            "chat_type": chat_session.chat_type,
            "created_at": chat_session.created_at
        },
        "emergency_event": _serialize_event(emergency_event)
    }


# ==========================================
# Get My Chat Sessions
# ==========================================

@router.get("/sessions")
def get_my_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id
    ).order_by(
        ChatSession.updated_at.desc()
    ).all()

    return {
        "sessions": [
            {
                "id": session.id,
                "title": session.title,
                "chat_type": session.chat_type,
                "created_at": session.created_at,
                "updated_at": session.updated_at
            }
            for session in sessions
        ]
    }


# ==========================================
# Get One Chat Session
# ==========================================

@router.get("/sessions/{session_id}")
def get_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = _get_owned_session(session_id, db, current_user)

    return {
        "id": session.id,
        "title": session.title,
        "chat_type": session.chat_type,
        "created_at": session.created_at,
        "updated_at": session.updated_at
    }


# ==========================================
# Send a Message (user turn -> assistant turn)
# ==========================================

@router.post("/sessions/{session_id}/messages")
def send_message(
    session_id: int,
    data: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = _get_owned_session(session_id, db, current_user)

    # 1. Save the user's message.
    user_message = Message(
        chat_session_id=session.id,
        sender="user",
        content=data.content
    )
    db.add(user_message)
    db.flush()

    is_first_user_message = db.query(Message).filter(
        Message.chat_session_id == session.id,
        Message.sender == "user"
    ).count() == 1

    # 2. Build context: patient profile summary + last N messages.
    profile_ctx = _profile_context(current_user, db)
    history_rows = db.query(Message).filter(
        Message.chat_session_id == session.id
    ).order_by(Message.id.desc()).limit(HISTORY_LIMIT).all()
    history = [
        {"sender": row.sender, "content": row.content}
        for row in reversed(history_rows)
    ]

    # 3. Call the agent. agent.answer() never raises — it returns a safe
    # fallback dict on any Gemini/RAG failure.
    result = agent_answer(data.content, history, profile_ctx, session.chat_type)

    # 4. Save the assistant's message.
    assistant_message = Message(
        chat_session_id=session.id,
        sender="assistant",
        content=result["content"],
        sources=result["sources"],
        risk_level=result["risk_level"]
    )
    db.add(assistant_message)

    # 5. Emergency escalation bookkeeping.
    event = None
    if session.chat_type == "emergency":
        event = _latest_event(session.id, db)
        if (
            event is not None
            and result["risk_level"] in ALERT_RISK_LEVELS
            and event.escalation_status in ("monitoring", "alert_pending")
        ):
            event.risk_level = result["risk_level"]
            event.condition = result["condition"]
            event.escalation_status = "alert_pending"

    # 6. Auto-title the session from the first user message.
    if is_first_user_message and _is_untitled(session.title):
        session.title = data.content[:TITLE_PREVIEW_LENGTH]

    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)
    if event is not None:
        db.refresh(event)

    return {
        "user_message": _serialize_message(user_message),
        "assistant_message": _serialize_message(assistant_message),
        "emergency_event": _serialize_event(event)
    }


# ==========================================
# Get Messages for a Session
# ==========================================

@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = _get_owned_session(session_id, db, current_user)

    messages = db.query(Message).filter(
        Message.chat_session_id == session.id
    ).order_by(Message.id.asc()).all()

    return {"messages": [_serialize_message(message) for message in messages]}


# ==========================================
# Text-to-Speech (Egyptian Arabic via Gemini Live API)
# ==========================================

@router.post("/tts")
def synthesize_speech(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user)
):
    """Speak an assistant reply out loud — used by the voice-conversation
    mode in the chat UI. Returns audio/wav (PCM 24kHz mono) or 503 when
    synthesis is unavailable (frontend degrades to silent text)."""
    from fastapi import Response

    from ai import tts

    text = str(data.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="text is required")

    # Keep utterances bounded — long clinical answers get their lead-in only.
    wav = tts.synthesize(text[:600])
    if not wav:
        raise HTTPException(status_code=503, detail="TTS unavailable")

    return Response(content=wav, media_type="audio/wav")
