import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from models import EmergencyContact, EmergencyEvent, Message, PatientProfile, ChatSession, User
from routers.auth import router as auth_router
from routers.chat import router as chat_router
from routers.emergency import router as emergency_router
from routers.live import router as live_router
from routers.profile import router as profile_router

load_dotenv()

app = FastAPI(title="NajdaAI Backend", version="1.0.0")

configured_origins = os.getenv("FRONTEND_ORIGINS", "").strip()
origins = [
    origin.strip()
    for origin in configured_origins.split(",")
    if origin.strip()
]
if not origins:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(emergency_router)
app.include_router(live_router)
app.include_router(profile_router)


@app.on_event("startup")
def create_tables() -> None:
    # This is intentionally non-destructive. It creates missing tables but
    # never drops the user's existing Chat or patient data.
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "NajdaAI Backend is running!"}


@app.get("/health")
def health():
    return {"status": "ok"}
