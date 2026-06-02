"""Tests for QdrantRetrievalRouter (Phase 2: M-B3, M-H1, M-H2; Phase 4: H-H2).

These tests cover the four findings that touch this module:

- M-B3 — `_qdrant_healthz_probe` returns ``True`` only for an
  actual Qdrant answering ``/healthz`` with 200; not a raw socket
  check, not a different service that happens to listen on 6333.
- M-H1 — `Settings.qdrant_embedding_model` is the canonical pin
  and is wired into ``QdrantRetrievalRouter.__init__``.
- M-H2 — ``_get_embedding`` raises ``RuntimeError`` (no silent
  pseudo-embedding fallback) when the embedding model cannot be
  loaded.
- H-H2 (Phase 4) — ``QdrantRetrievalRouter.chunk_exists`` is the
  concrete implementation of the ``ChunkExistenceChecker`` protocol
  consumed by ``artifact_gate._check_source_grounding``. The gate
  treats unknown ids and client errors the same way (False, not
  raise).
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


def _new_router() -> QdrantRetrievalRouter:
    """Build a router backed by an in-memory Qdrant collection.

    We use ``location=":memory:"`` so the test never touches disk and
    stays fast. The collection is created on ``__init__``.
    """
    router = QdrantRetrievalRouter(location=":memory:")
    return router


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


# ── H-H2 (Phase 4): chunk_exists on QdrantRetrievalRouter ───────


def test_chunk_exists_false_for_unknown_id():
    """An id that was never indexed is reported as not existing."""
    router = _new_router()
    assert router.chunk_exists("00000000-0000-0000-0000-000000000000") is False


def test_chunk_exists_false_for_empty_id():
    """Empty string is treated as 'not found' without hitting Qdrant."""
    router = _new_router()
    assert router.chunk_exists("") is False


def test_chunk_exists_true_for_indexed_chunk():
    """After ``index_chunks`` returns, the chunk id is reported as present."""
    router = _new_router()
    chunk_ids = router.index_chunks(
        [
            {
                "text": "Pydantic AI is a Python agent framework.",
                "source_id": "src-py",
                "chunk_index": 0,
                "page_or_timestamp": "p.1",
            }
        ]
    )
    assert len(chunk_ids) == 1
    assert router.chunk_exists(chunk_ids[0]) is True


def test_chunk_exists_does_not_raise_on_client_error(monkeypatch):
    """A failing client returns False (no exception bubbles to the gate)."""
    router = _new_router()

    def _raise(*_a, **_kw):
        raise RuntimeError("simulated Qdrant outage")

    monkeypatch.setattr(router.client, "retrieve", _raise)
    # Must not raise; gate treats it as "not found" and falls through.
    assert router.chunk_exists("any-id") is False


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
