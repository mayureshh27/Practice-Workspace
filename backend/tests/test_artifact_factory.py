"""Tests for the artifact factory — make_artifact + append_artifact.

The factory is the single source of truth for artifact construction
(chat review §2.3: id-stamping, time-formatting, state-mutation were
duplicated in two call sites). These tests verify the factory's
behaviour and the call-site contract.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.api._artifact_factory import append_artifact, make_artifact
from app.api._ids import now_iso_with_ms


def test_make_artifact_stamps_canonical_id_and_iso_time():
    record = make_artifact(
        name="Loops — Go",
        type="Exercise Pack",
        status="draft",
        domain_id="dom-1",
        subject_id="sub-1",
        chapter_id=None,
        topic_id=None,
        payload={"kind": "practice", "problems": []},
    )
    # id is a canonical new_id("art") result
    assert record["id"].startswith("art-")
    assert (
        record["id"]
        != make_artifact(
            name="x",
            type="x",
            status="x",
            domain_id=None,
            subject_id=None,
            chapter_id=None,
            topic_id=None,
            payload=None,
        )["id"]
    )
    # time is ISO-8601 with ms + Z
    assert record["time"].endswith("Z")
    assert "." in record["time"]


def test_make_artifact_preserves_caller_supplied_fields():
    record = make_artifact(
        name="Summary",
        type="Summary",
        status="approved",
        domain_id="dom-x",
        subject_id="sub-x",
        chapter_id="chap-x",
        topic_id="topic-x",
        payload={"kind": "summary", "text": "x"},
    )
    assert record["name"] == "Summary"
    assert record["type"] == "Summary"
    assert record["status"] == "approved"
    assert record["domain_id"] == "dom-x"
    assert record["subject_id"] == "sub-x"
    assert record["chapter_id"] == "chap-x"
    assert record["topic_id"] == "topic-x"
    assert record["payload"] == {"kind": "summary", "text": "x"}


def test_make_artifact_preserves_none_payload():
    record = make_artifact(
        name="Empty",
        type="Lesson",
        status="draft",
        domain_id=None,
        subject_id=None,
        chapter_id=None,
        topic_id=None,
        payload=None,
    )
    assert record["payload"] is None


def test_append_artifact_initialises_state_and_appends():
    app = FastAPI()

    class _Req:
        def __init__(self) -> None:
            self.app = app

    request = _Req()
    record1 = make_artifact(
        name="First",
        type="Lesson",
        status="draft",
        domain_id="d",
        subject_id="s",
        chapter_id=None,
        topic_id=None,
        payload=None,
    )
    record2 = make_artifact(
        name="Second",
        type="Quiz",
        status="draft",
        domain_id="d",
        subject_id="s",
        chapter_id=None,
        topic_id=None,
        payload=None,
    )
    append_artifact(request, record1)
    append_artifact(request, record2)
    state = getattr(app.state, "artifacts", [])
    assert len(state) == 2
    assert state[0]["id"] == record1["id"]
    assert state[1]["id"] == record2["id"]


def test_append_artifact_idempotent_against_existing_state():
    """If state already has records, append_artifact preserves them."""
    app = FastAPI()
    app.state.artifacts = [
        {"id": "art-existing", "name": "Pre-existing", "time": "2025-01-01T00:00:00.000Z"}
    ]

    class _Req:
        def __init__(self) -> None:
            self.app = app

    new_record = make_artifact(
        name="New",
        type="Lesson",
        status="draft",
        domain_id="d",
        subject_id="s",
        chapter_id=None,
        topic_id=None,
        payload=None,
    )
    append_artifact(_Req(), new_record)
    state = app.state.artifacts
    assert len(state) == 2
    assert state[0]["id"] == "art-existing"
    assert state[1]["id"] == new_record["id"]


def test_now_iso_with_ms_format_is_iso8601_with_z():
    ts = now_iso_with_ms()
    assert ts.endswith("Z")
    # Format: YYYY-MM-DDTHH:MM:SS.sssZ
    assert ts[4] == "-"
    assert ts[7] == "-"
    assert ts[10] == "T"
    assert ts[13] == ":"
    assert ts[16] == ":"
    assert ts[19] == "."
    # Three-digit ms
    assert ts[23] == "Z"
