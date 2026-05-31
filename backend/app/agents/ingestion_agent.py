"""Ingestion Agent — Pydantic AI agent for structured content ingestion.

Per ADR-0018: one of five distinct Agent Roles.
- deep_source=True (ADR-0007: valid only for Ingestion Agent and synthesis workflows)
- No memory or graph seed slots
- Ingestion Gate + Artifact Gate active
- Extractor-focused tool set
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import Agent

from app.harness.model_router import DefaultModelRouter, ModelRouter


@dataclass
class IngestionDeps:
    source_id: str
    source_type: str  # 'PDF' | 'video' | 'repo' | 'web' | 'notes'
    db_session: object | None = None
    qdrant_router: object | None = None
    graph_layer: object | None = None


_INGESTION_SYSTEM_PROMPT = (
    "You are the Ingestion Agent for the Adaptive Practice Workspace. "
    "Your role is to extract structured content, concepts, and relationships "
    "from learning sources (PDFs, videos, repositories, documentation, notes).\n\n"
    "RULES:\n"
    "1. Preserve math notation and code blocks exactly as written.\n"
    "2. Extract concept candidates with their definitions and prerequisites.\n"
    "3. Identify aliases for each concept (alternative names used in the source).\n"
    "4. Structure content hierarchically: chapter → section → topic.\n"
    "5. Generate chunk-level citations (source_id, chunk_index, page/timestamp).\n\n"
    "Output processed content for downstream indexing into Qdrant, Kuzu, and "
    "the artifact generators."
)


_router: ModelRouter = DefaultModelRouter()


def _resolve_model() -> str:
    cfg = _router.route("ingestion")
    return cfg.pydantic_ai_model()


ingestion_agent = Agent(
    _resolve_model(),
    deps_type=IngestionDeps,
    instructions=_INGESTION_SYSTEM_PROMPT,
)
