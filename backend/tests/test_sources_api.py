"""Tests for the Sources Ingestion API (Phase 8)."""

from __future__ import annotations

import time
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.domain.events import SourceIngested
from app.storage import event_store


def test_ingest_source_returns_202_and_emits_event(client: TestClient, db_session: Session):
    """POST /api/sources/ingest accepts valid payload and processes it."""
    payload = {
        "sourceId": "src-999",
        "sourceType": "PDF",
        "sourceName": "Test PDF Ingest",
        "chunks": [{"source_id": "src-999", "chunk_index": 0, "page_or_timestamp": 1, "text": "Hello World"}],
        "conceptCandidates": [{"name": "Concept A", "aliases": ["Alias A"]}],
        "graphFacts": [{"source": "Concept A", "target": "Concept B", "relation": "related"}]
    }

    response = client.post("/api/sources/ingest", json=payload)
    assert response.status_code == 202
    assert response.json() == {"status": "accepted"}

    # Yield to background tasks if running asynchronously, or since FastAPI TestClient run tasks synchronously:
    # Check the database for SourceIngested event
    time.sleep(0.1)
    events = event_store.get_events_by_session(db_session, "dummy_session")  # event emitter uses session
    # Retrieve all events from database directly to verify
    from app.storage.database import get_engine
    from sqlmodel import select
    
    with Session(get_engine()) as session:
        statement = select(SourceIngested).where(SourceIngested.source_id == "src-999")
        results = session.exec(statement).all()
        assert len(results) == 1
        assert results[0].source_name == "Test PDF Ingest"
        assert results[0].chunk_count == 1
