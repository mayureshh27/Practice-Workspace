"""Workspace domain models — exact mirrors of frontend workspaceTypes.ts.

All models emit **camelCase** JSON so the frontend Zod schemas validate
responses without any transformation layer.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    """Base with camelCase serialisation and by-name population."""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


# ── Leaf entities ───────────────────────────────────────────────────


class Resource(_CamelModel):
    id: str
    name: str
    lines: int
    file_type: str  # 'PDF' | 'HTML' | 'JS' | 'MD' | 'TXT' etc.


class Topic(_CamelModel):
    id: str
    name: str
    last_message: str | None = None
    pinned: bool | None = None
    archived: bool | None = None


# ── Composite entities ──────────────────────────────────────────────


class Chapter(_CamelModel):
    id: str
    name: str
    topics: list[Topic] = []
    pinned: bool | None = None
    archived: bool | None = None
    description: str | None = None
    instructions: str | None = None
    memory: str | None = None


class Subject(_CamelModel):
    id: str
    name: str
    description: str | None = None
    chapters: list[Chapter] = []
    resources: list[Resource] = []
    instructions: str | None = None
    memory: str | None = None
    pinned: bool | None = None
    archived: bool | None = None


class Domain(_CamelModel):
    id: str
    name: str
    subjects: list[Subject] = []
    pinned: bool | None = None
    archived: bool | None = None


# ── Workflow Template ───────────────────────────────────────────────


class WorkflowTemplate(_CamelModel):
    id: str
    name: str
    target_type: str  # 'Exercise Pack' | 'Lesson' | 'Quiz' | 'Summary' etc.
    description: str
    last_run: str | None = None
    eval_gates: int


# ── Artifact ────────────────────────────────────────────────────────


class Artifact(_CamelModel):
    id: str
    name: str
    type: str
    status: str  # 'approved' | 'draft' | 'reviewed'
    domain_id: str
    subject_id: str
    chapter_id: str | None = None
    topic_id: str | None = None
    time: str
