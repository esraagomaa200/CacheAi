from database import Base, engine
from models import EmergencyContact, Message, PatientProfile, ChatSession, User


Base.metadata.create_all(bind=engine)
print("Database tables created successfully!")
