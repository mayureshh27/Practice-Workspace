from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import Agent

from app.harness.model_router import DefaultModelRouter, ModelRouter


@dataclass
class TutorDeps:
    session_id: str
    concept_ids: list[str]
    source_ids: list[str]
    db_session: object | None = None
    memory_context: str | None = None
    retrieval_router: object | None = None
    graph_layer: object | None = None


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


_router: ModelRouter = DefaultModelRouter()


def _resolve_model() -> str:
    cfg = _router.route("tutor")
    return cfg.pydantic_ai_model()


tutor_agent = Agent(
    _resolve_model(),
    deps_type=TutorDeps,
    instructions=_TUTOR_SYSTEM_PROMPT,
)


@tutor_agent.tool
async def source_search(  # type: ignore
    ctx,
    query: str,
    source_ids: list[str],
    mode: str = "hybrid",
) -> str:
    """Search source chunks for relevant study material.

    Use for conceptual questions about the subject matter.
    source_ids is mandatory — omitting it is a TypeError.
    """
    router = ctx.deps.retrieval_router
    if router is None:
        return (
            "No source chunks indexed yet. The Retrieval Router will be "
            "connected to Qdrant in a future update."
        )
    try:
        results = router.source_search(query, source_ids=source_ids, mode=mode)
        if not results:
            return "No matching source chunks found."
        parts = [f"Found {len(results)} relevant chunk(s):"]
        for r in results[:5]:
            parts.append(
                f"- [{r.source_id}/{r.chunk_index}] {r.preview[:200]}"
            )
            if r.file_path:
                parts.append(f"  (full chunk: {r.file_path})"
            )
        return "\n".join(parts)
    except Exception as exc:
        return f"Search failed: {exc}"


@tutor_agent.tool
async def source_search_exact(  # type: ignore
    ctx,
    tokens: str,
    source_ids: list[str],
) -> str:
    """BM25-only exact-token search for error messages, function names, variables.

    Use this instead of source_search when looking up specific identifiers.
    source_ids is mandatory.
    """
    router = ctx.deps.retrieval_router
    if router is None:
        return (
            "No source chunks indexed yet for exact search. "
            "The BM25 index will be available after Qdrant integration."
        )
    try:
        results = router.source_search_exact(tokens, source_ids=source_ids)
        if not results:
            return "No exact matches found."
        parts = [f"Found {len(results)} exact match(es):"]
        for r in results[:5]:
            parts.append(
                f"- [{r.source_id}/{r.chunk_index}] {r.preview[:200]}"
            )
        return "\n".join(parts)
    except Exception as exc:
        return f"Exact search failed: {exc}"


@tutor_agent.tool
async def get_concept_context(  # type: ignore
    ctx,
    concept_ids: list[str],
) -> str:
    """Look up concept definitions, prerequisite chains, and mastery scores.

    Returns structured context from the Knowledge Graph.
    """
    gl = ctx.deps.graph_layer
    if gl is None or not concept_ids:
        if not concept_ids:
            return "No concept IDs provided."
        return (
            f"Concept context for {', '.join(concept_ids)}: "
            "Knowledge Graph not yet connected."
        )
    try:
        context = gl.get_concept_context(concept_ids)
        parts = []
        for c in context.concepts:
            parts.append(f"## {c.canonical_name} ({c.concept_id})")
            if c.mastery_score is not None:
                parts.append(f"  Mastery: {c.mastery_score:.2f}")
            else:
                parts.append("  Mastery: not yet practiced")
        if context.prereq_chain:
            parts.append("\n### Prerequisite Chain")
            for p in context.prereq_chain:
                score = f"{p.mastery_score:.2f}" if p.mastery_score is not None else "unknown"
                parts.append(f"- {p.canonical_name} (mastery: {score})")
        if context.gap_concepts:
            parts.append("\n### Prerequisite Gaps (below threshold)")
            for g in context.gap_concepts:
                parts.append(f"- {g.canonical_name}")
        return "\n".join(parts) if parts else "No concept context found."
    except Exception as exc:
        return f"Graph lookup failed: {exc}"
