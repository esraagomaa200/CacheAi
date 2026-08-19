from database import engine, Base
from models import (
    User,
    PatientProfile,
    EmergencyContact,
    ChatSession,
    Message,
)

# احذف الجدول القديم
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text("DROP TABLE IF EXISTS patients CASCADE;"))

# اعمل الجداول الجديدة
Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")