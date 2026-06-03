"""Typed memory events for the Shared Learning Memory event log.

Seven event types per ADR-0005 and ADR-0014:
  SourceIngested, ArtifactGenerated, PracticeAttempted, HintRequested,
  BlindSpotDetected, ConceptMasteryUpdated, SessionSummaryCreated.

All events are **append-only**. The Event Emitter is the only write path;
agents and the Context Gate hold read-only references (ADR-0014).

Events are stored in SQLite via SQLModel. They are never stored in or
retrieved from Qdrant — memory events use SQL joins over causal foreign
keys, not vector similarity search (ADR-0020).
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid4())


class EventBase(SQLModel):
    """Shared fields for all memory events."""

    id: str = Field(default_factory=_new_id, primary_key=True)
    timestamp: datetime = Field(default_factory=_utcnow)
    session_id: str | None = Field(default=None, index=True)


def event_as_dict(event: EventBase) -> dict:
    d: dict = {
        "type": event.__class__.__name__,
        "id": event.id,
        "timestamp": event.timestamp.isoformat() if event.timestamp else None,
    }
    extras = event.model_dump(exclude={"id", "timestamp", "session_id"})
    d.update(extras)
    if event.session_id is not None:
        d["session_id"] = event.session_id
    return d


# ── Seven typed events ──────────────────────────────────────────────


class SourceIngested(EventBase, table=True):
    """A Learning Source was successfully ingested."""

    __tablename__ = "event_source_ingested"

    source_id: str
    source_type: str  # 'PDF' | 'video' | 'repo' | 'web' | 'notes'
    source_name: str
    chunk_count: int = 0


class ArtifactGenerated(EventBase, table=True):
    """An Ingestion Artifact was produced from a workflow."""

    __tablename__ = "event_artifact_generated"

    artifact_id: str
    artifact_type: str  # 'Exercise Pack' | 'Lesson' | 'Quiz' | 'Summary'
    workflow_id: str | None = None
    source_id: str | None = None
    concept_ids: str | None = None  # comma-separated concept IDs


class PracticeAttempted(EventBase, table=True):
    """The learner submitted a practice attempt."""

    __tablename__ = "event_practice_attempted"

    artifact_id: str | None = None
    concept_id: str | None = Field(default=None, index=True)
    verdict: str  # 'Accepted' | 'Error' | 'Timeout' | 'WrongAnswer'
    hint_count: int = 0
    duration_ms: int | None = None


class HintRequested(EventBase, table=True):
    """The learner requested a hint during practice."""

    __tablename__ = "event_hint_requested"

    concept_id: str | None = Field(default=None, index=True)
    artifact_id: str | None = None
    hint_level: int = 1  # escalating hint depth


class BlindSpotDetected(EventBase, table=True):
    """A Blind Spot was detected by the deterministic SQL rule.

    A concept where the learner has ≥3 attempts across ≥3 sessions,
    the most recent attempt did not pass, and hint count per attempt
    is not decreasing. Resolved when mastery crosses 0.70.
    """

    __tablename__ = "event_blind_spot_detected"

    concept_id: str = Field(index=True)
    attempt_count: int = 0
    session_count: int = 0
    resolved_at: datetime | None = None


class ConceptMasteryUpdated(EventBase, table=True):
    """A concept mastery score was recalculated.

    Produced as a deterministic consequence of PracticeAttempted events
    by a pure-Python rule in the Event Emitter (ADR-0014).

    Mastery Score update rule (CONTEXT.md):
      pass → +0.10 (capped at 1.0)
      fail -> -0.05 (floored at 0.0)

    The trigger_event_id FK links this update to the specific
    PracticeAttempted event that caused it, enabling mastery score
    recomputation from raw events if the algorithm changes (ADR-0026).
    """

    __tablename__ = "event_concept_mastery_updated"

    concept_id: str = Field(index=True)
    previous_mastery: float = 0.0
    new_mastery: float = 0.0
    trigger_event_id: str | None = None  # FK to PracticeAttempted.id (ADR-0026)


class SessionSummaryCreated(EventBase, table=True):
    """A compressed pedagogical summary of one practice session.

    Produced by the SessionSummaryAgent from a serialised event list
    at session close. The agent returns structured output; the harness
    validates and writes it (ADR-0022).
    """

    __tablename__ = "event_session_summary_created"

    summary_text: str = ""
    concepts_covered: str | None = None  # comma-separated
    mastery_deltas: str | None = None  # JSON string of {concept_id: delta}
    event_count: int = 0
