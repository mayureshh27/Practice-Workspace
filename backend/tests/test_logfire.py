"""Tests that Logfire instrumentation doesn't crash without a token."""

import os


def test_logfire_configures_without_token():
    """Logfire.configure() with send_to_logfire='if-token-present' should
    not raise when LOGFIRE_TOKEN is unset."""
    os.environ.pop("LOGFIRE_TOKEN", None)
    os.environ.pop("PRACDA_LOGFIRE_TOKEN", None)

    import logfire

    # Should not raise — runs in noop/console mode.
    logfire.configure(send_to_logfire="if-token-present")


def test_app_starts_without_logfire_token(client):
    """The full app should start and serve requests without LOGFIRE_TOKEN."""
    response = client.get("/health")
    assert response.status_code == 200
