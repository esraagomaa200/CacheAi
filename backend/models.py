from datetime import datetime, date

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, String, Text, TypeDecorator, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class PortableJSON(TypeDecorator):
    """Use JSONB on PostgreSQL and JSON on SQLite/local test databases."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())


# =========================================================
# 1. USERS
# =========================================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True
    )

    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)

    auth_provider: Mapped[str] = mapped_column(
        String(20),
        default="local"
    )

    provider_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    patient_profile: Mapped["PatientProfile | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    emergency_contact: Mapped["EmergencyContact | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )

    emergency_events: Mapped[list["EmergencyEvent"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )


# =========================================================
# 2. PATIENT PROFILES
# =========================================================

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    patient_id: Mapped[str | None] = mapped_column(
        String(100),
        unique=True,
        nullable=True
    )

    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True
    )

    gender: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True
    )

    blood_type: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True
    )

    chronic_conditions: Mapped[list[str] | None] = mapped_column(
                PortableJSON(),
        nullable=True

    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(
        back_populates="patient_profile"
    )


# =========================================================
# 3. EMERGENCY CONTACTS
# =========================================================
# This class keeps disappearing from the file you're running locally.
# Every router (auth.py, profile.py) and init_db.py import it from
# here — without it, `import models` fails and nothing starts.

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(
        back_populates="emergency_contact"
    )


# =========================================================
# 4. CHAT SESSIONS
# =========================================================

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True
    )

    title: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    chat_type: Mapped[str] = mapped_column(
        String(20),
        default="normal"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User | None"] = relationship(
        back_populates="chat_sessions"
    )

    messages: Mapped[list["Message"]] = relationship(
        back_populates="chat_session",
        cascade="all, delete-orphan"
    )

    emergency_events: Mapped[list["EmergencyEvent"]] = relationship(
        back_populates="chat_session",
        cascade="all, delete-orphan"
    )


# =========================================================
# 5. MESSAGES
# =========================================================

class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    chat_session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_sessions.id"),
        nullable=False
    )

    sender: Mapped[str] = mapped_column(
        String(20)
    )

    content: Mapped[str] = mapped_column(
        Text
    )

    sources: Mapped[list[dict] | None] = mapped_column(
        PortableJSON(),
        nullable=True
    )

    risk_level: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    # Relationship
    chat_session: Mapped["ChatSession"] = relationship(
        back_populates="messages"
    )


# =========================================================
# 6. EMERGENCY EVENTS
# =========================================================

class EmergencyEvent(Base):
    __tablename__ = "emergency_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    chat_session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_sessions.id"),
        nullable=False
    )

    condition: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    risk_level: Mapped[str] = mapped_column(
        String(20),
        default="low"
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now()
    )

    timer_seconds: Mapped[int] = mapped_column(
        Integer,
        default=60
    )

    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    escalation_status: Mapped[str] = mapped_column(
        String(30),
        default="monitoring"
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="emergency_events"
    )

    chat_session: Mapped["ChatSession"] = relationship(
        back_populates="emergency_events"
    )