"""Practice-exercises API  runs a workflow against the live LLM.

POST /api/practice-exercises/
POST /api/workflows/{id}/run           (Phase 5 — real dispatch)

The Studio's Run button hits one of these two endpoints. The
endpoints share a core helper — :func:`_run_workflow_for_artifact`
— that:

  1. Loads the workflow template.
  2. Resolves the subject / chapter / topic names.
  3. Substitutes {{…}} placeholders in the workflow's prompt.
  4. Calls the Practice Agent (Pydantic AI + ModelRouter).
  5. Runs the result through the Artifact Gate (H-B5) — schema,
     source grounding, runability, dedup.
  6. Persists a new artifact via :func:`make_artifact` /
     :func:`append_artifact`.
  7. Emits an :class:`ArtifactGenerated` event (H-H5) so the memory
     store has a row linking the artifact id to the workflow and
     scope. Downstream ``PracticeAttempted`` events join on
     ``artifact_id`` to keep the mastery / blind-spot trace intact.
  8. Writes an :class:`EvalRun` audit row to ``eval_runs`` (H-B4,
     Phase 5). The row is created with ``status='running'`` before
     the LLM call and finished with one of ``succeeded``,
     ``gate_rejected``, or ``error`` once the run resolves.

The practice agent returns a typed :class:`PracticePayload`
discriminated union (chat review §3.1, §5.1, §5.2). The agent's parse
errors propagate as 502 so misbehaving LLM shapes are visible in
Logfire (chat review §5.1: "Bad shapes surface as errors, not silent
fallbacks").

Errors are surfaced verbatim so the Studio's alert+Retry banner
can show the user what to fix (missing API key, network outage,
malformed workflow, etc.).

Why one helper, two routes? The two routes differ only in *where the
scope comes from*:

  * ``/api/practice-exercises/`` — caller supplies
    ``domainId/subjectId/chapterId/topicId`` in the body. The
    Workflow Manager uses this when running a global template from
    a chapter panel.
  * ``/api/workflows/{id}/run`` — scope is read from the workflow
    template itself (post-``/customize``). The Studio uses this when
    the user clicks Run on a customised subject-scoped template.

Splitting the helper out keeps the gate + persist + audit behaviour
identical between the two routes — the eval log semantics are
pinned by the shared call site, not duplicated in two places that
can drift (H-B4, H-X1).
"""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError
from sqlmodel import Session

from app.agents import practice_agent
from app.api._artifact_factory import append_artifact, make_artifact
from app.api.artifacts import ArtifactDTO
from app.domain.events import ArtifactGenerated
from app.domain.workspace import PracticeConfig, WorkflowTemplate
from app.harness import artifact_gate
from app.harness.event_emitter import emit_event
from app.storage import eval_runs_repo, workflows_repo, workspace_repo
from app.storage.database import get_engine

router = APIRouter(prefix="/api/practice-exercises", tags=["practice"])


# ── Request / Response bodies ───────────────────────────────────────


class RunPracticeBody(BaseModel):
    workflow_id: str = Field(alias="workflowId")
    domain_id: str = Field(alias="domainId")
    subject_id: str = Field(alias="subjectId")
    chapter_id: str | None = Field(alias="chapterId", default=None)
    topic_id: str | None = Field(alias="topicId", default=None)
    count: int | None = None
    difficulty: str | None = None

    model_config = {"populate_by_name": True}


def _resolve_names(
    domain_id: str,
    subject_id: str,
    chapter_id: str | None,
    topic_id: str | None,
) -> dict[str, str]:
    """Pull human-readable names from the workspace hierarchy."""
    out: dict[str, str] = {"subject": "the subject"}
    domain = workspace_repo.get_domain(domain_id)
    if domain is None:
        return out
    subject = next((s for s in domain.subjects if s.id == subject_id), None)
    if subject is None:
        return out
    out["subject"] = subject.name
    if chapter_id is not None:
        chapter = next((c for c in subject.chapters if c.id == chapter_id), None)
        if chapter is not None:
            out["chapter"] = chapter.name
            if topic_id is not None:
                topic = next((t for t in chapter.topics if t.id == topic_id), None)
                if topic is not None:
                    out["topic"] = topic.name
    return out


# ── Shared run helper (H-B4 audit + H-B3 real dispatch) ────────────


async def _run_workflow_for_artifact(
    request: Request,
    workflow: WorkflowTemplate,
    *,
    domain_id: str,
    subject_id: str,
    chapter_id: str | None,
    topic_id: str | None,
    count: int | None,
    difficulty: str | None,
) -> dict:  # type: ignore
    """Run a workflow end-to-end and return the persisted artifact dict.

    Writes an :class:`EvalRun` row before the LLM call; the row is
    finished with ``succeeded`` / ``gate_rejected`` / ``error`` once
    the run resolves. Raises :class:`HTTPException` on every
    user-visible failure so the caller can propagate the right
    status code.

    Note: the caller is responsible for the *pre-flight* checks
    (workflow exists, prompt template non-empty) — those failures
    short-circuit before this helper and do **not** write an
    ``eval_runs`` row, by design (ADR-0008 §3: "Rows for runs that
    never start ... are not written").
    """
    config: PracticeConfig | None = workflow.practice_config
    resolved_count = count or (config.count if config else 5)
    resolved_difficulty = difficulty or (config.difficulty if config else "medium")

    names = _resolve_names(domain_id, subject_id, chapter_id, topic_id)
    prompt = practice_agent.render_prompt(
        workflow.prompt_template,
        subject=names.get("subject", "the subject"),
        chapter=names.get("chapter", ""),
        topic=names.get("topic", ""),
        count=resolved_count,
        difficulty=resolved_difficulty,
        blindspots="",  # Phase 6+ will pipe mastery scores in here
    )

    if not prompt.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                f"Workflow '{workflow.name}' has no promptTemplate — "
                "edit the workflow and add one before running."
            ),
        )

    # ── H-B4: open the eval_runs row *before* the LLM call so
    # even a process kill mid-run leaves a traceable 'running' row
    # (the operator can find abandoned runs by status='running').
    run_id: str | None = None
    try:
        with Session(get_engine()) as session:
            run = eval_runs_repo.start_run(
                session,
                workflow_id=workflow.id,
                workflow_name=workflow.name,
                domain_id=domain_id,
                subject_id=subject_id,
                chapter_id=chapter_id,
                topic_id=topic_id,
                count=resolved_count,
                difficulty=resolved_difficulty,
            )
            run_id = run.id
    except Exception as exc:  # pragma: no cover — DB unavailable
        # DB is down: the audit log is best-effort, but the run
        # itself should still proceed. The user sees the artifact
        # gate result regardless.
        import logfire

        logfire.warning(
            "Could not open eval_runs row for workflow {wf}: {err}",
            wf=workflow.id,
            err=str(exc),
        )

    # Resolve active source IDs from the subject's resources
    source_ids: list[str] = []
    try:
        domain = workspace_repo.get_domain(domain_id)
        if domain:
            subject = next((s for s in domain.subjects if s.id == subject_id), None)
            if subject:
                source_ids = [r.id for r in subject.resources]
    except Exception as exc:  # pragma: no cover
        logfire.warning("Failed to resolve source_ids for context routing: {err}", err=str(exc))

    try:
        typed_payload = await practice_agent.generate_practice(
            prompt,
            requested_count=resolved_count,
            difficulty=resolved_difficulty,
            workflow_id=workflow.id,
            workflow_name=workflow.name,
            context_gate=getattr(request.app.state, "context_gate", None),
            source_ids=source_ids,
        )

    except ValidationError as exc:
        _finish_run(
            run_id,
            status="error",
            error_message=f"agent returned unrecognised shape: {exc!s}",
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Practice agent returned an unrecognised shape. "
                "Check the workflow's promptTemplate — it should ask "
                "for {problems|questions|summary} and return a JSON object."
            ),
        ) from exc
    except Exception as exc:  # pragma: no cover — infra failure
        _finish_run(
            run_id,
            status="error",
            error_message=f"{type(exc).__name__}: {exc!s}",
        )
        raise

    # ── H-B5: run the result through the Artifact Gate ─────────────
    # We pass a minimal duck-typed artifact (the gate uses getattr)
    # plus the live existing-artifacts list and the prompt template
    # SHA so dedup can fire (H-H1). The gate's failures are
    # surfaced to the operator; review_queue warnings are stored
    # alongside the artifact record for the Studio's review panel.
    prompt_template_sha = hashlib.sha256(
        (workflow.prompt_template or "").encode("utf-8")
    ).hexdigest()
    existing = list(getattr(request.app.state, "artifacts", []) or [])
    gate_result = await artifact_gate.validate_artifact(
        typed_payload,
        existing_artifacts=existing,
        prompt_template_sha=prompt_template_sha,
    )
    if not gate_result.passed:
        _finish_run(
            run_id,
            status="gate_rejected",
            error_message="; ".join(gate_result.failures),
            gate_failures=list(gate_result.failures),
        )
        raise HTTPException(
            status_code=502,
            detail=(
                f"Artifact gate rejected the generated artifact: {'; '.join(gate_result.failures)}"
            ),
        )

    # Persist via the factory; the discriminated union's `kind` rides
    # along on the payload dict for the frontend to narrow on.
    record = make_artifact(
        name=f"{workflow.name} — {names.get('subject', 'practice')}",
        type=workflow.target_type,
        status="draft",
        domain_id=domain_id,
        subject_id=subject_id,
        chapter_id=chapter_id,
        topic_id=topic_id,
        payload=typed_payload.model_dump(),
        prompt_template_sha=prompt_template_sha,
    )
    append_artifact(request, record)

    # ── H-H5: emit ArtifactGenerated so the event log has a row
    # linking the artifact to the workflow + scope. Downstream
    # PracticeAttempted events join on artifact_id; the mastery
    # rule (ConceptMasteryUpdated.trigger_event_id) therefore
    # remains traceable back to a specific artifact and workflow.
    try:
        with Session(get_engine()) as session:
            emit_event(
                session,
                ArtifactGenerated(
                    artifact_id=record["id"],
                    artifact_type=workflow.target_type,
                    workflow_id=workflow.id,
                    source_id=None,
                    concept_ids=None,
                ),
            )
    except Exception as exc:  # pragma: no cover — DB unavailable
        # Event emission is best-effort; the artifact is already
        # persisted. Log via the exception type only — the Studio's
        # error banner will show the gate result if anything failed.
        import logfire

        logfire.warning(
            "Failed to emit ArtifactGenerated for {artifact_id}: {error}",
            artifact_id=record["id"],
            error=str(exc),
        )

    # ── H-B4: mark the run succeeded *last* so a partial failure
    # between persist and finish still leaves an inspectable row.
    _finish_run(run_id, status="succeeded", artifact_id=record["id"])
    return record


def _finish_run(
    run_id: str | None,
    *,
    status: str,
    artifact_id: str | None = None,
    error_message: str | None = None,
    gate_failures: list[str] | None = None,
) -> None:
    """Best-effort eval_runs finaliser. Failures are logged, not raised.

    ``run_id`` is None only when the open-row call already failed
    (DB unavailable at run start). In that case there is nothing to
    finish; we silently skip.
    """
    if run_id is None:
        return
    try:
        with Session(get_engine()) as session:
            eval_runs_repo.finish_run(
                session,
                run_id,
                status=status,
                artifact_id=artifact_id,
                error_message=error_message,
                gate_failures=gate_failures,
            )
    except Exception as exc:  # pragma: no cover — DB unavailable
        import logfire

        logfire.warning(
            "Could not finish eval_runs row {run_id} ({status}): {err}",
            run_id=run_id,
            status=status,
            err=str(exc),
        )


# ── HTTP route — POST /api/practice-exercises/ ─────────────────────


@router.post("", response_model=ArtifactDTO, status_code=201)
async def run_practice_exercises(request: Request, body: RunPracticeBody) -> ArtifactDTO:
    workflow = workflows_repo.get_workflow(body.workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail=f"Workflow not found: {body.workflow_id}")
    record = await _run_workflow_for_artifact(
        request,
        workflow,
        domain_id=body.domain_id,
        subject_id=body.subject_id,
        chapter_id=body.chapter_id,
        topic_id=body.topic_id,
        count=body.count,
        difficulty=body.difficulty,
    )
    return ArtifactDTO(**record)
