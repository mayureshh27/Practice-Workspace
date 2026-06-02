# Retrieval Layer Starts With Qdrant

The Retrieval Layer will start with Qdrant because the product is a Docker-runnable adaptive practice workspace that needs filtered retrieval across books, videos, repositories, notes, subjects, chapters, and concepts, with a plausible later deployment path. Application code depends on a Retrieval Layer contract rather than Qdrant directly so LanceDB, pgvector, or another retrieval backend can replace or complement Qdrant later.

## Considered Options

- LanceDB first: simpler embedded local experience, but less aligned with the dockerized service ecosystem and deployment path.
- Kuzu or Graphiti as retrieval: attractive for graph expansion, but it would mix document retrieval with graph memory too early.
- SQLite FTS first: simple and inspectable, but too limited for heavy multi-source semantic retrieval.

## Operational commitments (added 2026-06-02, Phase 2)

These are the *load-bearing* contracts the implementation upholds
when wiring Qdrant into the practice workspace. They close
findings **M-B3**, **M-H1**, and **M-H2** from
`docs/reviews/code-review-by-layer.md` (lines 61, 73, 82) and are
enforced by the tests in `backend/tests/test_qdrant_router.py`.

1. **Real-Qdrant detection, not a socket check.** The router
   connects to Qdrant only when the Qdrant server itself answers
   `GET /healthz` with `200 OK`. A different service that
   happens to listen on port 6333 (e.g. a Prometheus exporter
   reusing the port, a stale container) is **not** accepted as
   Qdrant, and the router falls back to embedded local-disk
   Qdrant instead of silently using a non-Qdrant client.
   Configurable via `QDRANT_HOST` / `QDRANT_PORT`.

2. **Pinned embedding model.** The default embedding model is
   `all-MiniLM-L6-v2`, surfaced via
   `Settings.qdrant_embedding_model` and override-able through
   `PRACDA_QDRANT_EMBEDDING_MODEL`. An optional
   `Settings.qdrant_embedding_revision` commit-hash pin is the
   recommended reproducibility upgrade for staging/production.
   Changing the model id is a **schema migration** (the
   collection is sized for 384 dims) — not a config flip.

3. **No silent pseudo-embedding fallback.** If the embedding
   model cannot be loaded (HF cache miss, network down, library
   uninstalled), `_get_embedding` raises `RuntimeError` and the
   error propagates out of `index_chunks`. Garbage md5-derived
   vectors are **never** indexed into the cosine-similarity
   collection. Callers that need to recover (e.g. a one-off
   smoke test) must catch the `RuntimeError` explicitly.

These commitments are tested by
`backend/tests/test_qdrant_router.py` (5 tests, all Phase 2)
and were previously violated by the in-line md5 fallback in
`qdrant_router._get_embedding` and the raw-socket
`_is_docker_running` probe.

