"""Tests for QdrantRetrievalRouter (Phase 2: M-B3, M-H1, M-H2).

These tests cover the three findings Phase 2 closes:

- M-B3 — `_qdrant_healthz_probe` returns ``True`` only for an
  actual Qdrant answering ``/healthz`` with 200; not a raw socket
  check, not a different service that happens to listen on 6333.
- M-H1 — `Settings.qdrant_embedding_model` is the canonical pin
  and is wired into ``QdrantRetrievalRouter.__init__``.
- M-H2 — ``_get_embedding`` raises ``RuntimeError`` (no silent
  pseudo-embedding fallback) when the embedding model cannot be
  loaded.
"""

from __future__ import annotations

from unittest.mock import patch
from urllib.error import HTTPError, URLError

import pytest

from app.config import Settings
from app.harness.qdrant_router import QdrantRetrievalRouter


def _bare_router() -> QdrantRetrievalRouter:
    """Construct a router instance without running ``__init__`` (which
    hits Qdrant / disk). Lets the test patch the methods under test.
    """
    return QdrantRetrievalRouter.__new__(QdrantRetrievalRouter)


# ── M-B3: /healthz probe ────────────────────────────────────────


def test_qdrant_healthz_probe_returns_true_on_200():
    """A real Qdrant returning 200 on /healthz → True."""
    router = _bare_router()
    fake_resp = _FakeHTTPResponse(status=200)
    with patch("app.harness.qdrant_router.urlopen", return_value=fake_resp) as mock_open:
        assert router._qdrant_healthz_probe("localhost", 6333) is True
        mock_open.assert_called_once()
        # The URL must be the Qdrant healthz endpoint, not the root.
        called_url = mock_open.call_args[0][0].full_url
        assert called_url == "http://localhost:6333/healthz"


def test_qdrant_healthz_probe_returns_false_on_no_service():
    """Connection refused / no listener → False (no exception leaks)."""
    router = _bare_router()
    with patch(
        "app.harness.qdrant_router.urlopen",
        side_effect=URLError("connection refused"),
    ):
        assert router._qdrant_healthz_probe("localhost", 6333) is False


def test_qdrant_healthz_probe_rejects_non_qdrant_service():
    """A non-Qdrant service (e.g. a Prometheus exporter reusing 6333)
    returns 404 on /healthz — must NOT be accepted as Qdrant.
    """
    router = _bare_router()
    with patch(
        "app.harness.qdrant_router.urlopen",
        side_effect=HTTPError(
            url="http://localhost:6333/healthz",
            code=404,
            msg="Not Found",
            hdrs={},
            fp=None,
        ),
    ):
        assert router._qdrant_healthz_probe("localhost", 6333) is False


# ── M-H1: pinned embedding model ───────────────────────────────


def test_settings_exposes_embedding_model():
    """Settings.qdrant_embedding_model is the canonical pin."""
    s = Settings()
    assert s.qdrant_embedding_model == "all-MiniLM-L6-v2"
    assert s.qdrant_embedding_revision is None  # default off, opt-in


# ── M-H2: no-silent-fallback on embedding load failure ──────────


def test_get_embedding_raises_when_model_unavailable():
    """``_get_embedding`` must raise ``RuntimeError`` (not return
    md5-derived garbage) when ``sentence-transformers`` cannot
    load the configured model. This is the M-H2 commitment in
    ADR-0002's operational section.
    """
    import sentence_transformers

    router = _bare_router()
    router.embedding_model = "fake-model-for-test"
    router.embedding_revision = None

    # Simulate "model exists in HF cache but fails to load" by
    # making ``SentenceTransformer(...)`` raise on construction.
    with (
        patch.object(
            sentence_transformers,
            "SentenceTransformer",
            side_effect=RuntimeError("simulated model-load failure"),
        ),
        pytest.raises(RuntimeError, match="refusing to fall back"),
    ):
        router._get_embedding("hello world")


# ── Test helper ──────────────────────────────────────────────────


class _FakeHTTPResponse:
    """Minimal stand-in for ``http.client.HTTPResponse`` used by
    ``urllib.request.urlopen``. Supports the context-manager
    protocol and exposes ``status`` (an int), matching the
    attributes the router reads.
    """

    def __init__(self, status: int) -> None:
        self.status = status

    def __enter__(self) -> _FakeHTTPResponse:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False
