"""Artifacts API — generated artifacts from workflow agents.

GET /api/artifacts — list all artifacts
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from pydantic import BaseModel

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


class ArtifactDTO(BaseModel):
    id: str
    title: str
    type: str
    status: str  # 'approved' | 'draft' | 'reviewed'
    time: str


@router.get("/")
def list_artifacts(request: Request) -> list[ArtifactDTO]:
    """Return all generated artifacts.

    Artifacts are stored in a module-level list populated by workflow
    agents. Returns an empty list when no artifacts exist yet.
    """
    artifacts = getattr(request.app.state, "artifacts", [])
    return [ArtifactDTO(**a) for a in artifacts]
