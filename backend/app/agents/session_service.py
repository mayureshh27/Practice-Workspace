"""Session Service — manages practice session lifecycle.

Per ADR-0022: the SessionSummaryAgent receives a serialised event list
and nothing else. Its output is verified against the session's actual
ConceptMasteryUpdated events before the Event Emitter writes it.

The agent never has access to the MemoryStore directly.
"""

from __future__ import annotations

import json
from uuid import uuid4

import logfire
from sqlmodel import Session

from app.agents.session_summary import SessionSummaryDeps, session_summary_agent
from app.domain.events import (
    ConceptMasteryUpdated,
    SessionSummaryCreated,
)
from app.harness.event_emitter import emit_event
from app.storage import event_store


def create_session() -> str:
    """Generate a new session ID."""
    session_id = str(uuid4())
    logfire.info("Created new session: {session_id}", session_id=session_id)
    return session_id


async def end_session(db_session: Session, session_id: str) -> SessionSummaryCreated | None:
    """End a session: generate and verify a session summary.

    Steps:
      1. Fetch all events for this session
      2. Serialise to a flat text list (no MemoryStore access per ADR-0022)
      3. Run the session summary agent
      4. Verify mastery_deltas match actual ConceptMasteryUpdated events
      5. Write SessionSummaryCreated via Event Emitter

    Returns the created summary event, or None if the session had no events.
    """
    # ── 1. Fetch session events ─────────────────────────────────────
    events = event_store.get_events_by_session(db_session, session_id)
    if not events:
        logfire.info(
            "No events found for session {session_id} — skipping summary",
            session_id=session_id,
        )
        return None

    # ── 2. Serialise to text (ADR-0022: agent receives only this) ──
    serialised_lines = []
    for event in events:
        event_type = event.__class__.__name__
        event_data = {
            "type": event_type,
            "id": event.id,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
        }
        # Add type-specific fields
        if hasattr(event, "concept_id"):
            event_data["concept_id"] = event.concept_id
        if hasattr(event, "verdict"):
            event_data["verdict"] = event.verdict
        if hasattr(event, "new_mastery"):
            event_data["new_mastery"] = event.new_mastery
        if hasattr(event, "previous_mastery"):
            event_data["previous_mastery"] = event.previous_mastery

        serialised_lines.append(json.dumps(event_data))

    serialised_text = "\n".join(serialised_lines)

    # ── 3. Compute actual mastery deltas for verification ──────────
    actual_deltas: dict[str, float] = {}
    for event in events:
        if isinstance(event, ConceptMasteryUpdated):
            delta = event.new_mastery - event.previous_mastery
            actual_deltas[event.concept_id] = (
                actual_deltas.get(event.concept_id, 0.0) + delta
            )

    # ── 4. Run the session summary agent ────────────────────────────
    deps = SessionSummaryDeps(session_id=session_id)

    try:
        result = await session_summary_agent.run(
            f"Summarize this practice session:\n\n{serialised_text}",
            deps=deps,
        )
        summary_output = result.output
    except Exception as exc:
        logfire.error(
            "Session summary agent failed for {session_id}: {error}",
            session_id=session_id,
            error=str(exc),
        )
        # Fallback: create a minimal summary from the event data
        concepts = list(actual_deltas.keys())
        summary_output_text = (
            f"Session covered {len(events)} events across "
            f"{len(concepts)} concepts."
        )
        summary_event = SessionSummaryCreated(
            session_id=session_id,
            summary_text=summary_output_text,
            concepts_covered=",".join(concepts),
            mastery_deltas=json.dumps(actual_deltas),
            event_count=len(events),
        )
        emit_event(db_session, summary_event)
        return summary_event

    # ── 5. Verify mastery_deltas match actual events ────────────────
    agent_deltas = summary_output.mastery_deltas
    verified = True
    for concept_id, agent_delta in agent_deltas.items():
        actual = actual_deltas.get(concept_id, 0.0)
        if abs(agent_delta - actual) > 0.001:
            logfire.warning(
                "Mastery delta mismatch for {concept}: agent={agent} actual={actual}",
                concept=concept_id,
                agent=agent_delta,
                actual=actual,
            )
            verified = False

    # Use actual deltas if verification failed
    final_deltas = actual_deltas if not verified else agent_deltas
    concepts_list = summary_output.concepts_covered or list(actual_deltas.keys())

    summary_event = SessionSummaryCreated(
        session_id=session_id,
        summary_text=summary_output.summary_text,
        concepts_covered=",".join(concepts_list),
        mastery_deltas=json.dumps(final_deltas),
        event_count=len(events),
    )
    emit_event(db_session, summary_event)
    logfire.info(
        "Session summary created for {session_id}: {event_count} events, verified={verified}",
        session_id=session_id,
        event_count=len(events),
        verified=verified,
    )
    return summary_event
