"""Tests for the Model Router (Phase 4 R-2.5).

Covers the ``is_configured`` method on ``DefaultModelRouter`` and the
``ModelRouter`` Protocol, plus the workflows endpoint that consumes it.

Per chat review §2.5: the "test provider masquerading as real" check
moves into the router, not the consumer.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.harness.model_router import DefaultModelRouter, ModelRouter


@pytest.fixture
def router() -> DefaultModelRouter:
    return DefaultModelRouter()


def test_model_router_protocol_declares_is_configured():
    """``is_configured`` is part of the ModelRouter contract (R-2.5)."""
    assert "is_configured" in dir(ModelRouter)


def test_is_configured_false_in_test_mode(monkeypatch):
    """No API key in the environment → ``test`` provider → unconfigured."""
    for env in ("GOOGLE_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.delenv(env, raising=False)
    monkeypatch.setenv("PRACDA_ENVIRONMENT", "test")
    # Recreate the router so the env-mutation is observed.
    from app.harness.model_router import DefaultModelRouter

    fresh = DefaultModelRouter()
    assert fresh.is_configured("workflow") is False


def test_is_configured_true_when_api_key_set(monkeypatch):
    """A real API key flips ``is_configured`` to True."""
    monkeypatch.setenv("GOOGLE_API_KEY", "fake-key-for-test")
    monkeypatch.delenv("PRACDA_OVERRIDE_MODEL", raising=False)
    from app.harness.model_router import DefaultModelRouter

    fresh = DefaultModelRouter()
    assert fresh.is_configured("workflow") is True


def test_is_configured_false_when_override_is_test(monkeypatch):
    """``PRACDA_OVERRIDE_MODEL=test`` → unconfigured (intentional dev mode)."""
    monkeypatch.setenv("PRACDA_OVERRIDE_MODEL", "test:test")
    from app.harness.model_router import DefaultModelRouter

    fresh = DefaultModelRouter()
    assert fresh.is_configured("workflow") is False


def test_list_workflows_surfaces_model_configured(client: TestClient):
    """The workflows list endpoint reads ``router.is_configured`` (R-2.5).

    In test mode (no real API key) the field is False; the Studio
    disables the Run button when it sees False.
    """
    r = client.get("/api/workflows/")
    assert r.status_code == 200
    body = r.json()
    assert "modelConfigured" in body
    assert isinstance(body["modelConfigured"], bool)


def test_model_router_route_with_request(monkeypatch):
    """Verify route can accept a ModelRouteRequest and resolves configurations with cost/latency."""
    from app.harness.model_router import ModelRouteRequest
    monkeypatch.setenv("GOOGLE_API_KEY", "fake-key")
    monkeypatch.delenv("PRACDA_OVERRIDE_MODEL", raising=False)

    fresh = DefaultModelRouter()
    req = ModelRouteRequest(task_type="workflow", workflow_id="wf-123")
    cfg = fresh.route(req)
    assert cfg.provider == "google"
    assert cfg.latency > 0
    assert cfg.cost > 0
    assert fresh.is_configured(req) is True


