from datetime import date

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
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
    token_type: str = "bearer"


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=1)


class EmergencyContactUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    patient_id: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    blood_type: str | None = None
    chronic_conditions: list[str] | None = None
    emergency_name: str | None = None
    emergency_phone: str | None = None
    emergency_email: EmailStr | None = None
    emergency_contact: EmergencyContactUpdate | None = None
