"""Tests for the workflow templates API (Phase 2)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.storage import workflows_repo


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def test_list_workflows_seeds_four_templates(client):
    r = client.get("/api/workflows/")
    assert r.status_code == 200
    body = r.json()
    assert len(body["items"]) == 4
    assert "modelConfigured" in body
    names = {w["name"] for w in body["items"]}
    assert "Practice Exercises Generator" in names
    assert "Concept Synthesizer" in names


def test_seeded_templates_carry_extended_fields(client):
    r = client.get("/api/workflows/")
    practice = next(w for w in r.json()["items"] if w["id"] == "wf-practice")
    assert practice["scope"] == "global"
    assert practice["subjectId"] is None
    assert "{{subject}}" in practice["promptTemplate"]
    assert practice["practiceConfig"]["count"] == 5
    assert practice["practiceConfig"]["scope"] == "topic"


def test_filter_by_scope_global(client):
    r = client.get("/api/workflows/?scope=global")
    assert r.status_code == 200
    for w in r.json()["items"]:
        assert w["scope"] == "global"


def test_create_patch_get_delete(client):
    payload = {
        "name": "Custom Quiz",
        "targetType": "Quiz",
        "description": "Subject-specific quiz",
        "scope": "subject",
        "subjectId": "subject-1",
        "promptTemplate": "Quiz on {{subject}}",
        "practiceConfig": {"count": 3, "difficulty": "hard", "scope": "topic"},
        "evalGates": 2,
    }
    r = client.post("/api/workflows/", json=payload)
    assert r.status_code == 201
    new_id = r.json()["id"]
    assert r.json()["scope"] == "subject"
    assert r.json()["practiceConfig"]["difficulty"] == "hard"

    r2 = client.patch(f"/api/workflows/{new_id}", json={"name": "Renamed"})
    assert r2.status_code == 200
    assert r2.json()["name"] == "Renamed"

    r3 = client.get(f"/api/workflows/{new_id}")
    assert r3.status_code == 200
    assert r3.json()["name"] == "Renamed"

    r4 = client.delete(f"/api/workflows/{new_id}")
    assert r4.status_code == 204

    r5 = client.get(f"/api/workflows/{new_id}")
    assert r5.status_code == 404


def test_duplicate_copies_template_as_global(client):
    r = client.post("/api/workflows/wf-quiz/duplicate")
    assert r.status_code == 201
    assert r.json()["name"].endswith("(copy)")
    assert r.json()["scope"] == "global"
    assert r.json()["subjectId"] is None


def test_customize_fork_creates_scoped_copy(client):
    r = client.post(
        "/api/workflows/wf-practice/customize",
        json={"subjectId": "subject-1"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["scope"] == "subject"
    assert body["subjectId"] == "subject-1"
    assert body["chapterId"] is None
    assert body["topicId"] is None
    # prompt template + practice config carried over
    assert body["practiceConfig"]["count"] == 5


def test_customize_chapter_and_topic(client):
    r1 = client.post(
        "/api/workflows/wf-summary/customize",
        json={"subjectId": "subject-1", "chapterId": "chapter-1"},
    )
    assert r1.status_code == 201
    assert r1.json()["scope"] == "chapter"

    r2 = client.post(
        "/api/workflows/wf-quiz/customize",
        json={
            "subjectId": "subject-1",
            "chapterId": "chapter-1",
            "topicId": "topic-1",
        },
    )
    assert r2.status_code == 201
    assert r2.json()["scope"] == "topic"


def test_customize_requires_target_ids(client):
    r = client.post("/api/workflows/wf-practice/customize", json={})
    assert r.status_code == 400


def test_get_unknown_workflow_404(client):
    r = client.get("/api/workflows/wf-does-not-exist")
    assert r.status_code == 404


def test_list_filter_pulls_global_with_subject_context(client):
    """Studio view of subject-A should include global + subject-scoped."""
    client.post(
        "/api/workflows/",
        json={
            "name": "Per-subject pack",
            "scope": "subject",
            "subjectId": "subject-1",
        },
    )
    r = client.get("/api/workflows/?subjectId=subject-1")
    names = {w["name"] for w in r.json()["items"]}
    assert "Per-subject pack" in names
    # global templates bubble up too
    assert "Practice Exercises Generator" in names
