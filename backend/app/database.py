import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# SQLite by default so the demo runs with zero setup.
# For PostgreSQL: DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/sowaka
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sowaka.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
