import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import EmergencyContact, PatientProfile, User
from schemas import GoogleAuthRequest, RegisterRequest, TokenResponse
from security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _profile_payload(user: User, db: Session) -> dict:
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == user.id
    ).first()
    emergency_contact = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == user.id
    ).first()

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "auth_provider": user.auth_provider,
        "patient_profile": {
            "patient_id": patient_profile.patient_id if patient_profile else None,
            "date_of_birth": (
                patient_profile.date_of_birth.isoformat()
                if patient_profile and patient_profile.date_of_birth
                else None
            ),
            "gender": patient_profile.gender if patient_profile else None,
            "blood_type": patient_profile.blood_type if patient_profile else None,
            "chronic_conditions": (
                patient_profile.chronic_conditions
                if patient_profile and patient_profile.chronic_conditions
                else []
            ),
        },
        "emergency_contact": {
            "name": emergency_contact.name if emergency_contact else None,
            "phone": emergency_contact.phone if emergency_contact else None,
            "email": emergency_contact.email if emergency_contact else None,
        },
    }


def _token_for(user: User) -> str:
    return create_access_token({"sub": str(user.id)})


@router.get("/test")
def auth_test():
    return {"message": "Auth router is working!"}


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    normalized_email = str(data.email).lower().strip()
    if db.query(User).filter(User.email == normalized_email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=data.name.strip(),
        email=normalized_email,
        password_hash=hash_password(data.password),
        auth_provider="local",
    )
    db.add(user)
    db.flush()

    db.add(
        PatientProfile(
            user_id=user.id,
            patient_id=data.patient_id,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            blood_type=data.blood_type,
            chronic_conditions=data.chronic_conditions or [],
        )
    )

    if data.emergency_name or data.emergency_phone or data.emergency_email:
        db.add(
            EmergencyContact(
                user_id=user.id,
                name=data.emergency_name,
                phone=data.emergency_phone,
                email=str(data.emergency_email) if data.emergency_email else None,
            )
        )

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email or patient ID already exists")

    return {"access_token": _token_for(user), "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    normalized_email = form_data.username.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()

    if not user or not user.password_hash or not verify_password(
        form_data.password, user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"access_token": _token_for(user), "token_type": "bearer"}


@router.post("/google", response_model=TokenResponse)
def google_login(data: GoogleAuthRequest, db: Session = Depends(get_db)):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="Server is missing GOOGLE_CLIENT_ID configuration",
        )

    try:
        idinfo = google_id_token.verify_oauth2_token(
            data.id_token,
            google_requests.Request(),
            audience=client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired Google token")

    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    if idinfo.get("email_verified") is False:
        raise HTTPException(status_code=401, detail="Google email is not verified")

    email = (idinfo.get("email") or "").lower().strip()
    provider_id = idinfo.get("sub")
    if not email or not provider_id:
        raise HTTPException(status_code=400, detail="Google account data is incomplete")

    user = db.query(User).filter(User.email == email).first()
    if user and user.auth_provider == "local":
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please use password login.",
        )

    if not user:
        user = User(
            name=idinfo.get("name") or email.split("@")[0],
            email=email,
            password_hash=None,
            auth_provider="google",
            provider_id=provider_id,
        )
        db.add(user)
        db.flush()
        db.add(PatientProfile(user_id=user.id, chronic_conditions=[]))
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Google account is already linked")

    return {"access_token": _token_for(user), "token_type": "bearer"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _profile_payload(current_user, db)


# Kept as a compatibility export because the existing chat.py imports this symbol
# from routers.auth. The implementation itself lives in dependencies.py.
__all__ = ["router", "get_current_user"]
