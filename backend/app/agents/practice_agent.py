"""Practice Agent — generates practice exercises / quizzes / summaries.

Used by /api/practice-exercises to materialise a workflow run. The
agent's role is narrow: take a workflow template + scope context,
substitute prompt placeholders, and emit a JSON blob matching the
template's expected shape.

We don't reuse the broader Workflow Agent because:
  - The Studio's Run button is a direct LLM call; it doesn't go
    through the full Agent + Tool loop (no source search, no
    memory seed round-trips). Keeping the practice call simple
    makes the path easy to mock in tests and easy to reason about
    on a hot key.
  - The model_router already exposes a `workflow` task type with
    the right defaults (gemini-2.5-flash, 8k context, 0 temp).
"""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic_ai import Agent
from pydantic_ai.messages import ModelMessage

from app.harness.model_router import DefaultModelRouter, ModelRouter

_router: ModelRouter = DefaultModelRouter()


def _resolve_model() -> str:
    cfg = _router.route("workflow")
    return cfg.pydantic_ai_model()


_SYSTEM_PROMPT = (
    "You are the PracDaGo Practice Agent. You take a structured prompt "
    "from a workflow template and return a strict JSON object. "
    "Do not include any prose, code fences, or commentary outside the "
    "JSON object. If the prompt asks for problems, return "
    '{"problems": [{"title": "...", "prompt": "...", "hints": ["..."]}]}. '
    "If it asks for a quiz, return "
    '{"questions": [{"q": "...", "options": ["...", "...", "...", "..."], '
    '"answer": 0, "why": "..."}]}. '
    "If it asks for a summary, return "
    '{"summary": "..."}.'
)


# Built once at import time using the router's default; if the
# operator changes the model via PRACDA_OVERRIDE_MODEL the next
# process restart will pick it up.
practice_agent: Agent[None, str] = Agent(
    _resolve_model(),
    deps_type=None,
    output_type=str,
    instructions=_SYSTEM_PROMPT,
)


# ── Public surface ──────────────────────────────────────────────────


# JSON objects the LLM may emit, in order of preference.
_PROBLEM_SHAPES = ("problems", "questions", "exercises")
_SUMMARY_SHAPE = "summary"

# Tolerated noise around the JSON (fences, leading prose, trailing
# "Let me know..." notes from chatty models).
_JSON_OBJECT = re.compile(r"\{[\s\S]*\}")


def _coerce_problems(payload: dict, requested_count: int) -> list[dict]:
    """Normalise whatever the model returned into a list of problems.

    Tries problems / questions / exercises keys in turn, falling
    back to wrapping a summary string as a single problem so the
    UI never sees an empty Generated History.
    """
    for key in _PROBLEM_SHAPES:
        items = payload.get(key)
        if isinstance(items, list) and items:
            return list(items)

    summary = payload.get(_SUMMARY_SHAPE)
    if isinstance(summary, str) and summary.strip():
        return [{"title": "Summary", "prompt": summary.strip(), "hints": []}]

    # Last resort: stringify the entire payload so the artifact
    # has *something* to show.
    return [{
        "title": "Generated content",
        "prompt": json.dumps(payload, indent=2),
        "hints": [],
    }]


def _pad_problems(problems: list[dict], requested_count: int) -> list[dict]:
    """Pad short LLM outputs up to the requested count with stubs.

    The Studio's UI shows "Generated N problems" — we don't want
    to promise 5 and ship 2 just because the model truncated.
    The padding hints are obvious in the UI so the user can tell
    the difference between a real problem and a stub.
    """
    if len(problems) >= requested_count:
        return problems[:requested_count]
    missing = requested_count - len(problems)
    for i in range(missing):
        problems.append({
            "title": f"Placeholder problem {len(problems) + 1}",
            "prompt": (
                "The model returned fewer problems than requested. "
                "Click *Rerun* on this artifact to regenerate."
            ),
            "hints": [],
        })
    return problems


def _extract_json(text: str) -> dict[str, Any] | None:
    """Pull the first JSON object out of a chatty LLM response."""
    if not text:
        return None
    # Direct parse first.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip code fences if present.
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped, count=1)
        stripped = re.sub(r"\s*```\s*$", "", stripped, count=1)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    # Last resort: pull the outermost {...} block.
    match = _JSON_OBJECT.search(stripped)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def render_prompt(
    template: str,
    *,
    subject: str,
    chapter: str = "",
    topic: str = "",
    count: int = 5,
    difficulty: str = "medium",
    blindspots: str = "",
) -> str:
    """Substitute {{…}} placeholders in a workflow prompt template.

    Unknown placeholders are left as-is so the user can spot
    typos in the template; the LLM is robust enough to ignore them.
    """
    return (
        template
        .replace("{{subject}}", subject)
        .replace("{{chapter}}", chapter)
        .replace("{{topic}}", topic)
        .replace("{{count}}", str(count))
        .replace("{{difficulty}}", difficulty)
        .replace("{{blindspots}}", blindspots or "(no blind spots recorded yet)")
    )


async def generate_practice(
    prompt: str,
    *,
    requested_count: int = 5,
) -> tuple[list[dict], dict | None, str | None]:
    """Call the LLM and return (problems, raw_payload, error_message).

    Always returns a non-empty `problems` list — see
    ``_coerce_problems`` and ``_pad_problems``. The raw payload and
    error message are surfaced for observability / debugging.
    """
    try:
        result = await practice_agent.run(prompt)
    except Exception as exc:  # noqa: BLE001 — surface to the API caller
        return (
            [{
                "title": f"Stub problem {i + 1}",
                "prompt": f"(LLM call failed: {exc!s})",
                "hints": [],
            } for i in range(requested_count)],
            None,
            str(exc),
        )

    raw_text: str = result.output if isinstance(result.output, str) else str(result.output)
    payload = _extract_json(raw_text) or {}
    problems = _coerce_problems(payload, requested_count)
    problems = _pad_problems(problems, requested_count)
    return problems, payload, None
