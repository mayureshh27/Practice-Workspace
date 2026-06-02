"""Tests for the practice-exercises API.

The Practice Agent's parse + pad + coerce helpers (``_coerce_problems``,
``_pad_problems``) are removed in Phase 3; the discriminated union
parser :func:`app.agents.practice_agent.parse_practice_payload` is
covered in :mod:`tests.test_practice_agent_payload`.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.agents.practice_agent import _extract_json, render_prompt
from app.main import create_app


@pytest.fixture
def client():
    return TestClient(create_app())


def test_render_prompt_substitutes_placeholders():
    out = render_prompt(
        "Quiz on {{subject}} ({{chapter}}/{{topic}}) at {{difficulty}}, count={{count}}",
        subject="Go",
        chapter="Loops",
        topic="for-range",
        count=3,
        difficulty="hard",
        blindspots="",
    )
    assert "Go" in out
    assert "Loops" in out
    assert "for-range" in out
    assert "hard" in out
    assert "3" in out


def test_render_prompt_blindspots_default():
    out = render_prompt(
        "weak: {{blindspots}}", subject="S", chapter="", topic="", count=1, difficulty="easy"
    )
    assert "no blind spots" in out


def test_render_prompt_leaves_unknown_placeholders():
    out = render_prompt(
        "Hello {{name}}", subject="x", chapter="", topic="", count=1, difficulty="e"
    )
    assert "{{name}}" in out


def test_extract_json_handles_fences_and_prose():
    assert _extract_json('{"problems": [{"title": "a"}]}') == {"problems": [{"title": "a"}]}
    assert _extract_json('Here is the JSON: {"summary": "hi"}') == {"summary": "hi"}
    assert _extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert _extract_json("totally not json") is None
    assert _extract_json("") is None


def test_run_practice_404_on_unknown_workflow(client):
    r = client.post(
        "/api/practice-exercises/",
        json={
            "workflowId": "wf-nope",
            "domainId": "go-programming",
            "subjectId": "subject-modern-go",
        },
    )
    assert r.status_code == 404


def test_run_practice_400_on_empty_prompt_template(client):
    """wf-code-practice has an empty promptTemplate — should 400."""
    r = client.post(
        "/api/practice-exercises/",
        json={
            "workflowId": "wf-code-practice",
            "domainId": "go-programming",
            "subjectId": "subject-modern-go",
        },
    )
    assert r.status_code == 400
    assert "promptTemplate" in r.json()["detail"]


def test_run_practice_returns_artifact(client):
    domains = client.get("/api/domains/").json()
    dom = next(d for d in domains if d["subjects"])
    subj = dom["subjects"][0]
    chap = subj["chapters"][0]

    r = client.post(
        "/api/practice-exercises/",
        json={
            "workflowId": "wf-practice",
            "domainId": dom["id"],
            "subjectId": subj["id"],
            "chapterId": chap["id"],
            "count": 3,
            "difficulty": "medium",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["type"] == "Exercise Pack"
    assert body["status"] == "draft"
    assert body["domain_id"] == dom["id"]
    assert body["subject_id"] == subj["id"]
    assert body["chapter_id"] == chap["id"]
    # Phase 3: the payload is the discriminated union serialised.
    assert body["payload"]["kind"] == "practice"
    assert body["payload"]["workflow_id"] == "wf-practice"
    assert body["payload"]["requested_count"] == 3
    # In test mode (no GOOGLE_API_KEY) the LLM returns a stub but
    # the count padding guarantees we always get 3 problems.
    assert len(body["payload"]["problems"]) == 3


def test_run_practice_pads_to_count_even_when_model_returns_short(client):
    """If the LLM returns 1 problem, we pad to 3 placeholders."""
    domains = client.get("/api/domains/").json()
    dom = next(d for d in domains if d["subjects"])
    subj = dom["subjects"][0]

    r = client.post(
        "/api/practice-exercises/",
        json={
            "workflowId": "wf-quiz",
            "domainId": dom["id"],
            "subjectId": subj["id"],
            "count": 4,
        },
    )
    assert r.status_code == 201
    payload = r.json()["payload"]
    assert len(payload["problems"]) == 4
    assert payload["requested_count"] == 4


def test_run_practice_artifact_appears_in_artifacts_list(client):
    domains = client.get("/api/domains/").json()
    dom = next(d for d in domains if d["subjects"])
    subj = dom["subjects"][0]

    pre = client.get("/api/artifacts/").json()
    pre_count = len(pre)

    r = client.post(
        "/api/practice-exercises/",
        json={
            "workflowId": "wf-summary",
            "domainId": dom["id"],
            "subjectId": subj["id"],
        },
    )
    assert r.status_code == 201
    new_id = r.json()["id"]

    after = client.get("/api/artifacts/").json()
    assert len(after) == pre_count + 1
    assert after[0]["id"] == new_id
    assert after[0]["type"] == "Summary"


def test_run_practice_uses_workflow_practice_config_defaults(client):
    """When count/difficulty not in body, fall back to practiceConfig."""
    domains = client.get("/api/domains/").json()
    dom = next(d for d in domains if d["subjects"])
    subj = dom["subjects"][0]

    # wf-practice has practiceConfig.count=5, difficulty=medium
    r = client.post(
        "/api/practice-exercises/",
        json={
            "workflowId": "wf-practice",
            "domainId": dom["id"],
            "subjectId": subj["id"],
        },
    )
    assert r.status_code == 201
    assert r.json()["payload"]["requested_count"] == 5
    assert r.json()["payload"]["difficulty"] == "medium"
