"""Workflow templates API — Studio panel + Workflow Manager.

GET    /api/workflows                       — list (with scope filters)
GET    /api/workflows/{id}                  — single template
POST   /api/workflows                       — create new template
PATCH  /api/workflows/{id}                  — partial update
DELETE /api/workflows/{id}                  — remove
POST   /api/workflows/{id}/duplicate        — copy a template
POST   /api/workflows/{id}/customize        — fork a global into a scoped variant

The list endpoint also surfaces a `modelConfigured` boolean derived
from the live Model Router so the Studio can disable the Run button
proactively when no provider is wired up. Per-call failures still
surface the alert+Retry flow on the client.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.api._ids import new_id
from app.api.artifacts import ArtifactDTO
from app.domain.workspace import (
    PracticeConfig,
    WorkflowScope,
    WorkflowTemplate,
)
from app.storage import workflows_repo

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


# ── Request / Response bodies ───────────────────────────────────────


class WorkflowListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    items: list[WorkflowTemplate]
    model_configured: bool = Field(alias="modelConfigured")


class CreateWorkflowBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    name: str
    target_type: str = Field(alias="targetType", default="Exercise Pack")
    description: str = ""
    scope: WorkflowScope = "global"
    subject_id: str | None = Field(alias="subjectId", default=None)
    chapter_id: str | None = Field(alias="chapterId", default=None)
    topic_id: str | None = Field(alias="topicId", default=None)
    prompt_template: str = Field(alias="promptTemplate", default="")
    practice_config: PracticeConfig | None = Field(alias="practiceConfig", default=None)
    eval_gates: int = Field(alias="evalGates", default=1)


class UpdateWorkflowBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    name: str | None = None
    target_type: str | None = Field(alias="targetType", default=None)
    description: str | None = None
    last_run: str | None = Field(alias="lastRun", default=None)
    eval_gates: int | None = Field(alias="evalGates", default=None)
    scope: WorkflowScope | None = None
    subject_id: str | None = Field(alias="subjectId", default=None)
    chapter_id: str | None = Field(alias="chapterId", default=None)
    topic_id: str | None = Field(alias="topicId", default=None)
    prompt_template: str | None = Field(alias="promptTemplate", default=None)
    practice_config: PracticeConfig | None = Field(alias="practiceConfig", default=None)


class CustomizeBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    subject_id: str | None = Field(alias="subjectId", default=None)
    chapter_id: str | None = Field(alias="chapterId", default=None)
    topic_id: str | None = Field(alias="topicId", default=None)


# ── Helpers ─────────────────────────────────────────────────────────


def _is_model_configured(request: Request) -> bool:
    """True when the live Model Router can reach a real provider.

    The "is the test provider masquerading as a real one?" check is
    owned by the router (R-2.5, chat review §2.5). The endpoint just
    asks; it never inspects ``cfg.provider`` itself.
    """
    router_obj = getattr(request.app.state, "model_router", None)
    if router_obj is None:
        return False
    try:
        return bool(router_obj.is_configured("workflow"))
    except Exception:
        return False


# ── Read endpoints ──────────────────────────────────────────────────


@router.get("", response_model=WorkflowListResponse)
def list_workflows(
    request: Request,
    scope: Annotated[WorkflowScope | None, Query()] = None,
    subject_id: Annotated[str | None, Query(alias="subjectId")] = None,
    chapter_id: Annotated[str | None, Query(alias="chapterId")] = None,
    topic_id: Annotated[str | None, Query(alias="topicId")] = None,
) -> WorkflowListResponse:
    """Return the filtered list of workflow templates.

    Studio's panel always passes the current subjectId/chapterId/
    topicId so global templates bubble up alongside scoped ones. The
    manager screen passes `scope=…` to filter by tab.
    """
    items = workflows_repo.list_workflows(
        scope=scope,
        subject_id=subject_id,
        chapter_id=chapter_id,
        topic_id=topic_id,
    )
    return WorkflowListResponse(
        items=items,
        modelConfigured=_is_model_configured(request),
    )


@router.get("/{workflow_id}", response_model=WorkflowTemplate)
def get_workflow(workflow_id: str) -> WorkflowTemplate:
    wf = workflows_repo.get_workflow(workflow_id)
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


# ── Mutations ───────────────────────────────────────────────────────


@router.post("", response_model=WorkflowTemplate, status_code=201)
def create_workflow(body: CreateWorkflowBody) -> WorkflowTemplate:
    payload = body.model_dump(by_alias=False, exclude_none=False)
    payload["id"] = new_id("wf")
    wf = WorkflowTemplate(**payload)
    return workflows_repo.add_workflow(wf)


@router.patch("/{workflow_id}", response_model=WorkflowTemplate)
def patch_workflow(workflow_id: str, body: UpdateWorkflowBody) -> WorkflowTemplate:
    fields = body.model_dump(exclude_none=True)
    updated = workflows_repo.update_workflow(workflow_id, fields)
    if updated is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return updated


@router.delete("/{workflow_id}", status_code=204)
def remove_workflow(workflow_id: str):  # type: ignore
    if not workflows_repo.delete_workflow(workflow_id):
        raise HTTPException(status_code=404, detail="Workflow not found")


@router.post("/{workflow_id}/duplicate", response_model=WorkflowTemplate, status_code=201)
def duplicate_workflow(workflow_id: str) -> WorkflowTemplate:
    copy = workflows_repo.duplicate_workflow(workflow_id)
    if copy is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return copy


@router.post("/{workflow_id}/customize", response_model=WorkflowTemplate, status_code=201)
def customize_workflow(workflow_id: str, body: CustomizeBody) -> WorkflowTemplate:
    """Fork a global workflow into a subject/chapter/topic-scoped variant."""
    fork = workflows_repo.customize_workflow(
        workflow_id,
        subject_id=body.subject_id,
        chapter_id=body.chapter_id,
        topic_id=body.topic_id,
    )
    if fork is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot customise: source workflow missing or no target "
                "subjectId/chapterId/topicId provided."
            ),
        )
    return fork


# ── Real dispatch (Phase 5 — H-B3, X-1, X-2) ───────────────────────


class RunWorkflowBody(BaseModel):
    """Body for POST /api/workflows/{id}/run.

    The workflow already carries its scope (post-``/customize`` for
    subject-scoped variants; the body still needs the matching
    ``domainId`` because the workflow template does not persist it
    — only the scope chain. Optional fields override the
    workflow's saved scope at call time (useful for "Run in a
    different chapter" affordances the Studio can add later).
    """

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    domain_id: str = Field(alias="domainId")
    chapter_id: str | None = Field(alias="chapterId", default=None)
    topic_id: str | None = Field(alias="topicId", default=None)
    count: int | None = None
    difficulty: str | None = None


@router.post("/{workflow_id}/run", response_model=ArtifactDTO, status_code=201)
async def run_workflow(workflow_id: str, request: Request, body: RunWorkflowBody) -> ArtifactDTO:
    """Real dispatch for the Studio's Run button.

    Closes **H-B3** ("Run button must reach the live agent"),
    **X-1** ("workflow run is a thin pass-through that does not
    persist artifact state") and **X-2** ("Run button ignores
    workflow scope"):

    * **H-B3 / X-1**: the call goes through the shared
      :func:`app.api.practice_exercises._run_workflow_for_artifact`
      helper — same LLM call, same artifact gate, same persist path
      as ``/api/practice-exercises/``, plus the ``eval_runs`` audit
      log (H-B4).
    * **X-2**: the workflow's saved ``subjectId`` (and optional
      ``chapterId`` / ``topicId``) is preferred over the body's
      overrides when set — the customised scope wins, and the
      operator sees the artifact pinned to that subject.
    """
    # Imported here to avoid a circular import at module load
    # (practice_exercises imports WorkflowTemplate from workspace).
    from app.api.practice_exercises import _run_workflow_for_artifact

    workflow = workflows_repo.get_workflow(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_id}")

    # X-2: the workflow's saved scope takes precedence; the body
    # may override chapter/topic for the same subject. Domain is
    # always caller-supplied (the workflow template doesn't carry
    # it — scope chain is subject → chapter → topic, not domain).
    subject_id = workflow.subject_id
    chapter_id = body.chapter_id if body.chapter_id is not None else workflow.chapter_id
    topic_id = body.topic_id if body.topic_id is not None else workflow.topic_id

    if subject_id is None:
        # Global workflow run via /run still needs a target subject
        # for the artifact to attach to. The caller is expected to
        # have customised the workflow first (X-2's whole point).
        raise HTTPException(
            status_code=400,
            detail=(
                f"Workflow '{workflow.name}' is global; /run requires "
                "a subject-scoped template. POST /api/workflows/"
                f"{workflow_id}/customize first."
            ),
        )

    record = await _run_workflow_for_artifact(
        request,
        workflow,
        domain_id=body.domain_id,
        subject_id=subject_id,
        chapter_id=chapter_id,
        topic_id=topic_id,
        count=body.count,
        difficulty=body.difficulty,
    )
    return ArtifactDTO(**record)
