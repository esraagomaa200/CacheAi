import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt, JWTError

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from database import get_db
from schemas import RegisterRequest, GoogleAuthRequest, TokenResponse

from models import (
    User,
    PatientProfile,
    EmergencyContact
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# =========================
# Security
# =========================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)

# TODO: move these to real environment variables before shipping.
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "cacheai-secret-key-change-later")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Google OAuth Client ID (from Google Cloud Console -> Credentials ->
# OAuth 2.0 Client ID, "Web application"). This is the "audience" the
# ID token must be issued for. No Firebase project involved at all —
# users are verified against Google directly and stored in our own DB.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# =========================
# Current User
# =========================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        email = payload.get("sub")

        if not email:
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = db.query(User).filter(
        User.email == email
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


# =========================
# Test
# =========================

@router.get("/test")
def auth_test():
    return {
        "message": "Auth router is working!"
    }


# =========================
# Register
# =========================

@router.post("/register", response_model=TokenResponse)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db)
):
    # -----------------------------------------------------
    # Check existing email
    # -----------------------------------------------------

    existing_user = db.query(User).filter(
        User.email == data.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # -----------------------------------------------------
    # Hash password
    # -----------------------------------------------------

    hashed_password = pwd_context.hash(data.password)

    # -----------------------------------------------------
    # Create User
    # -----------------------------------------------------

    new_user = User(
        name=data.name,
        email=data.email,
        password_hash=hashed_password,
        auth_provider="local"
    )

    db.add(new_user)
    db.flush()  # gets new_user.id before commit

    # -----------------------------------------------------
    # Create Patient Profile
    # (this used to be overwritten by a stray class definition
    # pasted into the middle of the function — restored here)
    # -----------------------------------------------------

    patient_profile = PatientProfile(
        user_id=new_user.id,
        patient_id=data.patient_id,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        blood_type=data.blood_type,
        chronic_conditions=data.chronic_conditions
    )

    db.add(patient_profile)

    # -----------------------------------------------------
    # Create Emergency Contact
    # -----------------------------------------------------

    if data.emergency_name or data.emergency_phone or data.emergency_email:
        emergency_contact = EmergencyContact(
            user_id=new_user.id,
            name=data.emergency_name or "",
            phone=data.emergency_phone or "",
            email=data.emergency_email
        )

        db.add(emergency_contact)

    # -----------------------------------------------------
    # Save everything
    # -----------------------------------------------------

    db.commit()
    db.refresh(new_user)

    # Log the user in immediately, matching what the frontend expects
    # (it looks for result.access_token right after registering)
    access_token = create_access_token({"sub": new_user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =========================
# Login
# =========================

@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    if not pwd_context.verify(
        form_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    access_token = create_access_token({"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =========================
# Google Login
# =========================
# No Firebase anywhere here. The frontend uses Google Identity
# Services directly (Google's own JS SDK) to get a Google-signed ID
# token, sends it to us, we verify it against Google's public keys
# ourselves, and store/find the user in our own Postgres DB — same
# User table as everyone else, just with auth_provider="google".

@router.post("/google", response_model=TokenResponse)
def google_login(
    data: GoogleAuthRequest,
    db: Session = Depends(get_db)
):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Server is missing GOOGLE_CLIENT_ID configuration"
        )

    try:
        idinfo = google_id_token.verify_oauth2_token(
            data.id_token,
            google_requests.Request(),
            audience=GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Google token"
        )

    # Google only issues tokens from these two issuers — worth
    # double-checking explicitly rather than trusting audience alone.
    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(
            status_code=401,
            detail="Invalid token issuer"
        )

    email = idinfo.get("email")
    uid = idinfo.get("sub")  # Google's stable, unique user id
    name = idinfo.get("name") or (email.split("@")[0] if email else "User")

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Google account has no email"
        )

    user = db.query(User).filter(User.email == email).first()

    if user and user.auth_provider == "local":
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists. Please log in with your password instead."
        )

    if not user:
        user = User(
            name=name,
            email=email,
            password_hash=None,
            auth_provider="google",
            provider_id=uid
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token({"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =========================
# Protected endpoint
# =========================

@router.get("/me")
def get_me(
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
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,

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
                if patient_profile
                else []
            )
        },

        "emergency_contact": {
            "name": emergency_contact.name if emergency_contact else None,
            "phone": emergency_contact.phone if emergency_contact else None,
            "email": emergency_contact.email if emergency_contact else None
        }
    }