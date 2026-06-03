"""Session Service — manages practice session lifecycle.

Per ADR-0022: the SessionSummaryAgent receives a serialised event list
and nothing else. Its output is verified against the session's actual
ConceptMasteryUpdated events before the Event Emitter writes it.

The agent never has access to the MemoryStore directly.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any
from uuid import uuid4

import logfire
from sqlmodel import Session

from app.agents.session_summary import SessionSummaryDeps, session_summary_agent
from app.domain.events import (
    ConceptMasteryUpdated,
    SessionSummaryCreated,
    event_as_dict,
)
from app.harness.event_emitter import emit_event
from app.storage import event_store


def create_session() -> str:
    """Generate a new session ID."""
    session_id = str(uuid4())
    # Initialise raw session history database (per ADR-0016)
    _ensure_raw_history_db(session_id)
    logfire.info("Created new session: {session_id}", session_id=session_id)
    return session_id


def _ensure_raw_history_db(session_id: str) -> None:
    """Create an empty raw session history SQLite database.

    Per ADR-0016: raw history is written before compaction can discard
    anything. The compact summary references this path so the agent
    can recover any detail via session_history(session_id) tool call.
    """
    db_path = Path(f"sessions/{session_id}.sqlite")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE IF NOT EXISTS events ("
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "  event_type TEXT,"
        "  payload TEXT,"
        "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ")"
    )
    conn.commit()
    conn.close()
    logfire.debug("Raw session history database created: {path}", path=str(db_path))


def push_raw_event(session_id: str, event_type: str, payload: dict[str, Any]) -> None:
    """Push a raw event to the session's history database.

    Called by the harness before any compaction operation.
    The raw history survives compaction so the agent can recover
    any detail via session_history(session_id) tool call.
    """
    db_path = Path(f"sessions/{session_id}.sqlite")
    if not db_path.exists():
        _ensure_raw_history_db(session_id)
    try:
        conn = sqlite3.connect(str(db_path))
        conn.execute(
            "INSERT INTO events (event_type, payload) VALUES (?, ?)",
            (event_type, json.dumps(payload)),
        )
        conn.commit()
        conn.close()
    except Exception as exc:
        logfire.warning(
            "Failed to push raw event to session history: {error}",
            error=str(exc),
        )


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
    serialised_lines = [
        json.dumps(event_as_dict(event)) for event in events
    ]

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
