import os

os.environ["DATABASE_URL"] = "sqlite:///./test_najda.db"
os.environ["SECRET_KEY"] = "test-secret"
# Set to empty (not pop): load_dotenv() during app imports won't override an
# existing env var, so this reliably simulates missing Google config.
os.environ["GOOGLE_CLIENT_ID"] = ""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

engine = create_engine(
    "sqlite:///./test_najda.db",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_auth_profile_and_chat_flow():
    registration = client.post(
        "/auth/register",
        json={
            "name": "Sara Ahmed",
            "email": "sara@example.com",
            "password": "StrongPass123!",
            "patient_id": "P-1001",
            "date_of_birth": "1995-06-12",
            "gender": "Female",
            "blood_type": "O+",
            "chronic_conditions": ["Diabetes"],
            "emergency_name": "Ahmed Ali",
            "emergency_phone": "+201000000000",
            "emergency_email": "ahmed@example.com",
        },
    )
    assert registration.status_code == 201
    token = registration.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    login = client.post(
        "/auth/login",
        data={"username": "sara@example.com", "password": "StrongPass123!"},
    )
    assert login.status_code == 200

    profile = client.get("/profile/me", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["patient_profile"]["blood_type"] == "O+"

    update = client.put(
        "/profile/me",
        headers=headers,
        json={
            "name": "Sara Updated",
            "blood_type": "A+",
            "chronic_conditions": ["Asthma"],
            "emergency_name": "Mona Ali",
        },
    )
    assert update.status_code == 200
    assert update.json()["user"]["name"] == "Sara Updated"
    assert update.json()["patient_profile"]["blood_type"] == "A+"
    assert update.json()["emergency_contact"]["name"] == "Mona Ali"

    chat = client.post("/chat/sessions", headers=headers)
    assert chat.status_code == 200
    sessions = client.get("/chat/sessions", headers=headers)
    assert sessions.status_code == 200
    assert len(sessions.json()["sessions"]) == 1


def test_duplicate_email_and_google_configuration():
    duplicate = client.post(
        "/auth/register",
        json={
            "name": "Another Sara",
            "email": "sara@example.com",
            "password": "StrongPass123!",
        },
    )
    assert duplicate.status_code == 409

    google = client.post("/auth/google", json={"id_token": "dummy"})
    assert google.status_code == 503
