"""Artifacts API — generated artifacts from workflow agents.

GET  /api/artifacts       — list all artifacts (most recent first)
POST /api/artifacts       — create an artifact (e.g. from a workflow run)

Construction goes through :func:`app.api._artifact_factory.make_artifact`
so the id-stamping, time-formatting, and state-mutation patterns are not
duplicated between this router and the practice-exercises router
(chat review §2.3).
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.api._artifact_factory import append_artifact, make_artifact

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


class ArtifactDTO(BaseModel):
    id: str
    name: str
    type: str
    status: str  # 'approved' | 'draft' | 'reviewed'
    time: str
    domain_id: str | None = None
    subject_id: str | None = None
    chapter_id: str | None = None
    topic_id: str | None = None
    # Discriminated union payload — ``payload["kind"]`` is one of
    # ``"practice"``, ``"quiz"``, ``"summary"`` (see
    # :mod:`app.domain.artifact`). The frontend narrows on the
    # discriminator; the server preserves it end-to-end.
    payload: dict | None = None


class CreateArtifactBody(BaseModel):
    name: str
    type: str = "Exercise Pack"
    status: str = "draft"
    domain_id: str | None = Field(default=None, alias="domainId")
    subject_id: str | None = Field(default=None, alias="subjectId")
    chapter_id: str | None = Field(default=None, alias="chapterId")
    topic_id: str | None = Field(default=None, alias="topicId")
    payload: dict | None = None

    model_config = {"populate_by_name": True}


@router.get("/", response_model=list[ArtifactDTO])
def list_artifacts(request: Request) -> list[ArtifactDTO]:
    """Return all generated artifacts, newest first.

    Artifacts are stored in a module-level list populated by workflow
    agents and the practice-exercise endpoint. Returns an empty list
    when no artifacts exist yet.
    """
    artifacts = getattr(request.app.state, "artifacts", [])
    sorted_items = sorted(
        artifacts,
        key=lambda a: a.get("time", ""),
        reverse=True,
    )
    return [ArtifactDTO(**a) for a in sorted_items]


@router.post("/", response_model=ArtifactDTO, status_code=201)
def create_artifact(request: Request, body: CreateArtifactBody) -> ArtifactDTO:
    """Append a new artifact to the in-memory store and return it.

    The Studio's practice run, the workflow editor's "Save as
    artifact" action, and any future agent code all funnel through
    this endpoint. The factory stamps ``id`` and ``time`` so the
    client doesn't have to (chat review §2.3 #1).
    """
    record = make_artifact(
        name=body.name,
        type=body.type,
        status=body.status,
        domain_id=body.domain_id,
        subject_id=body.subject_id,
        chapter_id=body.chapter_id,
        topic_id=body.topic_id,
        payload=body.payload,
    )
    append_artifact(request, record)
    return ArtifactDTO(**record)
