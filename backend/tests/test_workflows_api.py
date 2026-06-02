"""Tests for the workflow templates API (Phase 2)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


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


# ── Phase 5 — H-B3 / X-1 / X-2: POST /api/workflows/{id}/run ─────────
#
# The /run endpoint is the Studio's Run button. It:
#   - dispatches into the shared _run_workflow_for_artifact helper
#     (same gate, persist, eval_runs path as /api/practice-exercises/)
#   - reads scope from the workflow itself (post-/customize) rather
#     than from the body — closing X-2
#   - refuses to run a global workflow directly (X-2's full intent)


def test_run_workflow_404_on_unknown(client):
    r = client.post(
        "/api/workflows/wf-does-not-exist/run",
        json={"domainId": "go-programming"},
    )
    assert r.status_code == 404


def test_run_workflow_400_on_global_workflow(client):
    """X-2: a global workflow has no subjectId; /run must refuse."""
    r = client.post(
        "/api/workflows/wf-practice/run",
        json={"domainId": "go-programming"},
    )
    assert r.status_code == 400
    assert "customize" in r.json()["detail"].lower()


def test_run_workflow_uses_workflow_scope_not_body(client):
    """The workflow's saved subjectId wins over a missing body value (X-2)."""
    domains = client.get("/api/domains/").json()
    dom = next(d for d in domains if d["subjects"])
    subj = dom["subjects"][0]

    # 1. Customise the global workflow into a subject-scoped fork.
    customize = client.post(
        "/api/workflows/wf-practice/customize",
        json={"subjectId": subj["id"]},
    )
    assert customize.status_code == 201
    fork_id = customize.json()["id"]

    # 2. /run with ONLY domainId — scope comes from the fork.
    r = client.post(
        f"/api/workflows/{fork_id}/run",
        json={"domainId": dom["id"]},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["type"] == "Exercise Pack"
    assert body["subject_id"] == subj["id"]
    # payload is the discriminated union (kind='practice')
    assert body["payload"]["kind"] == "practice"
    # count falls back to the workflow's practiceConfig (5)
    assert body["payload"]["requested_count"] == 5


def test_run_workflow_writes_eval_runs_succeeded_row(client, test_engine):
    """/run writes one eval_runs row with status='succeeded' (H-B4)."""
    from sqlmodel import Session

    from app.storage import eval_runs_repo

    domains = client.get("/api/domains/").json()
    dom = next(d for d in domains if d["subjects"])
    subj = dom["subjects"][0]

    fork = client.post(
        "/api/workflows/wf-quiz/customize",
        json={"subjectId": subj["id"]},
    ).json()
    fork_id = fork["id"]

    pre = eval_runs_repo.list_runs(Session(test_engine), workflow_id=fork_id)
    pre_count = len(pre)

    r = client.post(
        f"/api/workflows/{fork_id}/run",
        json={"domainId": dom["id"]},
    )
    assert r.status_code == 201
    artifact_id = r.json()["id"]

    with Session(test_engine) as session:
        runs = eval_runs_repo.list_runs(session, workflow_id=fork_id)
        assert len(runs) == pre_count + 1
        latest = runs[0]
        assert latest.status == "succeeded"
        assert latest.artifact_id == artifact_id
        assert latest.subject_id == subj["id"]  # the customised scope
        assert latest.workflow_name == fork["name"]
