from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, ChatSession
from routers.auth import get_current_user


router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


# ==========================================
# Create Chat Session
# ==========================================

@router.post("/sessions")
def create_chat_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    chat_session = ChatSession(
        user_id=current_user.id,
        title="New Chat",
        chat_type="normal"
    )

    db.add(chat_session)
    db.commit()
    db.refresh(chat_session)

    return {
        "message": "Chat session created successfully",
        "session": {
            "id": chat_session.id,
            "title": chat_session.title,
            "chat_type": chat_session.chat_type,
            "created_at": chat_session.created_at
        }
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
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Chat session not found"
        )

    return {
        "id": session.id,
        "title": session.title,
        "chat_type": session.chat_type,
        "created_at": session.created_at,
        "updated_at": session.updated_at
    }