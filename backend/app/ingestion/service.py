"""Ingestion Service — thin wrapper over the existing ingestion-pipeline.

Not a rewrite. The actual pipeline code in ``backend/ingestion-pipeline/``
is called via this service interface. Implementation deferred to the next
slice — this module defines the contract only.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from pydantic import BaseModel


class IngestionResult(BaseModel):
    """Result of ingesting a Learning Source."""

    source_id: str
    source_type: str
    chunk_count: int = 0
    concept_count: int = 0
    artifact_count: int = 0
    errors: list[str] = []


class IngestionService(Protocol):
    """Ingest a Learning Source into the workspace."""

    async def ingest_source(
        self,
        source_path: Path,
        source_type: str,
    ) -> IngestionResult: ...
