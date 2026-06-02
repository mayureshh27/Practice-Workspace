"""Workspace hierarchy API — domains, subjects, chapters, topics.

Response shapes emit camelCase JSON that matches the frontend Zod schemas
in ``workspaceApi.ts`` so the UI can swap from mocks to HTTP without
any restructuring.

CRUD mutations persist to a JSON snapshot file next to the SQLite DB.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.domain.workspace import Chapter, Domain, Subject, Topic
from app.storage import workspace_repo

router = APIRouter(prefix="/api/domains", tags=["workspace"])


# ── Read endpoints ──────────────────────────────────────────────────


@router.get("/")
def list_domains() -> list[Domain]:
    return workspace_repo.get_domains()


@router.get("/{domain_id}")
def get_domain(domain_id: str) -> Domain:
    domain = workspace_repo.get_domain(domain_id)
    if domain is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    return domain


@router.get("/{domain_id}/subjects/{subject_id}")
def get_subject(domain_id: str, subject_id: str) -> Subject:
    subject = workspace_repo.get_subject(domain_id, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.get("/{domain_id}/subjects/{subject_id}/chapters/{chapter_id}")
def get_chapter(domain_id: str, subject_id: str, chapter_id: str) -> Chapter:
    chapter = workspace_repo.get_chapter(domain_id, subject_id, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.get("/{domain_id}/subjects/{subject_id}/chapters/{chapter_id}/topics/{topic_id}")
def get_topic(domain_id: str, subject_id: str, chapter_id: str, topic_id: str) -> Topic:
    topic = workspace_repo.get_topic(domain_id, subject_id, chapter_id, topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


# ── Mutation endpoints ──────────────────────────────────────────────


class CreateDomainBody(BaseModel):
    name: str


@router.post("", status_code=201)
def create_domain(body: CreateDomainBody) -> Domain:
    return workspace_repo.add_domain(body.name)


@router.post("/", status_code=201, include_in_schema=False)
def create_domain_slash(body: CreateDomainBody) -> Domain:
    return workspace_repo.add_domain(body.name)


class UpdateDomainBody(BaseModel):
    name: str | None = None
    pinned: bool | None = None
    archived: bool | None = None


@router.patch("/{domain_id}")
def patch_domain(domain_id: str, body: UpdateDomainBody) -> Domain:
    fields = body.model_dump(exclude_none=True)
    updated = workspace_repo.update_domain(domain_id, fields)
    if updated is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    return updated


@router.delete("/{domain_id}", status_code=204)
def remove_domain(domain_id: str):
    if not workspace_repo.delete_domain(domain_id):
        raise HTTPException(status_code=404, detail="Domain not found")


class CreateSubjectBody(BaseModel):
    name: str
    description: str | None = None


@router.post("/{domain_id}/subjects", status_code=201)
def create_subject(domain_id: str, body: CreateSubjectBody) -> Subject:
    subject = workspace_repo.add_subject(domain_id, body.name, body.description)
    if subject is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    return subject


@router.post("/{domain_id}/subjects/", status_code=201, include_in_schema=False)
def create_subject_slash(domain_id: str, body: CreateSubjectBody) -> Subject:
    subject = workspace_repo.add_subject(domain_id, body.name, body.description)
    if subject is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    return subject


class UpdateSubjectBody(BaseModel):
    name: str | None = None
    description: str | None = None
    pinned: bool | None = None
    archived: bool | None = None
    instructions: str | None = None
    memory: str | None = None


@router.patch("/{domain_id}/subjects/{subject_id}")
def patch_subject(domain_id: str, subject_id: str, body: UpdateSubjectBody) -> Subject:
    fields = body.model_dump(exclude_none=True)
    updated = workspace_repo.update_subject(domain_id, subject_id, fields)
    if updated is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    return updated


@router.delete("/{domain_id}/subjects/{subject_id}", status_code=204)
def remove_subject(domain_id: str, subject_id: str):
    if not workspace_repo.delete_subject(domain_id, subject_id):
        raise HTTPException(status_code=404, detail="Subject not found")


class CreateChapterBody(BaseModel):
    name: str
    description: str | None = None


@router.post("/{domain_id}/subjects/{subject_id}/chapters", status_code=201)
def create_chapter(domain_id: str, subject_id: str, body: CreateChapterBody) -> Chapter:
    chapter = workspace_repo.add_chapter(domain_id, subject_id, body.name, body.description)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    return chapter


@router.post("/{domain_id}/subjects/{subject_id}/chapters/", status_code=201, include_in_schema=False)
def create_chapter_slash(domain_id: str, subject_id: str, body: CreateChapterBody) -> Chapter:
    chapter = workspace_repo.add_chapter(domain_id, subject_id, body.name, body.description)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    return chapter


class UpdateChapterBody(BaseModel):
    name: str | None = None
    description: str | None = None
    instructions: str | None = None
    memory: str | None = None
    pinned: bool | None = None
    archived: bool | None = None


@router.patch("/{domain_id}/subjects/{subject_id}/chapters/{chapter_id}")
def patch_chapter(domain_id: str, subject_id: str, chapter_id: str, body: UpdateChapterBody) -> Chapter:
    fields = body.model_dump(exclude_none=True)
    updated = workspace_repo.update_chapter(domain_id, subject_id, chapter_id, fields)
    if updated is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return updated


class CreateTopicBody(BaseModel):
    name: str


@router.post("/{domain_id}/subjects/{subject_id}/chapters/{chapter_id}/topics", status_code=201)
def create_topic(domain_id: str, subject_id: str, chapter_id: str, body: CreateTopicBody) -> Topic:
    topic = workspace_repo.add_topic(domain_id, subject_id, chapter_id, body.name)
    if topic is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return topic


@router.post("/{domain_id}/subjects/{subject_id}/chapters/{chapter_id}/topics/", status_code=201, include_in_schema=False)
def create_topic_slash(domain_id: str, subject_id: str, chapter_id: str, body: CreateTopicBody) -> Topic:
    topic = workspace_repo.add_topic(domain_id, subject_id, chapter_id, body.name)
    if topic is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return topic
