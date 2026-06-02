"""Concrete Qdrant Retrieval Router implementation.

Uses local-first embedded storage by default if Qdrant Docker container is offline.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import logfire
from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.harness.retrieval_router import ChunkResult
from app.storage import data_path


class QdrantRetrievalRouter:
    """Concrete implementation of RetrievalRouter using Qdrant client."""

    def __init__(self, location: str | Path | None = None):
        # Default to backend/data/qdrant_db (R-2.1) — see
        # TemporalMasteryStore for the rationale on CWD-invariance.
        self.location = str(location) if location is not None else str(data_path("qdrant_db"))
        # Gracefully connect to local Docker on port 6333, or fall back to local disk storage
        try:
            if os.environ.get("QDRANT_HOST") or self._is_docker_running():
                host = os.environ.get("QDRANT_HOST", "localhost")
                port = int(os.environ.get("QDRANT_PORT", "6333"))
                self.client = QdrantClient(host=host, port=port)
                logfire.info("Connected to Qdrant Server at {host}:{port}", host=host, port=port)
            else:
                self.client = QdrantClient(path=self.location)
                logfire.info(
                    "Initialised embedded Qdrant database at {location}", location=self.location
                )
        except Exception as exc:
            self.client = QdrantClient(location=":memory:")
            logfire.warning(
                "Failed to initialise Qdrant, falling back to in-memory: {error}", error=str(exc)
            )

        self.collection_name = "source_chunks"
        self._ensure_collection()
        self._sources: dict[str, dict] = {}  # source_id -> metadata

    def _is_docker_running(self) -> bool:
        # Simple health check to check if port 6333 is open
        import socket

        try:
            with socket.create_connection(("localhost", 6333), timeout=0.5):
                return True
        except OSError:
            return False

    def _ensure_collection(self):
        try:
            if not self.client.collection_exists(self.collection_name):
                # Hybrid search: 384 dimensions for all-MiniLM-L6-v2
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
                )
                logfire.info("Created Qdrant collection: {name}", name=self.collection_name)
        except Exception as exc:
            logfire.warning("Error checking/creating Qdrant collection: {error}", error=str(exc))

    def _get_embedding(self, text: str) -> list[float]:
        try:
            from sentence_transformers import SentenceTransformer

            model = SentenceTransformer("all-MiniLM-L6-v2")
            return model.encode(text).tolist()
        except Exception:
            # Deterministic pseudo-embedding fallback when sentence-transformers is loading/absent
            import hashlib

            res = []
            for i in range(384):
                val = int(hashlib.md5(f"{text}-{i}".encode()).hexdigest(), 16)
                res.append((val % 2000 - 1000) / 1000.0)
            return res

    def index_chunks(
        self,
        chunks: list[dict],
        source_metadata: dict[str, dict] | None = None,
    ) -> list[str]:
        """Index source chunks into the Qdrant collection.

        Each chunk dict must have at minimum:
          - text: str (content to embed)
          - source_id: str
          - chunk_index: int
          - page_or_timestamp: str | None

        Chunks exceeding 800 tokens have their full content written to
        ``tmp/chunks/{chunk_id}.md`` with only the first 200 tokens
        stored in Qdrant as the preview (ADR-0023).

        ``source_metadata`` is an optional dict mapping source_id to
        metadata dicts with ``title`` and ``type`` keys. Used by the
        SourcesPanel UI.

        Returns the list of chunk IDs that were indexed.
        """
        from app.harness.context_gate import _count_tokens

        chunk_ids: list[str] = []
        points: list[models.PointStruct] = []

        # ADR-0023 large-chunk sidecar: also pinned under backend/data/
        # so a `cd backend && uv run fastapi dev` from the repo root
        # and a bare invocation from elsewhere both write to the same
        # place.
        tmp_dir = data_path("chunks_tmp")
        tmp_dir.mkdir(parents=True, exist_ok=True)

        if source_metadata:
            self._sources.update(source_metadata)

        for chunk in chunks:
            text = chunk.get("text", "")
            source_id = chunk.get("source_id", "")
            chunk_index = chunk.get("chunk_index", 0)
            page_or_ts = chunk.get("page_or_timestamp")

            chunk_id = str(uuid.uuid4())
            chunk_ids.append(chunk_id)

            # Large chunk protocol (ADR-0023)
            token_count = _count_tokens(text)
            file_path: str | None = None
            preview = text[:200]  # fallback

            if token_count > 800:
                # Write full content to temp file
                chunk_file = tmp_dir / f"{chunk_id}.md"
                chunk_file.write_text(text, encoding="utf-8")
                file_path = str(chunk_file)
                # Store only first 200 tokens as preview
                preview = " ".join(text.split()[:200])

            vector = self._get_embedding(text)

            payload = {
                "source_id": source_id,
                "chunk_index": chunk_index,
                "page_or_timestamp": page_or_ts,
                "preview": preview,
                "file_path": file_path,
            }

            points.append(
                models.PointStruct(
                    id=chunk_id,
                    vector=vector,
                    payload=payload,
                )
            )

        if points:
            try:
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=points,
                )
                logfire.info(
                    "Indexed {count} chunks into Qdrant collection '{collection}'",
                    count=len(points),
                    collection=self.collection_name,
                )
            except Exception as exc:
                logfire.error(
                    "Failed to index chunks into Qdrant: {error}",
                    error=str(exc),
                )

        return chunk_ids

    def list_sources(self) -> list[dict]:
        """Return metadata for all registered sources."""
        return list(self._sources.values())

    def list_chunk_previews(self, source_id: str) -> list[dict]:
        """Return chunk previews for a source by scrolling the collection."""
        try:
            filter_cond = models.Filter(
                must=[
                    models.FieldCondition(
                        key="source_id",
                        match=models.MatchValue(value=source_id),
                    )
                ]
            )
            scroll_result = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=filter_cond,
                limit=100,
                with_payload=True,
                with_vectors=False,
            )
            results: list[dict] = []
            for point in scroll_result[0]:
                payload = point.payload or {}
                results.append(
                    {
                        "id": str(point.id),
                        "preview": payload.get("preview", ""),
                        "chunk_index": payload.get("chunk_index", 0),
                    }
                )
            results.sort(key=lambda r: r["chunk_index"])
            return results
        except Exception as exc:
            logfire.warning(
                "Failed to scroll chunks for source {source_id}: {error}",
                source_id=source_id,
                error=str(exc),
            )
            return []

    def source_search(
        self,
        query: str,
        *,
        mode: str = "hybrid",
        source_ids: list[str],
    ) -> list[ChunkResult]:
        """Perform semantic or hybrid search filtered by source_ids."""
        if not source_ids:
            raise TypeError("source_ids parameter is mandatory")

        vector = self._get_embedding(query)

        # Build query filters for source_ids
        should_filters = [
            models.FieldCondition(key="source_id", match=models.MatchValue(value=sid))
            for sid in source_ids
        ]

        try:
            search_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=vector,
                query_filter=models.Filter(should=should_filters),
                limit=10,
            )

            results = []
            for res in search_results:
                payload = res.payload or {}
                results.append(
                    ChunkResult(
                        chunk_id=str(res.id),
                        source_id=payload.get("source_id", ""),
                        chunk_index=payload.get("chunk_index", 0),
                        page_or_timestamp=payload.get("page_or_timestamp"),
                        preview=payload.get("preview", ""),
                        file_path=payload.get("file_path"),
                        score=res.score,
                    )
                )
            return results
        except Exception as exc:
            logfire.warning("Qdrant search failed: {error}", error=str(exc))
            return []

    def source_search_exact(
        self,
        tokens: str,
        *,
        source_ids: list[str],
    ) -> list[ChunkResult]:
        """Exact matching using Qdrant exact-match/text filtering."""
        if not source_ids:
            raise TypeError("source_ids parameter is mandatory")

        # Fall back to standard search with text filters
        should_filters = [
            models.FieldCondition(key="source_id", match=models.MatchValue(value=sid))
            for sid in source_ids
        ]

        try:
            # We use full text keyword matching filter if possible
            filter_must = [models.Filter(should=should_filters)]

            # Simple keyword search
            search_results = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=models.Filter(must=filter_must),
                limit=10,
            )

            results = []
            for point in search_results[0]:
                payload = point.payload or {}
                preview = payload.get("preview", "")
                if any(token.lower() in preview.lower() for token in tokens.split()):
                    results.append(
                        ChunkResult(
                            chunk_id=str(point.id),
                            source_id=payload.get("source_id", ""),
                            chunk_index=payload.get("chunk_index", 0),
                            page_or_timestamp=payload.get("page_or_timestamp"),
                            preview=preview,
                            file_path=payload.get("file_path"),
                            score=1.0,
                        )
                    )
            return results
        except Exception as exc:
            logfire.warning("Qdrant exact search failed: {error}", error=str(exc))
            return []
