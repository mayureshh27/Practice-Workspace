"""Tests for the eval_runs repository (Phase 5).

The ``eval_runs`` table is the audit log of practice-generation runs.
The repo is the only write path: ``start_run`` opens the row,
``finish_run`` closes it with status + outcome.

These tests cover the repo directly (not through the API) so the
audit log semantics are pinned independently of the route layer.
"""

from __future__ import annotations

import pytest
from sqlmodel import Session, text

from app.storage import eval_runs_repo


@pytest.fixture(autouse=True)
def _clear_eval_runs(test_engine):
    """Reset the eval_runs table before each repo test.

    The conftest's ``db_session`` fixture only rolls back uncommitted
    work; ``start_run``/``finish_run`` commit, so the rows survive
    across tests. Without this isolation the "list 3 rows newest
    first" test would see rows from earlier tests in the same file
    and from the API-level tests (test_practice_exercises,
    test_workflows_api) that also write via the eval_runs repo.
    """
    with test_engine.begin() as conn:
        conn.execute(text("DELETE FROM eval_runs"))
    yield


def test_start_run_creates_running_row(db_session: Session) -> None:
    """A new run starts with status='running' and a generated id."""
    run = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-practice",
        workflow_name="Practice Exercises Generator",
        domain_id="go-programming",
        subject_id="go-fundamentals",
        count=3,
        difficulty="hard",
    )
    assert run.id  # uuid4 string
    assert run.status == "running"
    assert run.workflow_id == "wf-practice"
    assert run.workflow_name == "Practice Exercises Generator"
    assert run.count == 3
    assert run.difficulty == "hard"
    assert run.started_at is not None
    assert run.finished_at is None
    assert run.duration_ms is None
    assert run.artifact_id is None


def test_finish_run_succeeded_stamps_artifact_and_duration(db_session: Session) -> None:
    """A successful finish sets artifact_id, status, and a positive duration."""
    run = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-summary",
        workflow_name="Concept Synthesizer",
        domain_id="go-programming",
        subject_id="go-fundamentals",
    )
    finished = eval_runs_repo.finish_run(
        db_session,
        run.id,
        status="succeeded",
        artifact_id="artifact-xyz",
    )
    assert finished is not None
    assert finished.status == "succeeded"
    assert finished.artifact_id == "artifact-xyz"
    assert finished.finished_at is not None
    assert finished.duration_ms is not None
    assert finished.duration_ms >= 0
    assert finished.error_message is None
    assert finished.gate_failures is None


def test_finish_run_gate_rejected_stores_failures_as_json(db_session: Session) -> None:
    """Gate rejections serialise the failure list to JSON."""
    run = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-quiz",
        workflow_name="Quiz",
    )
    finished = eval_runs_repo.finish_run(
        db_session,
        run.id,
        status="gate_rejected",
        error_message="runability: not a valid python snippet",
        gate_failures=["runability: not a valid python snippet", "grounding: source 42 missing"],
    )
    assert finished is not None
    assert finished.status == "gate_rejected"
    assert finished.artifact_id is None
    assert finished.gate_failures is not None
    # JSON round-trips through the helper
    assert eval_runs_repo.gate_failures_for(finished) == [
        "runability: not a valid python snippet",
        "grounding: source 42 missing",
    ]


def test_finish_run_error_captures_message(db_session: Session) -> None:
    """Unexpected errors land as status='error' with the message string."""
    run = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-practice",
        workflow_name="Practice",
    )
    finished = eval_runs_repo.finish_run(
        db_session,
        run.id,
        status="error",
        error_message="network: connection refused",
    )
    assert finished is not None
    assert finished.status == "error"
    assert finished.error_message == "network: connection refused"


def test_finish_run_rejects_invalid_status(db_session: Session) -> None:
    """The status whitelist is enforced — typos don't slip into the log."""
    run = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-practice",
        workflow_name="Practice",
    )
    import pytest

    with pytest.raises(ValueError, match="Invalid finish_run status"):
        eval_runs_repo.finish_run(db_session, run.id, status="completed")


def test_finish_run_unknown_id_returns_none(db_session: Session) -> None:
    """Finishing a non-existent run id is a no-op (returns None)."""
    result = eval_runs_repo.finish_run(
        db_session,
        "nonexistent-run-id",
        status="succeeded",
    )
    assert result is None


def test_list_runs_filters_by_workflow_and_status(db_session: Session) -> None:
    """list_runs is filterable by workflow_id, status, and artifact_id."""
    a = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-practice",
        workflow_name="Practice",
    )
    eval_runs_repo.finish_run(db_session, a.id, status="succeeded", artifact_id="art-a")

    b = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-practice",
        workflow_name="Practice",
    )
    eval_runs_repo.finish_run(db_session, b.id, status="gate_rejected", gate_failures=["bad shape"])

    c = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-quiz",
        workflow_name="Quiz",
    )
    eval_runs_repo.finish_run(db_session, c.id, status="succeeded", artifact_id="art-c")

    # All three newest-first
    all_runs = eval_runs_repo.list_runs(db_session)
    assert len(all_runs) == 3
    assert all_runs[0].id == c.id  # c is the newest (last inserted)

    # workflow_id filter
    practice_runs = eval_runs_repo.list_runs(db_session, workflow_id="wf-practice")
    assert {r.id for r in practice_runs} == {a.id, b.id}

    # status filter
    succeeded = eval_runs_repo.list_runs(db_session, status="succeeded")
    assert {r.id for r in succeeded} == {a.id, c.id}

    # artifact filter
    art_a = eval_runs_repo.list_runs(db_session, artifact_id="art-a")
    assert len(art_a) == 1
    assert art_a[0].id == a.id


def test_get_run_returns_row_or_none(db_session: Session) -> None:
    """get_run is the read-by-id path used by future trace UIs."""
    run = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-practice",
        workflow_name="Practice",
    )
    fetched = eval_runs_repo.get_run(db_session, run.id)
    assert fetched is not None
    assert fetched.id == run.id
    assert eval_runs_repo.get_run(db_session, "nope") is None


def test_gate_failures_for_handles_corrupt_json(db_session: Session) -> None:
    """A row with a corrupt gate_failures value decodes as an empty list."""
    run = eval_runs_repo.start_run(
        db_session,
        workflow_id="wf-practice",
        workflow_name="Practice",
    )
    eval_runs_repo.finish_run(db_session, run.id, status="gate_rejected")
    # Stomp the column with garbage; the helper must not raise.
    run.gate_failures = "this is not json"
    db_session.add(run)
    db_session.commit()
    db_session.refresh(run)
    assert eval_runs_repo.gate_failures_for(run) == []


def test_eval_runs_table_is_registered(test_engine) -> None:
    """The eval_runs table is in SQLModel.metadata (so create_all works)."""
    from sqlmodel import SQLModel

    assert "eval_runs" in SQLModel.metadata.tables
    table = SQLModel.metadata.tables["eval_runs"]
    columns = {c.name for c in table.columns}
    # Pin the public surface so the schema cannot silently lose a column.
    assert {
        "id",
        "started_at",
        "finished_at",
        "duration_ms",
        "workflow_id",
        "workflow_name",
        "domain_id",
        "subject_id",
        "chapter_id",
        "topic_id",
        "count",
        "difficulty",
        "status",
        "artifact_id",
        "error_message",
        "gate_failures",
    } <= columns
