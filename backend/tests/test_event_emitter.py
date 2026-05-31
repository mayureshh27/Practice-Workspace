"""Tests for the Event Emitter and Memory Seed Protocol primitives."""

from datetime import datetime
from pathlib import Path

import pytest
from sqlmodel import select

from app.domain.events import (
    BlindSpotDetected,
    ConceptMasteryUpdated,
    PracticeAttempted,
)
from app.harness.event_emitter import emit_event
from app.harness.memory_seed import materialise_learner_state
from app.storage import event_store


def test_mastery_increases_on_accepted_attempt(db_session):
    """Verify an 'Accepted' verdict increases mastery by +0.10, capped at 1.0."""
    concept = "concept-screw-theory"

    # Attempt 1: pass (0.0 -> 0.10)
    att1 = PracticeAttempted(
        session_id="session-1",
        concept_id=concept,
        verdict="Accepted",
    )
    emit_event(db_session, att1)

    m1 = event_store.get_mastery_for_concept(db_session, concept)
    assert m1 is not None
    assert m1.previous_mastery == 0.0
    assert pytest.approx(m1.new_mastery) == 0.10
    assert m1.trigger_event_id == att1.id

    # Attempt 2: pass (0.10 -> 0.20)
    att2 = PracticeAttempted(
        session_id="session-1",
        concept_id=concept,
        verdict="Accepted",
    )
    emit_event(db_session, att2)

    m2 = event_store.get_mastery_for_concept(db_session, concept)
    assert m2 is not None
    assert m2.previous_mastery == 0.10
    assert pytest.approx(m2.new_mastery) == 0.20

    # Flood with Accepted attempts to verify capping at 1.0
    for _ in range(10):
        emit_event(
            db_session,
            PracticeAttempted(
                session_id="session-1",
                concept_id=concept,
                verdict="Accepted",
            ),
        )

    m_final = event_store.get_mastery_for_concept(db_session, concept)
    assert m_final is not None
    assert m_final.new_mastery == 1.0


def test_mastery_decreases_on_failure(db_session):
    """Verify a non-Accepted verdict decreases mastery by -0.05, floored at 0.0."""
    concept = "concept-forward-kinematics"

    # First, get mastery to 0.10
    att_pass = PracticeAttempted(
        session_id="session-1",
        concept_id=concept,
        verdict="Accepted",
    )
    emit_event(db_session, att_pass)

    m_pass = event_store.get_mastery_for_concept(db_session, concept)
    assert m_pass.new_mastery == 0.10

    # Fail attempt (0.10 -> 0.05)
    att_fail = PracticeAttempted(
        session_id="session-1",
        concept_id=concept,
        verdict="WrongAnswer",
    )
    emit_event(db_session, att_fail)

    m_fail = event_store.get_mastery_for_concept(db_session, concept)
    assert m_fail is not None
    assert m_fail.previous_mastery == 0.10
    assert pytest.approx(m_fail.new_mastery) == 0.05
    assert m_fail.trigger_event_id == att_fail.id

    # Fail again (0.05 -> 0.0)
    emit_event(
        db_session,
        PracticeAttempted(
            session_id="session-1",
            concept_id=concept,
            verdict="WrongAnswer",
        ),
    )

    m_floor = event_store.get_mastery_for_concept(db_session, concept)
    assert m_floor.new_mastery == 0.0

    # Fail once more to verify floor at 0.0
    emit_event(
        db_session,
        PracticeAttempted(
            session_id="session-1",
            concept_id=concept,
            verdict="WrongAnswer",
        ),
    )

    m_final = event_store.get_mastery_for_concept(db_session, concept)
    assert m_final.new_mastery == 0.0


def test_blind_spot_detected_correctly(db_session):
    """Verify a Blind Spot is detected under proper conditions."""
    concept = "concept-homogeneous"

    # Condition: >=3 attempts across >=3 distinct sessions
    # Hint count per attempt must be non-decreasing, and last attempt failed.
    # Attempt 1 (session 1, hint_count 1, failed)
    emit_event(
        db_session,
        PracticeAttempted(
            session_id="session-s1",
            concept_id=concept,
            verdict="WrongAnswer",
            hint_count=1,
        ),
    )

    # Attempt 2 (session 2, hint_count 1, failed)
    emit_event(
        db_session,
        PracticeAttempted(
            session_id="session-s2",
            concept_id=concept,
            verdict="WrongAnswer",
            hint_count=1,
        ),
    )

    # There shouldn't be a blind spot yet (only 2 distinct sessions)
    spots_before = event_store.get_blind_spots(db_session, resolved=False)
    assert not any(bs.concept_id == concept for bs in spots_before)

    # Attempt 3 (session 3, hint_count 2, failed)
    # The hint count is sequence [1, 1, 2] which is non-decreasing!
    emit_event(
        db_session,
        PracticeAttempted(
            session_id="session-s3",
            concept_id=concept,
            verdict="WrongAnswer",
            hint_count=2,
        ),
    )

    # Now we should detect it!
    spots_after = event_store.get_blind_spots(db_session, resolved=False)
    my_spots = [bs for bs in spots_after if bs.concept_id == concept]
    assert len(my_spots) == 1
    assert my_spots[0].attempt_count == 3
    assert my_spots[0].session_count == 3
    assert my_spots[0].resolved_at is None


def test_blind_spot_cleared_at_threshold(db_session):
    """Verify active blind spots are resolved when mastery crosses 0.70."""
    concept = "concept-grubler"

    # Create active blind spot
    for idx in range(3):
        emit_event(
            db_session,
            PracticeAttempted(
                session_id=f"session-g{idx}",
                concept_id=concept,
                verdict="WrongAnswer",
                hint_count=idx,
            ),
        )

    # Ensure blind spot exists
    spots = event_store.get_blind_spots(db_session, resolved=False)
    assert any(bs.concept_id == concept for bs in spots)

    # Practice successfully until mastery score is >= 0.70
    # Currently mastery is 0.0 (floored after 3 fails)
    # We need 7 passes to get to 0.70
    for idx in range(7):
        emit_event(
            db_session,
            PracticeAttempted(
                session_id=f"session-g-pass-{idx}",
                concept_id=concept,
                verdict="Accepted",
            ),
        )

    # Check mastery score
    m = event_store.get_mastery_for_concept(db_session, concept)
    assert m.new_mastery >= 0.70

    # Ensure blind spot is cleared (resolved_at is set)
    active = event_store.get_blind_spots(db_session, resolved=False)
    assert not any(bs.concept_id == concept for bs in active)

    resolved = event_store.get_blind_spots(db_session, resolved=True)
    assert any(bs.concept_id == concept for bs in resolved)


def test_memory_seed_protocol_generates_files(db_session, tmp_path):
    """Verify materialise_learner_state generates the correct structured Markdown files."""
    # Seed some events
    concept = "concept-screw"
    # Seed a mastery score of 0.40
    for _ in range(4):
        emit_event(
            db_session,
            PracticeAttempted(
                session_id="session-seed",
                concept_id=concept,
                verdict="Accepted",
            ),
        )

    # Seed an active blind spot
    for idx in range(3):
        emit_event(
            db_session,
            PracticeAttempted(
                session_id=f"session-seed-g{idx}",
                concept_id="concept-struggle",
                verdict="WrongAnswer",
                hint_count=idx,
            ),
        )

    # Call protocol
    memories_dir = tmp_path / "memories"
    materialise_learner_state(db_session, memories_dir)

    # Verify files exist
    m_file = memories_dir / "mastery.md"
    bs_file = memories_dir / "blind_spots.md"
    as_file = memories_dir / "active_sources.md"
    p_file = memories_dir / "position.md"

    assert m_file.exists()
    assert bs_file.exists()
    assert as_file.exists()
    assert p_file.exists()

    # Verify content
    m_content = m_file.read_text(encoding="utf-8")
    assert "concept-screw" in m_content
    assert "0.40" in m_content

    bs_content = bs_file.read_text(encoding="utf-8")
    assert "concept-struggle" in bs_content
    assert "3 attempts" in bs_content
