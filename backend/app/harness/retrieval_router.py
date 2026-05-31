"""Retrieval Router — Layer Contract for source-chunk retrieval.

Exposes two tools (CONTEXT.md):
  source_search(query, mode, source_ids) — semantic | hybrid (default hybrid)
  source_search_exact(tokens, source_ids) — BM25-only for exact-token queries

source_ids is a mandatory parameter in both tools — omitting it is a
TypeError (ADR-0017). Used only for source chunks, never for memory events
(ADR-0020).
"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel


class ChunkResult(BaseModel):
    """A single retrieved chunk with citation metadata."""

    chunk_id: str
    source_id: str
    chunk_index: int
    page_or_timestamp: str | None = None
    preview: str = ""  # first 200 tokens
    file_path: str | None = None  # path to full chunk if > 800 tokens
    score: float = 0.0


class RetrievalRouter(Protocol):
    """Source-chunk retrieval behind a stable interface.

    Qdrant hybrid retrieval (BM25 sparse + MiniLM dense + RRF fusion) is
    the first implementation; the interface can evolve independently.
    """

    def source_search(
        self,
        query: str,
        *,
        mode: str = "hybrid",
        source_ids: list[str],
    ) -> list[ChunkResult]: ...

    def source_search_exact(
        self,
        tokens: str,
        *,
        source_ids: list[str],
    ) -> list[ChunkResult]: ...
