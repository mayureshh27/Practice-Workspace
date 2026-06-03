"""API endpoints for memory events.

POST /api/events/attempt               — submit a practice attempt
POST /api/events/hint                  — record a hint request
GET  /api/events/session/{session_id}  — list all events for a session
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel

from app.domain.events import HintRequested, PracticeAttempted, event_as_dict
from app.harness import event_emitter
from app.storage import event_store
from app.storage.database import DatabaseDep

router = APIRouter(prefix="/api/events", tags=["events"])


class EventResponse(BaseModel):
    """Standard response for event submission."""

    status: str
    event_id: str


class EventSummary(BaseModel):
    """Lightweight representation of an event for the API."""

    id: str
    event_type: str
    timestamp: str | None = None
    session_id: str | None = None
    concept_id: str | None = None
    verdict: str | None = None
    new_mastery: float | None = None


@router.post("/attempt")
def submit_attempt(attempt: PracticeAttempted, session: DatabaseDep) -> EventResponse:
    """Submit a practice attempt and trigger pedagogical rules synchronously."""
    try:
        event_emitter.emit_event(session, attempt)
        return EventResponse(status="success", event_id=attempt.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/hint")
def record_hint(hint: HintRequested, session: DatabaseDep) -> EventResponse:
    """Record a hint request event."""
    try:
        event_emitter.emit_event(session, hint)
        return EventResponse(status="success", event_id=hint.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/session/{session_id}")
def list_session_events(
    session_id: Annotated[str, Path(description="The session ID")],
    session: DatabaseDep,
) -> list[EventSummary]:
    """Return all events for a session, ordered by timestamp."""
    events = event_store.get_events_by_session(session, session_id)
    results: list[EventSummary] = []
    for event in events:
        flat = event_as_dict(event)
        results.append(
            EventSummary(
                id=flat["id"],
                event_type=flat["type"],
                timestamp=flat["timestamp"],
                session_id=flat.get("session_id"),
                concept_id=flat.get("concept_id"),
                verdict=flat.get("verdict"),
                new_mastery=flat.get("new_mastery"),
            )
        )
    return results
