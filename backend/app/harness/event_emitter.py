"""Event Emitter — harness primitive for learning loop events.

Per CONTEXT.md and ADR-0014:
- The Event Emitter is the ONLY write path to the SQLite event log.
- It executes deterministic pedagogical rules synchronously inside
  the SQLite transaction.
- Update rules:
  * pass (verdict == "Accepted") -> +0.10 (capped at 1.0)
  * fail (any other verdict) -> -0.05 (floored at 0.0)
- Blind Spot rules:
  * detected if: >=3 attempts across >=3 distinct sessions, the most recent
    attempt did not pass, and hint count per attempt is not decreasing.
  * cleared (resolved_at set) if mastery score >= 0.70.
"""

from datetime import UTC, datetime

import logfire
from sqlmodel import Session

from app.domain.events import (
    BlindSpotDetected,
    ConceptMasteryUpdated,
    EventBase,
    PracticeAttempted,
)
from app.storage import event_store


def emit_event(session: Session, event: EventBase) -> None:
    """Emit a new memory event, run synchronous side-effects, and persist."""
    # 1. Persist the primary event first
    event_store.append_event(session, event)
    logfire.info(
        "Emitted {event_type} event {event_id}",
        event_type=event.__class__.__name__,
        event_id=event.id,
    )

    # 2. Run deterministic pedagogical loops for PracticeAttempted
    if isinstance(event, PracticeAttempted):
        _process_practice_attempt(session, event)


def _process_practice_attempt(session: Session, attempt: PracticeAttempted) -> None:
    """Run mastery updates, blind spot detection, and blind spot clearing."""
    concept_id = attempt.concept_id
    if not concept_id:
        return

    # ── 1. Mastery Score Update Rule ──────────────────────────────────
    current_mastery = 0.0
    latest_mastery_event = event_store.get_mastery_for_concept(session, concept_id)
    if latest_mastery_event:
        current_mastery = latest_mastery_event.new_mastery

    previous_mastery = current_mastery
    if attempt.verdict == "Accepted":
        new_mastery = min(1.0, current_mastery + 0.10)
    else:
        new_mastery = max(0.0, current_mastery - 0.05)

    mastery_event = ConceptMasteryUpdated(
        session_id=attempt.session_id,
        concept_id=concept_id,
        previous_mastery=previous_mastery,
        new_mastery=new_mastery,
        trigger_event_id=attempt.id,
    )
    event_store.append_event(session, mastery_event)
    logfire.info(
        "Concept {concept_id} mastery recalculated: {prev:.2f} -> {new:.2f}",
        concept_id=concept_id,
        prev=previous_mastery,
        new=new_mastery,
    )

    # ── 2. Blind Spot Clearing Rule ───────────────────────────────────
    if new_mastery >= 0.70:
        active_spots = event_store.get_blind_spots(session, resolved=False)
        for bs in active_spots:
            if bs.concept_id == concept_id:
                bs.resolved_at = datetime.now(UTC)
                session.add(bs)
                session.commit()
                logfire.info(
                    "Blind Spot cleared for concept {concept_id} (mastery {mastery:.2f})",
                    concept_id=concept_id,
                    mastery=new_mastery,
                )

    # ── 3. Blind Spot Detection Rule ──────────────────────────────────
    all_attempts = event_store.get_practice_events_for_concept(session, concept_id)
    if len(all_attempts) >= 3:
        unique_sessions = {att.session_id for att in all_attempts if att.session_id}
        if len(unique_sessions) >= 3:
            latest_attempt = all_attempts[-1]
            if latest_attempt.verdict != "Accepted":
                # Check if hint counts are monotonically non-decreasing
                hint_counts = [att.hint_count for att in all_attempts]
                is_non_decreasing = all(
                    hint_counts[i] <= hint_counts[i + 1] for i in range(len(hint_counts) - 1)
                )

                if is_non_decreasing:
                    # Search for any unresolved blind spot for this concept
                    active_spots = event_store.get_blind_spots(session, resolved=False)
                    has_active = any(bs.concept_id == concept_id for bs in active_spots)
                    if not has_active:
                        bs_event = BlindSpotDetected(
                            session_id=attempt.session_id,
                            concept_id=concept_id,
                            attempt_count=len(all_attempts),
                            session_count=len(unique_sessions),
                        )
                        event_store.append_event(session, bs_event)
                        logfire.warning(
                            "Blind Spot detected for concept {concept_id}: "
                            "{attempts} attempts across {sessions} sessions with non-decreasing hints.",
                            concept_id=concept_id,
                            attempts=len(all_attempts),
                            sessions=len(unique_sessions),
                        )
