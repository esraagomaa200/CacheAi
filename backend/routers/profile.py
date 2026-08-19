from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User, PatientProfile, EmergencyContact
from routers.auth import get_current_user
from pydantic import BaseModel


router = APIRouter(
    prefix="/profile",
    tags=["Profile"]
)


# =========================================================
# REQUEST SCHEMAS
# =========================================================

class EmergencyContactRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    patient_id: str | None = None
    blood_type: str | None = None
    chronic_conditions: list[str] | None = None
    emergency_contact: EmergencyContactRequest | None = None


# =========================================================
# GET MY PROFILE
# =========================================================

@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == current_user.id
    ).first()

    emergency_contact = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == current_user.id
    ).first()

    return {
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email
        },

        "patient_profile": {
            "patient_id": patient_profile.patient_id
            if patient_profile else None,

            "blood_type": patient_profile.blood_type
            if patient_profile else None,

            "chronic_conditions": patient_profile.chronic_conditions
            if patient_profile else None
        },

        "emergency_contact": {
            "name": emergency_contact.name
            if emergency_contact else None,

            "phone": emergency_contact.phone
            if emergency_contact else None,

            "email": emergency_contact.email
            if emergency_contact else None
        }
    }


# =========================================================
# UPDATE MY PROFILE
# =========================================================

@router.put("/me")
def update_my_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # -----------------------------------------------------
    # Update basic user information
    # -----------------------------------------------------

    if data.name is not None:
        current_user.name = data.name


    # -----------------------------------------------------
    # Patient Profile
    # -----------------------------------------------------

    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == current_user.id
    ).first()

    if patient_profile is None:

        patient_profile = PatientProfile(
            user_id=current_user.id
        )

        db.add(patient_profile)

    if data.patient_id is not None:
        patient_profile.patient_id = data.patient_id

    if data.blood_type is not None:
        patient_profile.blood_type = data.blood_type

    if data.chronic_conditions is not None:
        patient_profile.chronic_conditions = data.chronic_conditions


    # -----------------------------------------------------
    # Emergency Contact
    # -----------------------------------------------------

    if data.emergency_contact is not None:

        emergency_contact = db.query(EmergencyContact).filter(
            EmergencyContact.user_id == current_user.id
        ).first()

        if emergency_contact is None:

            emergency_contact = EmergencyContact(
                user_id=current_user.id,
                name=data.emergency_contact.name or "",
                phone=data.emergency_contact.phone or "",
                email=data.emergency_contact.email
            )

            db.add(emergency_contact)

        else:

            if data.emergency_contact.name is not None:
                emergency_contact.name = data.emergency_contact.name

            if data.emergency_contact.phone is not None:
                emergency_contact.phone = data.emergency_contact.phone

            if data.emergency_contact.email is not None:
                emergency_contact.email = data.emergency_contact.email


    # -----------------------------------------------------
    # Save
    # -----------------------------------------------------

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully"
    }