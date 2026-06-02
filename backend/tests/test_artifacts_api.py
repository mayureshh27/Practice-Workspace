"""Tests for the artifacts API."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    return TestClient(create_app())


def test_list_artifacts_starts_empty(client):
    r = client.get("/api/artifacts/")
    assert r.status_code == 200
    assert r.json() == []


def test_post_artifact_persists_in_list(client):
    body = {
        "name": "Practice Pack",
        "type": "Exercise Pack",
        "status": "draft",
        "domainId": "go",
        "subjectId": "s1",
        "chapterId": "c1",
        "topicId": "t1",
        "payload": {"problems": [{"title": "Sum to N"}]},
    }
    r = client.post("/api/artifacts/", json=body)
    assert r.status_code == 201
    artifact = r.json()
    assert artifact["name"] == "Practice Pack"
    assert artifact["domain_id"] == "go"
    assert artifact["subject_id"] == "s1"
    assert artifact["chapter_id"] == "c1"
    assert artifact["topic_id"] == "t1"
    assert artifact["payload"]["problems"][0]["title"] == "Sum to N"
    assert "id" in artifact
    assert "time" in artifact

    listing = client.get("/api/artifacts/").json()
    assert len(listing) == 1
    assert listing[0]["id"] == artifact["id"]


def test_post_artifact_minimal_body(client):
    r = client.post("/api/artifacts/", json={"name": "Bare"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Bare"
    assert body["type"] == "Exercise Pack"  # default
    assert body["status"] == "draft"
    assert body["domain_id"] is None
    assert body["subject_id"] is None
    assert body["chapter_id"] is None
    assert body["topic_id"] is None


def test_post_artifact_stamps_id_and_time(client):
    r = client.post("/api/artifacts/", json={"name": "Stamp test"})
    body = r.json()
    assert body["id"].startswith("art-")
    # ISO-8601 date prefix
    assert body["time"].startswith("20")
    assert "T" in body["time"]


def test_list_orders_newest_first(client):
    """Two posts in sequence: the second is at the head of the list."""
    client.post("/api/artifacts/", json={"name": "older"})
    client.post("/api/artifacts/", json={"name": "newer"})
    listing = client.get("/api/artifacts/").json()
    assert [a["name"] for a in listing] == ["newer", "older"]
