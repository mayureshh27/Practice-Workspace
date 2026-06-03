"""Mastery API — concept mastery scores and blind spots.

GET /api/mastery/concepts               — all concept mastery scores
GET /api/mastery/concepts/{concept_id}   — mastery history for one concept
GET /api/mastery/blind-spots             — active blind spots
GET /api/mastery/session/{id}/summary    — session summary
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel
from sqlmodel import col, select

from app.domain.events import ConceptMasteryUpdated
from app.storage import event_store
from app.storage.database import DatabaseDep

router = APIRouter(prefix="/api/mastery", tags=["mastery"])


# ── Response models ─────────────────────────────────────────────────

class ConceptMastery(BaseModel):
    """Current mastery state for a single concept."""
    concept_id: str
    mastery_score: float
    previous_mastery: float
    trigger_event_id: str | None = None
    updated_at: str | None = None


class MasteryHistory(BaseModel):
    """Full mastery history for a concept."""
    concept_id: str
    history: list[ConceptMastery]


class BlindSpot(BaseModel):
    """An active blind spot."""
    concept_id: str
    attempt_count: int
    session_count: int
    detected_at: str | None = None


class SessionSummary(BaseModel):
    """A session summary."""
    session_id: str
    summary_text: str
    concepts_covered: list[str] = []
    mastery_deltas: str | None = None
    event_count: int = 0


# ── Endpoints ───────────────────────────────────────────────────────

@router.get("/concepts")
def list_concept_mastery(db_session: DatabaseDep) -> list[ConceptMastery]:
    """Return the latest mastery score for all practiced concepts."""
    statement = (
        select(ConceptMasteryUpdated)
        .order_by(col(ConceptMasteryUpdated.timestamp).desc())
    )
    all_updates = db_session.exec(statement).all()

    # Deduplicate: keep only the latest per concept
    seen: set[str] = set()
    results: list[ConceptMastery] = []
    for update in all_updates:
        if update.concept_id not in seen:
            seen.add(update.concept_id)
            results.append(ConceptMastery(
                concept_id=update.concept_id,
                mastery_score=update.new_mastery,
                previous_mastery=update.previous_mastery,
                trigger_event_id=update.trigger_event_id,
                updated_at=update.timestamp.isoformat() if update.timestamp else None,
            ))

    return results


@router.get("/concepts/{concept_id}")
def get_concept_mastery_history(
    concept_id: Annotated[str, Path(description="The concept ID")],
    db_session: DatabaseDep,
) -> MasteryHistory:
    """Return the full mastery history for a single concept."""
    statement = (
        select(ConceptMasteryUpdated)
        .where(ConceptMasteryUpdated.concept_id == concept_id)
        .order_by(col(ConceptMasteryUpdated.timestamp))
    )
    updates = db_session.exec(statement).all()

    history = [
        ConceptMastery(
            concept_id=u.concept_id,
            mastery_score=u.new_mastery,
            previous_mastery=u.previous_mastery,
            trigger_event_id=u.trigger_event_id,
            updated_at=u.timestamp.isoformat() if u.timestamp else None,
        )
        for u in updates
    ]

    return MasteryHistory(concept_id=concept_id, history=history)


@router.get("/blind-spots")
def list_blind_spots(db_session: DatabaseDep) -> list[BlindSpot]:
    """Return all active (unresolved) blind spots."""
    spots = event_store.get_blind_spots(db_session, resolved=False)
    return [
        BlindSpot(
            concept_id=s.concept_id,
            attempt_count=s.attempt_count,
            session_count=s.session_count,
            detected_at=s.timestamp.isoformat() if s.timestamp else None,
        )
        for s in spots
    ]


@router.get("/session/{session_id}/summary")
def get_session_summary(
    session_id: Annotated[str, Path(description="The session ID")],
    db_session: DatabaseDep,
) -> SessionSummary:
    """Return the session summary for a given session."""
    summary = event_store.get_session_summary(db_session, session_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Session summary not found")

    concepts = summary.concepts_covered.split(",") if summary.concepts_covered else []
    return SessionSummary(
        session_id=session_id,
        summary_text=summary.summary_text,
        concepts_covered=concepts,
        mastery_deltas=summary.mastery_deltas,
        event_count=summary.event_count,
    )
