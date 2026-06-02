"""eval_runs repository — audit log of practice-generation runs.

Each row is one attempt to run a workflow template through the practice
generator. The row is created at the start of the run (status='running')
and updated on completion with the final status and the produced
artifact_id. This is the eval traceability log that ADR-0011 (eval
gates use pydantic-evals and layer-specific checks) and H-B4
(model_router needs template_id; persist to eval_runs) reference.

Status values:
  - running       — created, not finished
  - succeeded     — artifact created and persisted
  - gate_rejected — the artifact gate rejected the LLM output
  - error         — unexpected exception (network, parse, etc.)
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Field, Session, SQLModel, select


def _utcnow() -> datetime:
    """Naive UTC ``datetime`` for SQLite round-trip stability.

    SQLite strips tzinfo on read-back, so storing
    ``datetime.now(UTC)`` and then reading it leaves a naive
    value that can't be subtracted from the next tz-aware
    value. We standardise on **naive UTC** here: the column
    type is ``DATETIME`` and the meaning is "UTC" by repo
    convention. Callers that need a tz-aware value can
    ``.replace(tzinfo=UTC)`` on read.
    """
    return datetime.now(UTC).replace(tzinfo=None)


def _new_id() -> str:
    return str(uuid4())


class EvalRun(SQLModel, table=True):
    """Per-attempt audit log of practice-generation runs.

    The row is created with status='running' and updated to
    'succeeded' / 'gate_rejected' / 'error' on completion. The
    ``artifact_id`` is non-null only on 'succeeded' runs; the
    ``gate_failures`` JSON list is non-null only on 'gate_rejected'.

    This is the eval traceability layer mandated by ADR-0011 — the
    same row links the workflow template that produced the run, the
    LLM that emitted the artifact, and the gate that approved it.
    """

    __tablename__ = "eval_runs"

    id: str = Field(default_factory=_new_id, primary_key=True)
    started_at: datetime = Field(default_factory=_utcnow, index=True)
    finished_at: datetime | None = None
    duration_ms: int | None = None

    # Source workflow + workspace scope (ADR-0011 traceability).
    workflow_id: str = Field(index=True)
    workflow_name: str = ""
    domain_id: str | None = None
    subject_id: str | None = None
    chapter_id: str | None = None
    topic_id: str | None = None

    # Request parameters — what the caller asked for.
    count: int = 5
    difficulty: str = "medium"

    # Outcome (status + optional artifact_id / error / gate_failures).
    status: str = "running"  # 'running' | 'succeeded' | 'gate_rejected' | 'error'
    artifact_id: str | None = None
    error_message: str | None = None
    gate_failures: str | None = None  # JSON-encoded list[str]


# ── Write path ─────────────────────────────────────────────────────


def start_run(
    session: Session,
    *,
    workflow_id: str,
    workflow_name: str,
    domain_id: str | None = None,
    subject_id: str | None = None,
    chapter_id: str | None = None,
    topic_id: str | None = None,
    count: int = 5,
    difficulty: str = "medium",
) -> EvalRun:
    """Create a new eval_run row with status='running'.

    Returns the persisted row with its generated id; callers pass
    that id to :func:`finish_run` when the run completes.
    """
    run = EvalRun(
        workflow_id=workflow_id,
        workflow_name=workflow_name,
        domain_id=domain_id,
        subject_id=subject_id,
        chapter_id=chapter_id,
        topic_id=topic_id,
        count=count,
        difficulty=difficulty,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def finish_run(
    session: Session,
    run_id: str,
    *,
    status: str,
    artifact_id: str | None = None,
    error_message: str | None = None,
    gate_failures: list[str] | None = None,
) -> EvalRun | None:
    """Update a run with its final status and outcome.

    ``status`` must be one of ``'succeeded'``, ``'gate_rejected'``,
    or ``'error'``. ``gate_failures`` is serialised to JSON so the
    reader doesn't need a separate column type for a list.

    Returns the updated row, or ``None`` if the run id is unknown.
    """
    if status not in ("succeeded", "gate_rejected", "error"):
        raise ValueError(
            f"Invalid finish_run status: {status!r} (expected 'succeeded' | 'gate_rejected' | 'error')"
        )
    run = session.get(EvalRun, run_id)
    if run is None:
        return None
    run.finished_at = _utcnow()
    run.duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)
    run.status = status
    if artifact_id is not None:
        run.artifact_id = artifact_id
    if error_message is not None:
        run.error_message = error_message
    if gate_failures is not None:
        run.gate_failures = json.dumps(gate_failures)
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


# ── Read path ──────────────────────────────────────────────────────


def get_run(session: Session, run_id: str) -> EvalRun | None:
    """Return a single run by id, or ``None`` if not found."""
    return session.get(EvalRun, run_id)


def list_runs(
    session: Session,
    *,
    workflow_id: str | None = None,
    artifact_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
) -> list[EvalRun]:
    """Return runs filtered by workflow / artifact / status, newest first."""
    statement = select(EvalRun).order_by(EvalRun.started_at.desc()).limit(limit)
    if workflow_id is not None:
        statement = statement.where(EvalRun.workflow_id == workflow_id)
    if artifact_id is not None:
        statement = statement.where(EvalRun.artifact_id == artifact_id)
    if status is not None:
        statement = statement.where(EvalRun.status == status)
    return list(session.exec(statement).all())


def gate_failures_for(run: EvalRun) -> list[str]:
    """Decode a run's ``gate_failures`` JSON back into a list.

    Returns an empty list if ``gate_failures`` is ``None`` or unparseable
    (the column is best-effort diagnostic data; a corrupt row should
    not break the reader).
    """
    if not run.gate_failures:
        return []
    try:
        decoded = json.loads(run.gate_failures)
    except (json.JSONDecodeError, TypeError):
        return []
    return list(decoded) if isinstance(decoded, list) else []
