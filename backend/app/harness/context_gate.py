"""Context Gate — harness primitive for seed context assembly.

The nine-slot fixed-budget system that governs every token entering a model
call (CONTEXT.md). This module defines the Protocol interface AND a concrete
``DefaultContextGate`` implementation.

Slot budget enforcement (ADR-0006):
  - system_slot: hard budget — raises BudgetError if exceeded
  - all other slots: soft budget — truncated with a warning

Deep-source mode (ADR-0007):
  - Constructor parameter, never a default
  - Expands retrieved_chunks and history budgets by 4×
  - Valid only for Ingestion Agent and synthesis workflows
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Protocol

import logfire
from pydantic import BaseModel

if TYPE_CHECKING:
    from app.harness.tool_registry import FileToolRegistry


class BudgetError(Exception):
    """Raised when the system slot exceeds its hard token budget."""


class SeedContext(BaseModel):
    """The bounded context assembled by the Context Gate.

    Approximately 9,400 tokens. The agent discovers additional context
    at runtime via tool calls (ADR-0015: seed-and-discover pattern).
    """

    system_slot: str = ""
    task_intent: str = ""
    workflow_template: str | None = None
    tool_names: list[str] = []
    memory_seed: str | None = None  # from Memory Seed Protocol files
    graph_seed: str | None = None  # from GraphLayer.get_concept_context()
    retrieved_chunks: list[str] = []
    history: list[str] = []
    examples: list[str] = []


class ContextGate(Protocol):
    """Build a bounded seed context for a model call.

    The graph_seed slot is populated by GraphLayer.get_concept_context() —
    concept definitions, prerequisite chains, mastery scores, and
    Prerequisite Gap concepts below the configured threshold (ADR-0029).
    """

    def build_seed_context(
        self,
        *,
        task_intent: str,
        source_ids: list[str],
        workflow_name: str | None,
    ) -> SeedContext: ...


# ── Slot budgets (token counts, approximated by word count) ─────────

_DEFAULT_BUDGETS = {
    "system_slot": 800,       # hard budget
    "task_intent": 200,
    "workflow_template": 400,
    "tool_names": 200,
    "memory_seed": 600,
    "graph_seed": 800,
    "retrieved_chunks": 2000,
    "history": 3000,
    "examples": 1400,
}

_DEEP_SOURCE_MULTIPLIER = 4  # for retrieved_chunks and history only


def _count_tokens(text: str) -> int:
    """Approximate token count via whitespace splitting.

    Good enough for budget enforcement without an external tokenizer.
    Real tokenizers can be swapped in later behind this function.
    """
    return len(text.split())


def _truncate(text: str, budget: int) -> str:
    """Truncate text to stay within the approximate token budget."""
    words = text.split()
    if len(words) <= budget:
        return text
    return " ".join(words[:budget]) + " [truncated]"


class DefaultContextGate:
    """Nine-slot fixed-budget context assembly.

    Constructor parameters:
      tool_registry: provides tool names for the tool_names slot
      memories_dir: directory containing Memory Seed Protocol files
      deep_source: expands retrieved_chunks and history by 4× (ADR-0007)

    GraphLayer and RetrievalRouter are optional — when absent, their
    slots are left empty. This preserves Layer Contract boundaries while
    the implementations are stubs.
    """

    def __init__(
        self,
        *,
        tool_registry: FileToolRegistry | None = None,
        memories_dir: Path | None = None,
        system_prompt: str = "",
        deep_source: bool = False,
    ) -> None:
        self._tool_registry = tool_registry
        self._memories_dir = memories_dir or Path("memories")
        self._system_prompt = system_prompt
        self._deep_source = deep_source

        # Compute effective budgets
        self._budgets = dict(_DEFAULT_BUDGETS)
        if deep_source:
            self._budgets["retrieved_chunks"] *= _DEEP_SOURCE_MULTIPLIER
            self._budgets["history"] *= _DEEP_SOURCE_MULTIPLIER

    def build_seed_context(
        self,
        *,
        task_intent: str,
        source_ids: list[str],
        workflow_name: str | None = None,
    ) -> SeedContext:
        """Assemble the nine-slot seed context.

        Raises ``BudgetError`` if the system slot exceeds its hard budget.
        Soft-budget slots are truncated with a logged warning.
        """
        # ── 1. System slot (hard budget) ────────────────────────────
        system_text = self._system_prompt
        system_tokens = _count_tokens(system_text)
        if system_tokens > self._budgets["system_slot"]:
            raise BudgetError(
                f"System slot exceeds hard budget: {system_tokens} tokens "
                f"> {self._budgets['system_slot']} budget"
            )

        # ── 2. Task intent ──────────────────────────────────────────
        task_text = _truncate(task_intent, self._budgets["task_intent"])

        # ── 3. Tool names ───────────────────────────────────────────
        tool_names: list[str] = []
        if self._tool_registry is not None:
            tool_names = self._tool_registry.list_tool_names()

        # ── 4. Memory seed (from files, not injected) ───────────────
        memory_seed = self._read_memory_seed()

        # ── 5. Graph seed (empty until GraphLayer is wired) ─────────
        graph_seed: str | None = None

        # ── 6. Retrieved chunks (empty until RetrievalRouter is wired)
        retrieved_chunks: list[str] = []

        # ── 7–9. History, examples, workflow template ───────────────
        # These are populated by the caller (agent service) since they
        # depend on conversation state and workflow selection.
        ctx = SeedContext(
            system_slot=system_text,
            task_intent=task_text,
            workflow_template=workflow_name,
            tool_names=tool_names,
            memory_seed=memory_seed,
            graph_seed=graph_seed,
            retrieved_chunks=retrieved_chunks,
            history=[],
            examples=[],
        )

        total_tokens = sum(
            _count_tokens(s) for s in [
                ctx.system_slot,
                ctx.task_intent,
                ctx.workflow_template or "",
                " ".join(ctx.tool_names),
                ctx.memory_seed or "",
                ctx.graph_seed or "",
                " ".join(ctx.retrieved_chunks),
                " ".join(ctx.history),
                " ".join(ctx.examples),
            ]
        )
        logfire.info(
            "Context Gate assembled {total} tokens (deep_source={deep})",
            total=total_tokens,
            deep=self._deep_source,
        )
        return ctx

    def _read_memory_seed(self) -> str | None:
        """Read Memory Seed Protocol files if they exist."""
        if not self._memories_dir.is_dir():
            return None

        parts: list[str] = []
        for filename in ("mastery.md", "blind_spots.md", "active_sources.md", "position.md"):
            path = self._memories_dir / filename
            if path.is_file():
                content = path.read_text(encoding="utf-8").strip()
                if content:
                    parts.append(content)

        return "\n\n---\n\n".join(parts) if parts else None
