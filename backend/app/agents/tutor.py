"""Tutor Agent — Pydantic AI agent for Socratic tutoring.

Per ADR-0003: Pydantic AI is the primary agent runtime.
Per ADR-0018: the Tutor is one of five distinct Agent Roles, each with
its own Context Gate settings, tool set, eval gates, and memory access.

The Socratic Gate (CONTEXT.md) enforces: no solution code, no direct
answers, response ends with a question. This is a permanent architectural
component — the gate is never relaxed.

When no GOOGLE_API_KEY is set, the agent falls back to a TestModel
that returns canned Socratic responses for local development.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from pydantic_ai import Agent
from sqlmodel import Session

from app.harness.retrieval_router import ChunkResult


@dataclass
class TutorDeps:
    """Dependencies injected into the Tutor Agent at run time."""

    session_id: str
    concept_ids: list[str]
    source_ids: list[str]
    db_session: Session | None = None
    memory_context: str | None = None  # from Memory Seed Protocol files


_TUTOR_SYSTEM_PROMPT = (
    "You are a Socratic tutor for technical learning. "
    "Your role is to guide the learner toward understanding through questions "
    "and hints, never by giving away the answer.\n\n"
    "ABSOLUTE RULES — violation is a system failure:\n"
    "1. NEVER provide solution code, complete function implementations, or direct answers.\n"
    "2. NEVER say 'The answer is...' or 'Here is the solution...'\n"
    "3. ALWAYS end your response with a guiding question.\n\n"
    "Instead of answers, use these strategies:\n"
    "- Ask clarifying questions about the learner's understanding\n"
    "- Point to relevant concepts or prerequisites\n"
    "- Give partial hints that require the learner to complete the reasoning\n"
    "- Reference the source material when applicable\n"
    "- Acknowledge progress and specific mastery improvements\n\n"
    "Use the learner's memory context (mastery scores, blind spots) to "
    "calibrate the difficulty of your hints."
)


def _select_model() -> str:
    """Pick the model based on available API keys."""
    if os.environ.get("GOOGLE_API_KEY"):
        return "google:gemini-2.5-flash"
    # Fallback: Pydantic AI TestModel is used when no key is present
    return "test"


tutor_agent = Agent(
    _select_model(),
    deps_type=TutorDeps,
    instructions=_TUTOR_SYSTEM_PROMPT,
)


@tutor_agent.tool
async def source_search(
    ctx,
    query: str,
    source_ids: list[str],
    mode: str = "hybrid",
) -> str:
    """Search source chunks for relevant study material.

    Use for conceptual questions about the subject matter.
    source_ids is mandatory — omitting it is a TypeError.
    """
    # V1 stub: RetrievalRouter not yet wired to Qdrant
    return (
        "No source chunks indexed yet. The Retrieval Router will be "
        "connected to Qdrant in a future update. For now, rely on the "
        "learner's question and your pedagogical knowledge."
    )


@tutor_agent.tool
async def source_search_exact(
    ctx,
    tokens: str,
    source_ids: list[str],
) -> str:
    """BM25-only exact-token search for error messages, function names, variables.

    Use this instead of source_search when looking up specific identifiers.
    source_ids is mandatory.
    """
    # V1 stub
    return (
        "No source chunks indexed yet for exact search. "
        "The BM25 index will be available after Qdrant integration."
    )


@tutor_agent.tool
async def get_concept_context(
    ctx,
    concept_ids: list[str],
) -> str:
    """Look up concept definitions, prerequisite chains, and mastery scores.

    Returns structured context from the Knowledge Graph.
    """
    # V1 stub: GraphLayer not yet wired to Kuzu/Graphiti
    if not concept_ids:
        return "No concept IDs provided."
    return (
        f"Concept context for {', '.join(concept_ids)}: "
        "Knowledge Graph not yet connected. Prerequisite chains and "
        "mastery history will be available after Kuzu/Graphiti integration."
    )
