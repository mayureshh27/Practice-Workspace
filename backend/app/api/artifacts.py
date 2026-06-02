"""Artifacts API — generated artifacts from workflow agents.

GET  /api/artifacts       — list all artifacts (most recent first)
POST /api/artifacts       — create an artifact (e.g. from a workflow run)
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

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
    # Optional payload — the practice endpoint (Phase 6) drops the
    # generated problems here. We accept arbitrary structured content
    # so different artifact kinds (summary text, quiz JSON, exercise
    # list, etc.) all round-trip through the same channel.
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
    this endpoint. The server stamps ``id`` (timestamp-based) and
    ``time`` (ISO-8601) so the client doesn't have to.
    """
    artifacts = getattr(request.app.state, "artifacts", [])
    now = time.time()
    artifact_id = f"art-{int(now * 1000)}"
    # Dump by name (snake_case) so the keys match ArtifactDTO's fields.
    record = body.model_dump(by_alias=False, exclude_none=True)
    record["id"] = artifact_id
    record["time"] = time.strftime("%Y-%m-%dT%H:%M:%S.", time.gmtime()) + f"{int((now % 1) * 1000):03d}Z"
    artifacts.append(record)
    request.app.state.artifacts = artifacts
    return ArtifactDTO(**record)
