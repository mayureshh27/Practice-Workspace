"""Workspace hierarchy API — domains, subjects, chapters, topics.

Response shapes emit camelCase JSON that matches the frontend Zod schemas
in ``workspaceApi.ts`` so the UI can swap from mocks to HTTP without
any restructuring.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path

from app.domain.workspace import Chapter, Domain, Subject, Topic
from app.storage import workspace_repo

router = APIRouter(prefix="/api/domains", tags=["workspace"])


@router.get("/")
def list_domains() -> list[Domain]:
    """Return all domains with their full hierarchy."""
    return workspace_repo.get_domains()


@router.get("/{domain_id}")
def get_domain(
    domain_id: Annotated[str, Path(description="The domain ID")],
) -> Domain:
    """Return a single domain by ID."""
    domain = workspace_repo.get_domain(domain_id)
    if domain is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    return domain


@router.get("/{domain_id}/subjects/{subject_id}")
def get_subject(
    domain_id: Annotated[str, Path(description="The domain ID")],
    subject_id: Annotated[str, Path(description="The subject ID")],
) -> Subject:
    """Return a subject within a domain."""
    subject = workspace_repo.get_subject(domain_id, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.get("/{domain_id}/subjects/{subject_id}/chapters/{chapter_id}")
def get_chapter(
    domain_id: Annotated[str, Path(description="The domain ID")],
    subject_id: Annotated[str, Path(description="The subject ID")],
    chapter_id: Annotated[str, Path(description="The chapter ID")],
) -> Chapter:
    """Return a chapter within a subject."""
    chapter = workspace_repo.get_chapter(domain_id, subject_id, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.get(
    "/{domain_id}/subjects/{subject_id}/chapters/{chapter_id}/topics/{topic_id}"
)
def get_topic(
    domain_id: Annotated[str, Path(description="The domain ID")],
    subject_id: Annotated[str, Path(description="The subject ID")],
    chapter_id: Annotated[str, Path(description="The chapter ID")],
    topic_id: Annotated[str, Path(description="The topic ID")],
) -> Topic:
    """Return a topic within a chapter."""
    topic = workspace_repo.get_topic(
        domain_id, subject_id, chapter_id, topic_id
    )
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic
