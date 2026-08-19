from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import EmergencyContact, EmergencyEvent, User
from routers.auth import get_current_user


router = APIRouter(
    prefix="/emergency",
    tags=["Emergency"]
)


# ==========================================
# Helpers
# ==========================================

def _get_owned_event(event_id: int, db: Session, current_user: User) -> EmergencyEvent:
    event = db.query(EmergencyEvent).filter(
        EmergencyEvent.id == event_id,
        EmergencyEvent.user_id == current_user.id
    ).first()

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Emergency event not found"
        )
    return event


def _serialize_event(event: EmergencyEvent) -> dict:
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


# ==========================================
# "I'm OK" — user responded before the timer expired
# ==========================================

@router.post("/events/{event_id}/respond")
def respond_to_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = _get_owned_event(event_id, db, current_user)

    now = datetime.utcnow()
    event.responded_at = now
    event.escalation_status = "resolved"
    event.resolved_at = now

    db.commit()
    db.refresh(event)

    return _serialize_event(event)


# ==========================================
# Escalate — timer expired, notify the emergency contact (simulated)
# ==========================================

@router.post("/events/{event_id}/escalate")
def escalate_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = _get_owned_event(event_id, db, current_user)

    event.escalation_status = "escalated"

    db.commit()
    db.refresh(event)

    contact = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == current_user.id
    ).first()

    emergency_contact = None
    if contact:
        emergency_contact = {
            "name": contact.name,
            "phone": contact.phone,
            "email": contact.email,
        }

    return {
        "event": _serialize_event(event),
        "emergency_contact": emergency_contact
    }


# ==========================================
# History
# ==========================================

@router.get("/events")
def list_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    events = db.query(EmergencyEvent).filter(
        EmergencyEvent.user_id == current_user.id
    ).order_by(EmergencyEvent.id.desc()).all()

    return {"events": [_serialize_event(event) for event in events]}
