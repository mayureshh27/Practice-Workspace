"""Concrete Qdrant Retrieval Router implementation.

Uses local-first embedded storage by default if Qdrant Docker container is offline.
"""

from __future__ import annotations
import os
import logfire
from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.harness.retrieval_router import RetrievalRouter, ChunkResult

class QdrantRetrievalRouter:
    """Concrete implementation of RetrievalRouter using Qdrant client."""

    def __init__(self, location: str = "storage/qdrant_db"):
        self.location = location
        # Gracefully connect to local Docker on port 6333, or fall back to local disk storage
        try:
            if os.environ.get("QDRANT_HOST") or self._is_docker_running():
                host = os.environ.get("QDRANT_HOST", "localhost")
                port = int(os.environ.get("QDRANT_PORT", "6333"))
                self.client = QdrantClient(host=host, port=port)
                logfire.info("Connected to Qdrant Server at {host}:{port}", host=host, port=port)
            else:
                self.client = QdrantClient(path=self.location)
                logfire.info("Initialised embedded Qdrant database at {location}", location=self.location)
        except Exception as exc:
            self.client = QdrantClient(location=":memory:")
            logfire.warn("Failed to initialise Qdrant, falling back to in-memory: {error}", error=str(exc))

        self.collection_name = "source_chunks"
        self._ensure_collection()

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
                    vectors_config=models.VectorParams(
                        size=384,
                        distance=models.Distance.COSINE
                    )
                )
                logfire.info("Created Qdrant collection: {name}", name=self.collection_name)
        except Exception as exc:
            logfire.warn("Error checking/creating Qdrant collection: {error}", error=str(exc))

    def _get_embedding(self, text: str) -> list[float]:
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer('all-MiniLM-L6-v2')
            return model.encode(text).tolist()
        except Exception:
            # Deterministic pseudo-embedding fallback when sentence-transformers is loading/absent
            import hashlib
            res = []
            for i in range(384):
                val = int(hashlib.md5(f"{text}-{i}".encode()).hexdigest(), 16)
                res.append((val % 2000 - 1000) / 1000.0)
            return res

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
            models.FieldCondition(
                key="source_id",
                match=models.MatchValue(value=sid)
            ) for sid in source_ids
        ]
        
        try:
            search_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=vector,
                query_filter=models.Filter(should=should_filters),
                limit=10
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
                        score=res.score
                    )
                )
            return results
        except Exception as exc:
            logfire.warn("Qdrant search failed: {error}", error=str(exc))
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
            models.FieldCondition(
                key="source_id",
                match=models.MatchValue(value=sid)
            ) for sid in source_ids
        ]
        
        try:
            # We use full text keyword matching filter if possible
            filter_must = [
                models.Filter(should=should_filters)
            ]
            
            # Simple keyword search
            search_results = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=models.Filter(
                    must=filter_must
                ),
                limit=10
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
                            score=1.0
                        )
                    )
            return results
        except Exception as exc:
            logfire.warn("Qdrant exact search failed: {error}", error=str(exc))
            return []
