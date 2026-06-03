"""Practice Agent — generates practice exercises / quizzes / summaries.

Used by /api/practice-exercises to materialise a workflow run. The
agent's role is narrow: take a workflow template + scope context,
substitute prompt placeholders, and emit a JSON blob matching the
template's expected shape.

The agent returns a typed :class:`~app.domain.artifact.PracticePayload`
(discriminated union on ``kind``). The discriminator is preserved
end-to-end so the frontend can narrow on the payload kind without
manual shape detection (chat review §3.1, §5.1, §5.2).

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
from typing import Any, cast

from pydantic import TypeAdapter, ValidationError
from pydantic_ai import Agent

from app.domain.artifact import (
    PlaceholderProblem,
    PracticeItem,
    PracticePayload,
    PracticePayloadPractice,
    PracticePayloadQuiz,
    PracticePayloadSummary,
    PracticeProblem,
    QuizQuestion,
)
from app.harness.model_router import DefaultModelRouter, ModelRouter, ModelRouteRequest, ModelConfig

# TypeAdapter used to surface a clean discriminated-union error when
# the LLM emits an unrecognised shape. The parsing logic below builds
# the right variant from the raw dict; the adapter is the safety net
# that turns "no recognised key" into a typed ValidationError.
_payload_adapter: TypeAdapter[PracticePayload] = TypeAdapter(PracticePayload)

_router: ModelRouter = DefaultModelRouter()


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


def _build_agent(model_config: ModelConfig, system_prompt: str) -> Agent[None, str]:
    """Build a request-scoped Agent with the given config and system prompt."""
    return Agent(  # type: ignore[call-overload]
        cast(Any, model_config.pydantic_ai_model()),
        deps_type=None,
        output_type=str,
        instructions=system_prompt,
    )


# Built once at import time using the router's default; if the
# operator changes the model via PRACDA_OVERRIDE_MODEL the next
# process restart will pick it up.
practice_agent: Agent[None, str] = _build_agent(
    _router.route("workflow"),
    _SYSTEM_PROMPT,
)



# ── Public surface ──────────────────────────────────────────────────


# JSON objects the LLM may emit, in order of preference.
_PROBLEM_KEYS = ("problems", "exercises")
_SUMMARY_KEY = "summary"
_QUESTIONS_KEY = "questions"

# Tolerated noise around the JSON (fences, leading prose, trailing
# "Let me know..." notes from chatty models).
_JSON_OBJECT = re.compile(r"\{[\s\S]*\}")


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


def _pad_with_placeholders(items: list[PracticeItem], requested_count: int) -> list[PracticeItem]:
    """Pad a short problems list with ``kind="placeholder"`` stubs.

    Surplus items are truncated (deterministic, no shuffling). The
    ``kind="placeholder"`` marker is preserved end-to-end so the UI
    renders stubs distinctly (chat review §5.2).
    """
    if len(items) >= requested_count:
        return list(items[:requested_count])
    padded: list[PracticeItem] = list(items)
    while len(padded) < requested_count:
        padded.append(
            PlaceholderProblem(
                title=f"Placeholder problem {len(padded) + 1}",
                prompt=(
                    "The model returned fewer problems than requested. "
                    "Click *Rerun* on this artifact to regenerate."
                ),
            )
        )
    return padded


def parse_practice_payload(
    raw: dict[str, Any],
    *,
    requested_count: int,
) -> PracticePayload:
    """Parse the LLM's raw output into a typed :class:`PracticePayload`.

    Strict: raises :class:`pydantic.ValidationError` on unknown shape.
    No silent ``"Generated content"`` fallback (chat review §5.1).

    Recognised keys (in order of precedence):

    * ``problems`` / ``exercises`` — list of {title, prompt, hints?}
    * ``questions`` — list of {q, options, answer, why?}
    * ``summary`` — string

    The caller is responsible for the ``requested_count``, ``difficulty``,
    ``workflow_id``, ``workflow_name`` fields on the returned payload —
    they don't live in the LLM's output.
    """
    if not isinstance(raw, dict):
        raise ValidationError.from_exception_data(
            "PracticePayload",
            [
                {
                    "type": "model_type",
                    "loc": ("raw",),
                    "input": raw,
                    "ctx": {"expected": "dict"},
                }
            ],
        )

    # Practice problems (or the "exercises" alias some templates use).
    for key in _PROBLEM_KEYS:
        items = raw.get(key)
        if isinstance(items, list):
            problems: list[PracticeItem] = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                problems.append(PracticeProblem(**item))
            problems = _pad_with_placeholders(problems, requested_count)
            return PracticePayloadPractice(
                problems=problems,
                requested_count=requested_count,
                difficulty="medium",  # overridden by caller via metadata
            )


    if _QUESTIONS_KEY in raw:
        questions_raw = raw[_QUESTIONS_KEY]
        if isinstance(questions_raw, list):
            questions = [QuizQuestion(**q) for q in questions_raw]
            return PracticePayloadQuiz(
                questions=questions,
                requested_count=requested_count,
            )


    if _SUMMARY_KEY in raw and isinstance(raw[_SUMMARY_KEY], str):
        return PracticePayloadSummary(text=raw[_SUMMARY_KEY])

    # No recognised key — the LLM emitted an unsupported shape.
    # Delegate to the TypeAdapter so the error message includes
    # the discriminator and variant context. Operators see exactly
    # which key the parser was looking for.
    _payload_adapter.validate_python(raw)
    # Unreachable: validate_python raises on the unknown shape. The
    # return keeps mypy happy.
    raise ValidationError("no recognised key in payload", PracticePayload)


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
        template.replace("{{subject}}", subject)
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
    difficulty: str = "medium",
    workflow_id: str = "",
    workflow_name: str = "",
    context_gate: Any | None = None,
    source_ids: list[str] | None = None,
) -> PracticePayload:
    """Call the LLM and return a typed :class:`PracticePayload`."""
    model_config = _router.route(
        ModelRouteRequest(
            task_type="workflow",
            workflow_id=workflow_id or None,
        )
    )

    system_prompt = _SYSTEM_PROMPT
    prompt_with_context = prompt

    if context_gate is not None:
        try:
            seed_ctx = context_gate.build_seed_context(
                task_intent=prompt,
                source_ids=source_ids or [],
                workflow_name=workflow_name or None,
            )
            system_prompt = seed_ctx.system_slot
            
            context_blocks = []
            if seed_ctx.workflow_template:
                context_blocks.append(f"Workflow Template:\n{seed_ctx.workflow_template}")
            if seed_ctx.memory_seed:
                context_blocks.append(f"Learner Memory:\n{seed_ctx.memory_seed}")
            if seed_ctx.graph_seed:
                context_blocks.append(f"Concept Graph:\n{seed_ctx.graph_seed}")
            if seed_ctx.retrieved_chunks:
                context_blocks.append("Source Context:\n" + "\n".join(seed_ctx.retrieved_chunks))
            if seed_ctx.history:
                context_blocks.append("History:\n" + "\n".join(seed_ctx.history))
            if seed_ctx.examples:
                context_blocks.append("Examples:\n" + "\n".join(seed_ctx.examples))
                
            if context_blocks:
                prompt_with_context = "\n\n".join(context_blocks) + "\n\nTask Intent:\n" + prompt
        except Exception as exc:
            import logfire
            logfire.warning("Failed to build seed context: {exc}", exc=str(exc))

    agent = _build_agent(model_config, system_prompt)

    try:
        result = await agent.run(prompt_with_context)
    except Exception as exc:
        # LLM infra failure — return a stub so the artifact has
        # *something* to show. The UI's "Rerun" affordance
        # surfaces the underlying error in the toast.
        stub_problems: list[PracticeItem] = [
            PlaceholderProblem(
                title=f"Stub problem {i + 1}",
                prompt=f"(LLM call failed: {exc!s})",
            )
            for i in range(requested_count)
        ]
        return PracticePayloadPractice(
            problems=stub_problems,
            requested_count=requested_count,
            difficulty=difficulty,
            workflow_id=workflow_id or None,
            workflow_name=workflow_name or None,
        )


    raw_text: str = result.output if isinstance(result.output, str) else str(result.output)
    raw_payload = _extract_json(raw_text) or {}
    typed = parse_practice_payload(raw_payload, requested_count=requested_count)

    # Stamp caller-supplied metadata onto the payload variants that
    # carry the fields. Summary doesn't carry count/difficulty; quiz
    # carries count but not difficulty (per the type definitions).
    if isinstance(typed, PracticePayloadPractice):
        return typed.model_copy(
            update={
                "difficulty": difficulty,
                "workflow_id": workflow_id or None,
                "workflow_name": workflow_name or None,
            }
        )
    if isinstance(typed, PracticePayloadQuiz):
        return typed.model_copy(
            update={
                "workflow_id": workflow_id or None,
                "workflow_name": workflow_name or None,
            }
        )
    if isinstance(typed, PracticePayloadSummary):
        return typed.model_copy(
            update={
                "workflow_id": workflow_id or None,
                "workflow_name": workflow_name or None,
            }
        )
    return typed
