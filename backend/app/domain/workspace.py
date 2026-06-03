"""Workspace domain models — exact mirrors of frontend workspaceTypes.ts.

All models emit **camelCase** JSON so the frontend Zod schemas validate
responses without any transformation layer.
"""

from typing import Literal

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


# Where a template lives in the workspace hierarchy. A workflow can be
# global (reusable everywhere), or scoped to a subject/chapter/topic.
WorkflowScope = Literal["global", "subject", "chapter", "topic"]
PracticeScope = Literal["subject", "chapter", "topic"]
DifficultyLevel = Literal["easy", "medium", "hard"]
TargetType = Literal["Exercise Pack", "Lesson", "Quiz", "Summary", "Practice Solver"]
ArtifactStatus = Literal["approved", "draft", "reviewed"]


class PracticeConfig(_CamelModel):
    """Settings that drive the practice-exercise generator."""

    count: int = 5
    difficulty: DifficultyLevel = "medium"
    scope: PracticeScope = "topic"


class WorkflowTemplate(_CamelModel):
    id: str
    name: str
    target_type: TargetType
    description: str
    last_run: str | None = None
    eval_gates: int
    # Hierarchical scope. When scope != 'global' the matching subject/
    # chapter/topic ids must be set so the Studio can group templates
    # next to the location they belong to.
    scope: WorkflowScope = "global"
    subject_id: str | None = None
    chapter_id: str | None = None
    topic_id: str | None = None
    # LLM prompt with {{placeholders}} that the practice endpoint
    # substitutes at run time. Empty string is allowed for templates
    # that don't generate text (e.g. a 'Practice Solver' is code-only).
    prompt_template: str = ""
    practice_config: PracticeConfig | None = None


# ── Artifact ────────────────────────────────────────────────────────


class Artifact(_CamelModel):
    id: str
    name: str
    type: str
    status: ArtifactStatus
    domain_id: str
    subject_id: str
    chapter_id: str | None = None
    topic_id: str | None = None
    time: str
