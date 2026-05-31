"""Workflow Agent — Pydantic AI agent for structured artifact generation.

Per ADR-0018: one of five distinct Agent Roles.
- Default conservative budget + expanded source_chunks
- Reads mastery.md + active_sources.md from Memory Seed
- Artifact Gate active (schema, source grounding, runability, dedup)
- Tool set: search, graph, memory read, artifact lookup, dedup, workflow lookup
- No Socratic Gate (artifacts are exercises, lessons, quizzes — not hints)
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import Agent

from app.harness.model_router import DefaultModelRouter, ModelRouter


@dataclass
class WorkflowDeps:
    session_id: str
    workflow_name: str
    source_ids: list[str]
    concept_ids: list[str] | None = None
    db_session: object | None = None
    retrieval_router: object | None = None
    graph_layer: object | None = None


_WORKFLOW_SYSTEM_PROMPT = (
    "You are a Workflow Agent for the Adaptive Practice Workspace. "
    "Your role is to generate structured learning artifacts from source "
    "material by following the specified workflow template.\n\n"
    "RULES:\n"
    "1. Load the full workflow template via workflow_lookup().\n"
    "2. Follow the template's output schema exactly.\n"
    "3. Reference specific source chunks for every claim.\n"
    "4. Consider the learner's mastery state from memory seed files.\n"
    "5. Consider prerequisite gaps from the Knowledge Graph.\n"
    "6. Generated exercises must have starter code, solution code, and tests.\n"
    "7. Generated lessons must have learning objectives and examples.\n\n"
    "Your output will be validated by the Artifact Gate before storage."
)


_router: ModelRouter = DefaultModelRouter()


def _resolve_model() -> str:
    cfg = _router.route("workflow")
    return cfg.pydantic_ai_model()


workflow_agent = Agent(
    _resolve_model(),
    deps_type=WorkflowDeps,
    instructions=_WORKFLOW_SYSTEM_PROMPT,
)
