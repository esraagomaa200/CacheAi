from datetime import date

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

    patient_id: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None

    blood_type: str | None = None
    chronic_conditions: list[str] | None = None

    emergency_name: str | None = None
    emergency_phone: str | None = None
    emergency_email: EmailStr | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class GoogleAuthRequest(BaseModel):
    id_token: str