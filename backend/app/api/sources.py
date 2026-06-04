"""Sources API — learning source metadata and chunk previews.

GET /api/sources            — list all sources
GET /api/sources/{id}/chunks — list chunk previews for a source
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/sources", tags=["sources"])


class IngestSourceBody(BaseModel):
    source_id: str = Field(alias="sourceId")
    source_type: str = Field(alias="sourceType")
    source_name: str = Field(alias="sourceName")
    chunks: list[dict[str, Any]] | None = None
    concept_candidates: list[dict[str, Any]] | None = Field(alias="conceptCandidates", default=None)
    graph_facts: list[Any] | None = Field(alias="graphFacts", default=None)

    model_config = {"populate_by_name": True}


def run_ingestion_in_background(
    source_id: str,
    source_type: str,
    source_name: str,
    chunks: list[dict[str, Any]] | None,
    concept_candidates: list[dict[str, Any]] | None,
    graph_facts: list[Any] | None,
) -> None:
    import logfire
    from sqlmodel import Session

    from app.domain.events import SourceIngested
    from app.harness.event_emitter import emit_event
    from app.harness.ingestion_gate import validate_ingestion_stage
    from app.storage.database import get_engine

    gate_result = validate_ingestion_stage(
        chunks=chunks,
        concept_candidates=concept_candidates,
        graph_facts=graph_facts,
    )
    if not gate_result.passed:
        logfire.warning(
            "Ingestion Gate failed for source {source_id}: {failures}",
            source_id=source_id,
            failures="; ".join(gate_result.failures),
        )
        return

    try:
        with Session(get_engine()) as session:
            emit_event(
                session,
                SourceIngested(
                    source_id=source_id,
                    source_type=source_type,
                    source_name=source_name,
                    chunk_count=len(chunks) if chunks else 0,
                ),
            )
    except Exception as exc:
        logfire.error(
            "Failed to emit SourceIngested event for source {source_id}: {error}",
            source_id=source_id,
            error=str(exc),
        )


@router.post("/ingest", status_code=202)
def ingest_source(
    body: IngestSourceBody,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    """Ingest a learning source asynchronously.

    Runs validation via the Ingestion Gate first, and if passed,
    emits the SourceIngested event.
    """
    background_tasks.add_task(
        run_ingestion_in_background,
        source_id=body.source_id,
        source_type=body.source_type,
        source_name=body.source_name,
        chunks=body.chunks,
        concept_candidates=body.concept_candidates,
        graph_facts=body.graph_facts,
    )
    return {"status": "accepted"}


class ChunkPreview(BaseModel):
    id: str
    text: str


class SourceDTO(BaseModel):
    id: str
    title: str
    type: str
    chunk_count: int
    in_context: bool
    chunks: list[ChunkPreview] = []


@router.get("")
def list_sources(request: Request) -> list[SourceDTO]:
    """Return all learning sources with metadata.

    When the retrieval router is not wired, returns an empty list.
    "in_context" is always true for the first slice — context toggling
    will be added with the context gate slot management in Phase 6.
    """
    retrieval = getattr(request.app.state, "retrieval_router", None)
    if retrieval is None:
        return []

    sources = retrieval.list_sources()
    result: list[SourceDTO] = []
    for src in sources:
        chunks = retrieval.list_chunk_previews(src["id"])
        result.append(
            SourceDTO(
                id=src["id"],
                title=src["title"],
                type=src.get("type", "PDF"),
                chunk_count=len(chunks),
                in_context=True,
                chunks=[ChunkPreview(id=c["id"], text=c["preview"]) for c in chunks],
            )
        )
    return result


@router.get("/{source_id}/chunks")
def get_source_chunks(source_id: str, request: Request) -> list[ChunkPreview]:
    """Return chunk previews for a specific source."""
    retrieval = getattr(request.app.state, "retrieval_router", None)
    if retrieval is None:
        raise HTTPException(status_code=503, detail="Retrieval router not available")

    chunks = retrieval.list_chunk_previews(source_id)
    return [ChunkPreview(id=c["id"], text=c["preview"]) for c in chunks]
