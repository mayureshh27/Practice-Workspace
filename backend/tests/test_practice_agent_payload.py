"""Tests for the PracticePayload discriminated union and parse_practice_payload.

The discriminated union is the *single source of truth* for practice-artifact
payload shapes (findings 5.1, 5.2; chat review §3.1, §5.1, §5.2). The parse
function replaces ``_coerce_problems`` + ``_pad_problems`` with a single
strict entry point that:

  * accepts the three observed shapes (problems / questions / exercises /
    summary) — exercises is an alias for problems because some templates
    use the term interchangeably;
  * rejects unknown shapes with ``pydantic.ValidationError`` — no silent
    ``"Generated content"`` fallback (chat review §5.1: "Bad shapes surface
    as errors, not silent fallbacks");
  * pads short outputs with ``kind="placeholder"`` items so the UI can
    render stubs distinctly (chat review §5.2: explicit kind field, not
    a fake problem masquerading as real).

Refs:
  * ``docs/reviews/code-review-by-layer.md`` — findings 5.1, 5.2
  * ``docs/reviews/review.md`` — §3.1 (frontend ArtifactPayload union),
    §5.1, §5.2
  * ``docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`` §"Phase 3"
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.agents.practice_agent import parse_practice_payload
from app.domain.artifact import (
    PlaceholderProblem,
    PracticePayloadPractice,
    PracticePayloadQuiz,
    PracticePayloadSummary,
    PracticeProblem,
)

# ── Practice problems shape (the dominant shape) ──────────────────────


def test_parse_payload_problems_returns_practice_kind():
    payload = parse_practice_payload(
        {"problems": [{"title": "First", "prompt": "P1", "hints": []}]},
        requested_count=1,
    )
    assert isinstance(payload, PracticePayloadPractice)
    assert payload.kind == "practice"
    assert payload.problems[0].title == "First"
    # Round-trips to a dict with the discriminator present (chat review §3.1).
    dumped = payload.model_dump()
    assert dumped["kind"] == "practice"
    assert dumped["problems"][0]["title"] == "First"


def test_parse_payload_exercises_is_alias_for_problems():
    """Some templates use 'exercises' instead of 'problems' — same shape."""
    payload = parse_practice_payload(
        {"exercises": [{"title": "Ex", "prompt": "P"}]},
        requested_count=1,
    )
    assert isinstance(payload, PracticePayloadPractice)
    assert payload.problems[0].title == "Ex"


# ── Quiz questions shape ──────────────────────────────────────────────


def test_parse_payload_questions_returns_quiz_kind():
    payload = parse_practice_payload(
        {"questions": [{"q": "Q1", "options": ["a", "b", "c", "d"], "answer": 0, "why": "w"}]},
        requested_count=1,
    )
    assert isinstance(payload, PracticePayloadQuiz)
    assert payload.kind == "quiz"
    assert payload.questions[0].q == "Q1"
    assert payload.questions[0].answer == 0


# ── Summary shape ─────────────────────────────────────────────────────


def test_parse_payload_summary_returns_summary_kind():
    payload = parse_practice_payload(
        {"summary": "This is the long-form summary text."},
        requested_count=1,
    )
    assert isinstance(payload, PracticePayloadSummary)
    assert payload.kind == "summary"
    assert payload.text.startswith("This is the long-form")


# ── Hard-fail on unknown shape (chat review §5.1) ────────────────────


def test_parse_payload_raises_validation_error_on_unknown_shape():
    """No silent 'Generated content' fallback. The LLM is misbehaving —
    surface the error so the prompt template can be fixed."""
    with pytest.raises(ValidationError) as exc_info:
        parse_practice_payload(
            {"unexpected_key": "unexpected_value"},
            requested_count=1,
        )
    # The error mentions the missing discriminator so operators can grep.
    err_text = str(exc_info.value)
    assert "kind" in err_text or "discriminator" in err_text or "problems" in err_text


# ── Padding to requested_count with kind="placeholder" ───────────────


def test_parse_payload_pads_short_output_with_placeholders():
    """If the LLM returns 1 problem and count=4, pad with 3 placeholders.
    The placeholders carry kind='placeholder' so the UI renders them
    differently (chat review §5.2)."""
    payload = parse_practice_payload(
        {"problems": [{"title": "Real", "prompt": "P"}]},
        requested_count=4,
    )
    assert isinstance(payload, PracticePayloadPractice)
    assert len(payload.problems) == 4
    assert isinstance(payload.problems[0], PracticeProblem)
    assert payload.problems[0].kind == "problem"
    for i in range(1, 4):
        assert isinstance(payload.problems[i], PlaceholderProblem)
        assert payload.problems[i].kind == "placeholder"
        assert "Placeholder" in payload.problems[i].title


def test_parse_payload_truncates_overlong_output():
    """If the LLM returns 10 problems and count=3, slice to 3.
    The model over-produced; we keep the first N (deterministic, no
    shuffling, no random sampling)."""
    payload = parse_practice_payload(
        {"problems": [{"title": f"P{i}", "prompt": "x"} for i in range(10)]},
        requested_count=3,
    )
    assert isinstance(payload, PracticePayloadPractice)
    assert len(payload.problems) == 3
    assert [p.title for p in payload.problems] == ["P0", "P1", "P2"]
