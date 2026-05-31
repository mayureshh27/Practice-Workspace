"""Tutor Service — orchestrates a single tutor chat turn.

Sequence per CONTEXT.md and ADR-0015 (seed-and-discover):
  1. Materialise Memory Seed Protocol files
  2. Build seed context via Context Gate
  3. Run the tutor agent with the user message
  4. Apply Socratic Gate to the response
  5. Record a HintRequested event via Event Emitter
  6. Return the validated response

The Socratic Gate is permanent (CONTEXT.md). Failed responses are
regenerated with a sharpened prompt. Responses missing a trailing
question get one appended.
"""

from __future__ import annotations

from pathlib import Path
import logfire
from sqlmodel import Session

from app.agents.tutor import TutorDeps, tutor_agent
from app.domain.events import HintRequested
from app.harness.context_gate import DefaultContextGate
from app.harness.eval_gate import SocraticGate
from app.harness.event_emitter import emit_event
from app.harness.memory_seed import materialise_learner_state

_MAX_REGENERATION_ATTEMPTS = 2

_MEMORIES_DIR = Path("memories")


async def handle_chat_turn(
    *,
    db_session: Session,
    session_id: str,
    user_message: str,
    concept_ids: list[str] | None = None,
    source_ids: list[str] | None = None,
    context_gate: DefaultContextGate | None = None,
    socratic_gate: SocraticGate | None = None,
    retrieval_router: object | None = None,
    graph_layer: object | None = None,
) -> str:
    concept_ids = concept_ids or []
    source_ids = source_ids or []

    if socratic_gate is None:
        socratic_gate = SocraticGate()

    # ── 1. Materialise Memory Seed Protocol files ───────────────────
    try:
        materialise_learner_state(db_session, _MEMORIES_DIR)
    except Exception as exc:
        logfire.warning(
            "Memory seed materialisation failed: {error}",
            error=str(exc),
        )

    # ── 2. Build seed context ───────────────────────────────────────
    memory_context: str | None = None
    if context_gate is not None:
        try:
            seed = context_gate.build_seed_context(
                task_intent=user_message,
                source_ids=source_ids,
                workflow_name=None,
            )
            memory_context = seed.memory_seed
        except Exception as exc:
            logfire.warning(
                "Context Gate assembly failed: {error}",
                error=str(exc),
            )

    # ── 3. Run the tutor agent ──────────────────────────────────────
    deps = TutorDeps(
        session_id=session_id,
        concept_ids=concept_ids,
        source_ids=source_ids,
        db_session=db_session,
        memory_context=memory_context,
        retrieval_router=retrieval_router,
        graph_layer=graph_layer,
    )

    response_text = await _run_with_socratic_gate(
        user_message=user_message,
        deps=deps,
        socratic_gate=socratic_gate,
    )

    # ── 4. Record HintRequested event ───────────────────────────────
    hint_event = HintRequested(
        session_id=session_id,
        concept_id=concept_ids[0] if concept_ids else None,
        hint_level=1,
    )
    try:
        emit_event(db_session, hint_event)
    except Exception as exc:
        logfire.error(
            "Failed to record HintRequested event: {error}",
            error=str(exc),
        )

    return response_text


async def _run_with_socratic_gate(
    *,
    user_message: str,
    deps: TutorDeps,
    socratic_gate: SocraticGate,
) -> str:
    for attempt in range(_MAX_REGENERATION_ATTEMPTS + 1):
        prompt = user_message
        if attempt > 0:
            prompt = (
                f"[SYSTEM: Your previous response was blocked by the Socratic Gate "
                f"because it contained solution code or a direct answer. "
                f"Regenerate your response following the rules strictly. "
                f"Do NOT provide any solution code or direct answers.]\n\n"
                f"{user_message}"
            )

        try:
            result = await tutor_agent.run(prompt, deps=deps)
            response_text = result.output
        except Exception as exc:
            logfire.error(
                "Tutor agent run failed: {error}",
                error=str(exc),
            )
            response_text = (
                "I'm having trouble formulating a response right now. "
                "Could you try rephrasing your question?"
            )
            return response_text

        eval_result = socratic_gate.validate_hint(response_text)

        if eval_result.passed:
            if eval_result.amended_text:
                return eval_result.amended_text
            return response_text

        logfire.warning(
            "Socratic Gate blocked response (attempt {attempt}/{max}): {failures}",
            attempt=attempt + 1,
            max=_MAX_REGENERATION_ATTEMPTS + 1,
            failures=eval_result.failures,
        )

    return (
        "I want to help you understand this concept deeply. "
        "Let's approach it step by step — what part of the problem "
        "are you finding most challenging?"
    )
