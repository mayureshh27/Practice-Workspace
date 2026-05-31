"""Tests for the append-only event store."""

from app.domain.events import (
    ConceptMasteryUpdated,
    PracticeAttempted,
)
from app.storage.event_store import (
    append_event,
    get_events_by_session,
    get_mastery_for_concept,
    get_practice_events_for_concept,
)


def test_append_and_read_practice_event(db_session):
    """Append a PracticeAttempted event and read it back."""
    event = PracticeAttempted(
        session_id="test-session-1",
        concept_id="concept-rotation",
        verdict="Accepted",
        hint_count=1,
        duration_ms=5000,
    )
    append_event(db_session, event)

    events = get_events_by_session(db_session, "test-session-1")
    assert len(events) >= 1
    practice = [e for e in events if isinstance(e, PracticeAttempted)]
    assert len(practice) == 1
    assert practice[0].verdict == "Accepted"
    assert practice[0].concept_id == "concept-rotation"


def test_events_are_ordered_by_timestamp(db_session):
    """Events for a session should be returned in chronological order."""
    e1 = PracticeAttempted(
        session_id="test-session-order",
        concept_id="c1",
        verdict="Error",
    )
    e2 = PracticeAttempted(
        session_id="test-session-order",
        concept_id="c2",
        verdict="Accepted",
    )
    append_event(db_session, e1)
    append_event(db_session, e2)

    events = get_events_by_session(db_session, "test-session-order")
    timestamps = [e.timestamp for e in events]
    assert timestamps == sorted(timestamps)


def test_mastery_updated_with_trigger_event_id(db_session):
    """ConceptMasteryUpdated carries trigger_event_id per ADR-0026."""
    practice = PracticeAttempted(
        session_id="test-session-mastery",
        concept_id="concept-kinematics",
        verdict="Accepted",
    )
    append_event(db_session, practice)

    mastery = ConceptMasteryUpdated(
        session_id="test-session-mastery",
        concept_id="concept-kinematics",
        previous_mastery=0.3,
        new_mastery=0.4,
        trigger_event_id=practice.id,  # FK to PracticeAttempted
    )
    append_event(db_session, mastery)

    result = get_mastery_for_concept(db_session, "concept-kinematics")
    assert result is not None
    assert result.new_mastery == 0.4
    assert result.trigger_event_id == practice.id


def test_practice_events_for_concept(db_session):
    """get_practice_events_for_concept returns events for a specific concept."""
    e1 = PracticeAttempted(
        session_id="test-session-concept",
        concept_id="concept-pid",
        verdict="Error",
    )
    e2 = PracticeAttempted(
        session_id="test-session-concept",
        concept_id="concept-pid",
        verdict="Accepted",
    )
    e3 = PracticeAttempted(
        session_id="test-session-concept",
        concept_id="concept-other",
        verdict="Accepted",
    )
    append_event(db_session, e1)
    append_event(db_session, e2)
    append_event(db_session, e3)

    pid_events = get_practice_events_for_concept(db_session, "concept-pid")
    assert len(pid_events) == 2
    assert all(e.concept_id == "concept-pid" for e in pid_events)
