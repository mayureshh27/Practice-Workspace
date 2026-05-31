"""Tests for the health endpoint."""


def test_health_returns_ok(client):
    """GET /health returns 200 with status and environment."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "environment" in data


def test_health_does_not_leak_secrets(client):
    """Health response must not contain sensitive fields."""
    response = client.get("/health")
    data = response.json()
    # Should not have any key that looks like a token or secret.
    for key in data:
        assert "token" not in key.lower()
        assert "secret" not in key.lower()
        assert "key" not in key.lower()
