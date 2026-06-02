"""Shared test fixtures for the PracDaGo backend test suite."""

import os

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

# Ensure Logfire doesn't try to send telemetry in tests.
os.environ.pop("PRACDA_LOGFIRE_TOKEN", None)
os.environ["PRACDA_ENVIRONMENT"] = "test"
os.environ["GOOGLE_API_KEY"] = "mock-key-for-testing"
os.environ["LOGFIRE_IGNORE_NO_CONFIG"] = "1"


@pytest.fixture(scope="session")
def test_db_path(tmp_path_factory):
    """Create a temporary SQLite database for the test session."""
    return tmp_path_factory.mktemp("data") / "test.db"


@pytest.fixture(scope="session")
def test_engine(test_db_path):
    """Create a SQLModel engine pointing at the test database."""
    engine = create_engine(
        f"sqlite:///{test_db_path}",
        echo=False,
        connect_args={"check_same_thread": False},
    )
    # Import event + audit models so metadata knows about their tables.
    import app.domain.events
    import app.storage.eval_runs_repo  # noqa: F401  (Phase 5: eval_runs)

    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(test_engine):
    """Yield a fresh SQLModel session, rolled back after each test."""
    with Session(test_engine) as session:
        yield session
        session.rollback()


@pytest.fixture(scope="session")
def client(test_db_path):
    """Create a FastAPI TestClient with seeded workspace data."""
    # Override the DB path to use the test database.
    os.environ["PRACDA_DB_PATH"] = str(test_db_path)

    # Must import after setting env vars so Settings picks them up.
    from app.main import app

    with TestClient(app) as c:
        yield c
