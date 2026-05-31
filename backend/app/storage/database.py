"""SQLModel database engine and session factory.

Provides a FastAPI-compatible dependency for database sessions and a
lifespan initialiser that creates all tables on startup.
"""

from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session, SQLModel, create_engine

from app.config import Settings, get_settings

# Module-level engine — set by ``init_db`` at application startup.
_engine = None


def init_db(settings: Settings) -> None:
    """Create the SQLite engine and all tables.

    Called once during the FastAPI lifespan. Ensures the database
    directory exists before connecting.
    """
    global _engine
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    _engine = create_engine(
        f"sqlite:///{settings.db_path}",
        echo=False,
        connect_args={"check_same_thread": False},
    )
    # Import event models so SQLModel.metadata knows about their tables.
    import app.domain.events  # noqa: F401

    SQLModel.metadata.create_all(_engine)


def get_engine():
    """Return the initialised engine (for use in tests or manual scripts)."""
    if _engine is None:
        raise RuntimeError("Database not initialised. Call init_db() first.")
    return _engine


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a SQLModel session."""
    engine = get_engine()
    with Session(engine) as session:
        yield session


# Typed dependency alias for use in route signatures.
DatabaseDep = Annotated[Session, Depends(get_session)]
