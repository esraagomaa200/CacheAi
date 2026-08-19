import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if not DATABASE_URL:
    # No DATABASE_URL configured (e.g. local demo without Postgres) — fall
    # back to a local SQLite file so the app always runs offline.
    DATABASE_URL = "sqlite:///./cacheai.db"
elif DATABASE_URL.startswith("postgresql://"):
    # The committed .env uses the plain postgresql:// scheme, but the
    # installed driver is psycopg (v3), which SQLAlchemy needs spelled out
    # in the scheme. Rewrite it here so the .env format keeps working.
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgresql://"):]

engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
