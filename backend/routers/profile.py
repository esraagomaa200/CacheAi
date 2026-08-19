from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import EmergencyContact, PatientProfile, User
from schemas import EmergencyContactUpdate, ProfileUpdateRequest

router = APIRouter(prefix="/profile", tags=["Profile"])


def _profile_response(user: User, db: Session) -> dict:
    patient = db.query(PatientProfile).filter(
        PatientProfile.user_id == user.id
    ).first()
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == user.id
    ).first()

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "auth_provider": user.auth_provider,
        },
        "patient_profile": {
            "patient_id": patient.patient_id if patient else None,
            "date_of_birth": (
                patient.date_of_birth.isoformat()
                if patient and patient.date_of_birth
                else None
            ),
            "gender": patient.gender if patient else None,
            "blood_type": patient.blood_type if patient else None,
            "chronic_conditions": (
                patient.chronic_conditions
                if patient and patient.chronic_conditions
                else []
            ),
        },
        "emergency_contact": {
            "name": contact.name if contact else None,
            "phone": contact.phone if contact else None,
            "email": contact.email if contact else None,
        },
    }


def _get_or_create_patient(user: User, db: Session) -> PatientProfile:
    patient = db.query(PatientProfile).filter(
        PatientProfile.user_id == user.id
    ).first()
    if patient is None:
        patient = PatientProfile(user_id=user.id, chronic_conditions=[])
        db.add(patient)
        db.flush()
    return patient


def _upsert_contact(
    user: User,
    db: Session,
    data: EmergencyContactUpdate,
) -> EmergencyContact:
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == user.id
    ).first()
    if contact is None:
        contact = EmergencyContact(user_id=user.id)
        db.add(contact)

    if data.name is not None:
        contact.name = data.name
    if data.phone is not None:
        contact.phone = data.phone
    if data.email is not None:
        contact.email = str(data.email)
    return contact


@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _profile_response(current_user, db)


@router.put("/me")
def update_my_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.name is not None:
        current_user.name = data.name.strip()
    if data.email is not None:
        new_email = str(data.email).lower().strip()
        existing = db.query(User).filter(
            User.email == new_email,
            User.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        current_user.email = new_email

    patient = _get_or_create_patient(current_user, db)
    for field in (
        "patient_id",
        "date_of_birth",
        "gender",
        "blood_type",
        "chronic_conditions",
    ):
        value = getattr(data, field)
        if value is not None:
            setattr(patient, field, value)

    nested_contact = data.emergency_contact
    flat_contact_values = {
        "name": data.emergency_name,
        "phone": data.emergency_phone,
        "email": data.emergency_email,
    }
    has_flat_contact = any(value is not None for value in flat_contact_values.values())
    if nested_contact is not None:
        _upsert_contact(current_user, db, nested_contact)
    elif has_flat_contact:
        _upsert_contact(
            current_user,
            db,
            EmergencyContactUpdate(**flat_contact_values),
        )

    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Profile data conflicts with an existing record")

    return _profile_response(current_user, db)


@router.put("/emergency-contact")
def update_emergency_contact(
    data: EmergencyContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = _upsert_contact(current_user, db, data)
    db.commit()
    db.refresh(contact)
    return {
        "message": "Emergency contact updated successfully",
        "emergency_contact": {
            "name": contact.name,
            "phone": contact.phone,
            "email": contact.email,
        },
    }


@router.delete("/emergency-contact", status_code=status.HTTP_204_NO_CONTENT)
def delete_emergency_contact(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == current_user.id
    ).first()
    if contact:
        db.delete(contact)
        db.commit()
    return None
