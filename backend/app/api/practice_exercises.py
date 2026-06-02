"""Practice-exercises API — runs a workflow against the live LLM.

POST /api/practice-exercises/

The Studio's Run button hits this endpoint. The endpoint:
  1. Loads the workflow template.
  2. Resolves the subject / chapter / topic names.
  3. Substitutes {{…}} placeholders in the workflow's prompt.
  4. Calls the Practice Agent (Pydantic AI + ModelRouter).
  5. Persists a new artifact via :func:`make_artifact` /
     :func:`append_artifact` and returns it.

The practice agent now returns a typed :class:`PracticePayload`
discriminated union (chat review §3.1, §5.1, §5.2). The agent's parse
errors propagate as 502 so misbehaving LLM shapes are visible in
Logfire (chat review §5.1: "Bad shapes surface as errors, not silent
fallbacks").

Errors are surfaced verbatim so the Studio's alert+Retry banner
can show the user what to fix (missing API key, network outage,
malformed workflow, etc.).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError

from app.agents import practice_agent
from app.api._artifact_factory import append_artifact, make_artifact
from app.api.artifacts import ArtifactDTO
from app.domain.workspace import PracticeConfig
from app.storage import workflows_repo, workspace_repo

router = APIRouter(prefix="/api/practice-exercises", tags=["practice"])


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


@router.post("/", response_model=ArtifactDTO, status_code=201)
async def run_practice_exercises(request: Request, body: RunPracticeBody) -> ArtifactDTO:
    workflow = workflows_repo.get_workflow(body.workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail=f"Workflow not found: {body.workflow_id}")

    config: PracticeConfig | None = workflow.practice_config
    count = body.count or (config.count if config else 5)
    difficulty = body.difficulty or (config.difficulty if config else "medium")

    names = _resolve_names(body.domain_id, body.subject_id, body.chapter_id, body.topic_id)
    prompt = practice_agent.render_prompt(
        workflow.prompt_template,
        subject=names.get("subject", "the subject"),
        chapter=names.get("chapter", ""),
        topic=names.get("topic", ""),
        count=count,
        difficulty=difficulty,
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

    try:
        typed_payload = await practice_agent.generate_practice(
            prompt,
            requested_count=count,
            difficulty=difficulty,
            workflow_id=workflow.id,
            workflow_name=workflow.name,
        )
    except ValidationError as exc:
        # LLM emitted a shape we don't recognise. Surface as 502 so
        # operators can fix the prompt template (chat review §5.1:
        # "Bad shapes surface as errors, not silent fallbacks").
        raise HTTPException(
            status_code=502,
            detail=(
                f"Practice agent returned an unrecognised shape: {exc!s}. "
                "Check the workflow's promptTemplate — it should ask for "
                "{problems|questions|summary} and return a JSON object."
            ),
        ) from exc

    # Persist via the factory; the discriminated union's `kind` rides
    # along on the payload dict for the frontend to narrow on.
    record = make_artifact(
        name=f"{workflow.name} — {names.get('subject', 'practice')}",
        type=workflow.target_type,
        status="draft",
        domain_id=body.domain_id,
        subject_id=body.subject_id,
        chapter_id=body.chapter_id,
        topic_id=body.topic_id,
        payload=typed_payload.model_dump(),
    )
    append_artifact(request, record)
    return ArtifactDTO(**record)
