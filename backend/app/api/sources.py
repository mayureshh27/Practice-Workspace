"""Sources API — learning source metadata and chunk previews.

GET /api/sources            — list all sources
GET /api/sources/{id}/chunks — list chunk previews for a source
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from pydantic import BaseModel

router = APIRouter(prefix="/api/sources", tags=["sources"])


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


@router.get("/")
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
        result.append(SourceDTO(
            id=src["id"],
            title=src["title"],
            type=src.get("type", "PDF"),
            chunk_count=len(chunks),
            in_context=True,
            chunks=[ChunkPreview(id=c["id"], text=c["preview"]) for c in chunks],
        ))
    return result


@router.get("/{source_id}/chunks")
def get_source_chunks(source_id: str, request: Request) -> list[ChunkPreview]:
    """Return chunk previews for a specific source."""
    retrieval = getattr(request.app.state, "retrieval_router", None)
    if retrieval is None:
        raise HTTPException(status_code=503, detail="Retrieval router not available")

    chunks = retrieval.list_chunk_previews(source_id)
    return [ChunkPreview(id=c["id"], text=c["preview"]) for c in chunks]
