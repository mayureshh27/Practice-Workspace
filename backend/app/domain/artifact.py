"""Practice-artifact payload shapes — the single source of truth.

The practice agent emits one of three payload kinds (problems / quiz /
summary). The discriminator (``kind``) lives on the payload itself; the
items inside ``problems`` carry a separate ``kind="placeholder"`` marker
for stub rows the agent appends when the model returns fewer than
requested.

This is the backend mirror of the frontend type proposed in chat review
§3.1. We chose to **drop** the ``generic`` variant from the original
proposal (hard-fail on unknown shape per chat review §5.1's "Bad shapes
surface as errors, not silent fallbacks" recommendation).

Refs:
  * ``docs/reviews/code-review-by-layer.md`` — findings 5.1, 5.2
  * ``docs/reviews/review.md`` — §3.1, §5.1, §5.2
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

# ── Item-level models (the "things inside problems[]") ─────────────────


class PracticeProblem(BaseModel):
    """A real practice problem. The UI renders these as full exercises.

    Carries ``kind="problem"`` so the discriminated union on the parent
    ``problems`` list can route. (Items with ``kind="placeholder"`` are
    the explicit stubs.)
    """

    kind: Literal["problem"] = "problem"
    title: str
    prompt: str
    hints: list[str] = []


class PlaceholderProblem(BaseModel):
    """A stub appended when the LLM returned fewer problems than requested.

    The ``kind="placeholder"`` marker lets the UI render these differently
    (grey out, "stub" badge, click-to-rerun affordance). Addresses chat
    review §5.2: explicit kind field, not a fake problem masquerading
    as real.
    """

    kind: Literal["placeholder"] = "placeholder"
    title: str
    prompt: str
    hints: list[str] = []


# A practice-problem list item is either a real problem or a placeholder.
# Pydantic v2 discriminated union on ``kind`` — both variants MUST declare
# the discriminator field (PydanticUserError otherwise).
PracticeItem = Annotated[
    Union[PracticeProblem, PlaceholderProblem],
    Field(discriminator="kind"),
]


class QuizQuestion(BaseModel):
    """A multiple-choice quiz question."""

    q: str
    options: list[str]
    answer: int
    why: str = ""


# ── Payload-level models (the three top-level shapes) ─────────────────


class PracticePayloadPractice(BaseModel):
    """A practice-problems payload — ``kind: practice``.

    Emitted by the practice agent when the LLM returns a list of
    problems (the dominant shape). Items inside ``problems`` may be
    ``PracticeProblem`` or ``PlaceholderProblem`` (the latter with
    ``kind="placeholder"``).
    """

    kind: Literal["practice"] = "practice"
    problems: list[PracticeItem]
    requested_count: int
    difficulty: str
    workflow_id: str | None = None
    workflow_name: str | None = None


class PracticePayloadQuiz(BaseModel):
    """A quiz-questions payload — ``kind: quiz``."""

    kind: Literal["quiz"] = "quiz"
    questions: list[QuizQuestion]
    requested_count: int
    workflow_id: str | None = None
    workflow_name: str | None = None


class PracticePayloadSummary(BaseModel):
    """A summary payload — ``kind: summary``."""

    kind: Literal["summary"] = "summary"
    text: str
    workflow_id: str | None = None
    workflow_name: str | None = None


# The single source of truth for practice-artifact payload shapes.
# Pydantic v2 discriminated union on ``kind``.
PracticePayload = Annotated[
    Union[PracticePayloadPractice, PracticePayloadQuiz, PracticePayloadSummary],
    Field(discriminator="kind"),
]
