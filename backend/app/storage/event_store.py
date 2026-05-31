"""Append-only event store backed by SQLite via SQLModel.

Per CONTEXT.md and ADR-0014, the Event Emitter is the **only** write path
to the event log. Agents and the Context Gate hold read-only references.

Per ADR-0020, memory events are stored in SQLite and retrieved via SQL
joins — never via vector similarity search in Qdrant.
"""

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.domain.events import (
    BlindSpotDetected,
    ConceptMasteryUpdated,
    EventBase,
    HintRequested,
    PracticeAttempted,
    SessionSummaryCreated,
    SourceIngested,
    ArtifactGenerated,
)

# All concrete event types for polymorphic reads.
EVENT_TYPES = (
    SourceIngested,
    ArtifactGenerated,
    PracticeAttempted,
    HintRequested,
    BlindSpotDetected,
    ConceptMasteryUpdated,
    SessionSummaryCreated,
)


# ── Write path (Event Emitter only) ────────────────────────────────


def append_event(session: Session, event: EventBase) -> None:
    """Persist a single event. Append-only — no update or delete."""
    session.add(event)
    session.commit()
    session.refresh(event)


# ── Read paths (Context Gate, agents, UI) ───────────────────────────


def get_events_by_session(
    session: Session, session_id: str
) -> list[EventBase]:
    """Return all events for a session, ordered by timestamp."""
    results: list[EventBase] = []
    for event_cls in EVENT_TYPES:
        statement = (
            select(event_cls)
            .where(event_cls.session_id == session_id)
            .order_by(event_cls.timestamp)
        )
        results.extend(session.exec(statement).all())
    results.sort(key=lambda e: e.timestamp)
    return results


def get_practice_events_for_concept(
    session: Session, concept_id: str
) -> list[PracticeAttempted]:
    """Return practice attempts for a concept, ordered by timestamp."""
    statement = (
        select(PracticeAttempted)
        .where(PracticeAttempted.concept_id == concept_id)
        .order_by(PracticeAttempted.timestamp)
    )
    return list(session.exec(statement).all())


def get_blind_spots(
    session: Session, *, resolved: bool = False
) -> list[BlindSpotDetected]:
    """Return active (or resolved) Blind Spots."""
    statement = select(BlindSpotDetected).order_by(
        BlindSpotDetected.timestamp.desc()
    )
    if resolved:
        statement = statement.where(BlindSpotDetected.resolved_at.is_not(None))
    else:
        statement = statement.where(BlindSpotDetected.resolved_at.is_(None))
    return list(session.exec(statement).all())


def get_mastery_for_concept(
    session: Session, concept_id: str
) -> ConceptMasteryUpdated | None:
    """Return the latest mastery event for a concept."""
    statement = (
        select(ConceptMasteryUpdated)
        .where(ConceptMasteryUpdated.concept_id == concept_id)
        .order_by(ConceptMasteryUpdated.timestamp.desc())
    )
    return session.exec(statement).first()


def get_session_summary(
    session: Session, session_id: str
) -> SessionSummaryCreated | None:
    """Return the session summary for a given session."""
    statement = select(SessionSummaryCreated).where(
        SessionSummaryCreated.session_id == session_id
    )
    return session.exec(statement).first()
