"""Context Gate — harness primitive for seed context assembly.

The nine-slot fixed-budget system that governs every token entering a model
call (CONTEXT.md, ADR-0006, ADR-0007). This module defines the Protocol
interface AND a concrete ``DefaultContextGate`` implementation.

Slot budget enforcement (ADR-0006):
  - system_slot: hard budget — raises BudgetError if exceeded
  - all other slots: soft budget — truncated at a sentence boundary with
    a logged warning (C-H2)

Deep-source mode (ADR-0007):
  - Constructor parameter (default) AND per-call argument to
    ``build_seed_context`` (override). C-H3 resolved: one gate can serve
    multiple agent roles in the same process.
  - Expands retrieved_chunks and history budgets by 4x
  - Valid only for Ingestion Agent and synthesis workflows

Token counting (Phase 6 — C-H1):
  - Uses ``tiktoken`` with the ``cl100k_base`` encoding (the closest
    cross-provider BPE; Gemini uses the same family). The word-split
    approximation is gone; budgets are exact in tokens.

Failure modes (Phase 6 — C-B3):
  - ``graph_seed`` failure logs at WARNING with source ids and exception
    type, then leaves the slot empty. No more silent ``except: pass``.
  - ``memory_seed`` directory missing -> slot empty, no log.
  - ``tool_registry is None`` -> tool_names is empty list, no log.
  - Any other slot over its budget -> silent truncation + WARNING log.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol, runtime_checkable

import logfire
import tiktoken
from pydantic import BaseModel, ConfigDict

if TYPE_CHECKING:
    from app.harness.tool_registry import ToolRegistry


class BudgetError(Exception):
    """Raised when the system slot exceeds its hard token budget."""

    def __init__(self, slot: str, observed: int, budget: int) -> None:
        self.slot = slot
        self.observed = observed
        self.budget = budget
        super().__init__(
            f"Slot '{slot}' exceeds hard budget: {observed} tokens > "
            f"{budget} budget"
        )


class SeedContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    system_slot: str = ""
    task_intent: str = ""
    workflow_template: str | None = None
    tool_names: list[str] = []
    memory_seed: str | None = None
    graph_seed: str | None = None
    retrieved_chunks: list[str] = []
    history: list[str] = []
    examples: list[str] = []


@runtime_checkable
class ContextGate(Protocol):
    """Build a bounded seed context for a model call."""

    def build_seed_context(
        self,
        *,
        task_intent: str,
        source_ids: list[str],
        workflow_name: str | None,
    ) -> SeedContext: ...


_DEFAULT_BUDGETS = {
    "system_slot": 800,
    "task_intent": 200,
    "workflow_template": 400,
    "tool_names": 200,
    "memory_seed": 600,
    "graph_seed": 800,
    "retrieved_chunks": 2000,
    "history": 3000,
    "examples": 1400,
}

_DEEP_SOURCE_MULTIPLIER = 4

_ENCODER: tiktoken.Encoding | None = None


def _get_encoder() -> tiktoken.Encoding:
    global _ENCODER
    if _ENCODER is None:
        _ENCODER = tiktoken.get_encoding("cl100k_base")
    return _ENCODER


def _count_tokens(text: str) -> int:
    if not text:
        return 0
    return len(_get_encoder().encode(text))


def _truncate(text: str, budget: int) -> tuple[str, int]:
    if not text:
        return "", 0
    observed = _count_tokens(text)
    if observed <= budget:
        return text, observed
    enc = _get_encoder()
    tokens = enc.encode(text)
    if len(tokens) <= budget:
        return text, observed

    marker = " [truncated]"
    marker_tokens = _count_tokens(marker)
    eff_budget = budget - marker_tokens
    if eff_budget <= 0:
        return marker, marker_tokens

    head = enc.decode(tokens[:eff_budget])
    last_boundary = -1
    for i in range(len(head) - 1, 0, -1):
        ch = head[i]
        if ch in ".!?" and i + 1 < len(head) and head[i + 1].isspace():
            last_boundary = i + 1
            break
    if last_boundary > 0:
        head = head[:last_boundary].rstrip()
    truncated = head + marker
    return truncated, _count_tokens(truncated)


class DefaultContextGate:
    """Nine-slot fixed-budget context assembly."""

    def __init__(
        self,
        *,
        tool_registry: ToolRegistry | None = None,
        memories_dir: Path | None = None,
        system_prompt: str = "",
        deep_source: bool = False,
        graph_layer: Any | None = None,
    ) -> None:
        self._tool_registry = tool_registry
        self._memories_dir = memories_dir or Path("memories")
        self._system_prompt = system_prompt
        self._deep_source_default = deep_source
        self._graph_layer = graph_layer

    def _effective_budgets(self, deep_source: bool) -> dict[str, int]:
        budgets = dict(_DEFAULT_BUDGETS)
        if deep_source:
            budgets["retrieved_chunks"] *= _DEEP_SOURCE_MULTIPLIER
            budgets["history"] *= _DEEP_SOURCE_MULTIPLIER
        return budgets

    def _read_tool_names(self) -> list[str]:
        if self._tool_registry is None:
            return []
        list_with_desc = getattr(
            self._tool_registry, "list_tools_with_descriptions", None
        )
        list_names = getattr(self._tool_registry, "list_tool_names", None)
        try:
            if callable(list_with_desc):
                result = list_with_desc()
                return list(result) if result is not None else []
            if callable(list_names):
                result = list_names()
                return list(result) if result is not None else []
        except Exception as exc:  # pragma: no cover
            logfire.warning(
                "Context Gate: tool registry raised: {exc}",
                exc=str(exc),
            )
        return []

    def build_seed_context(
        self,
        *,
        task_intent: str,
        source_ids: list[str],
        workflow_name: str | None = None,
        deep_source: bool | None = None,
        system_slot_override: str | None = None,
        history: list[str] | None = None,
        examples: list[str] | None = None,
    ) -> SeedContext:
        effective_deep = (
            self._deep_source_default if deep_source is None else deep_source
        )
        budgets = self._effective_budgets(effective_deep)

        system_text = (
            system_slot_override
            if system_slot_override is not None
            else self._system_prompt
        )
        system_tokens = _count_tokens(system_text)
        if system_tokens > budgets["system_slot"]:
            raise BudgetError(
                slot="system_slot",
                observed=system_tokens,
                budget=budgets["system_slot"],
            )

        task_text, task_observed = _truncate(task_intent, budgets["task_intent"])
        if task_observed > budgets["task_intent"]:
            logfire.warning(
                "Context Gate: task_intent truncated to fit budget",
                observed=task_observed,
                budget=budgets["task_intent"],
            )

        tool_names = self._read_tool_names()
        if tool_names:
            joined = ", ".join(tool_names)
            truncated, observed = _truncate(joined, budgets["tool_names"])
            if observed > budgets["tool_names"]:
                logfire.warning(
                    "Context Gate: tool_names truncated to fit budget",
                    observed=observed,
                    budget=budgets["tool_names"],
                )
                tool_names = [s.strip() for s in truncated.split(", ") if s.strip()]

        memory_seed = self._read_memory_seed()
        if memory_seed is not None:
            truncated, observed = _truncate(memory_seed, budgets["memory_seed"])
            if observed > budgets["memory_seed"]:
                logfire.warning(
                    "Context Gate: memory_seed truncated to fit budget",
                    observed=observed,
                    budget=budgets["memory_seed"],
                )
                memory_seed = truncated

        graph_seed: str | None = None
        if self._graph_layer is not None and source_ids:
            try:
                context = self._graph_layer.get_concept_context(source_ids)
                parts: list[str] = []
                for c in context.concepts:
                    score = (
                        f"{c.mastery_score:.2f}"
                        if c.mastery_score is not None
                        else "not practiced"
                    )
                    parts.append(f"- {c.canonical_name}: mastery {score}")
                if context.prereq_chain:
                    parts.append("\nPrerequisite chain:")
                    for p in context.prereq_chain:
                        parts.append(f"  - {p.canonical_name}")
                if context.gap_concepts:
                    parts.append("\nPrerequisite gaps (below threshold):")
                    for g in context.gap_concepts:
                        parts.append(f"  - {g.canonical_name}")
                graph_seed = "\n".join(parts) if parts else None
            except Exception as exc:
                logfire.warning(
                    "Context Gate: graph_seed failed for {n} source(s): "
                    "{exc_type}: {exc}",
                    n=len(source_ids),
                    exc_type=type(exc).__name__,
                    exc=str(exc),
                )
                graph_seed = None
        if graph_seed is not None:
            truncated, observed = _truncate(graph_seed, budgets["graph_seed"])
            if observed > budgets["graph_seed"]:
                logfire.warning(
                    "Context Gate: graph_seed truncated to fit budget",
                    observed=observed,
                    budget=budgets["graph_seed"],
                )
                graph_seed = truncated

        retrieved_chunks: list[str] = []

        history_list = list(history or [])
        if history_list:
            joined = "\n".join(history_list)
            truncated, observed = _truncate(joined, budgets["history"])
            if observed > budgets["history"]:
                logfire.warning(
                    "Context Gate: history truncated to fit budget",
                    observed=observed,
                    budget=budgets["history"],
                )
                history_list = truncated.split("\n")
                if history_list and history_list[-1].endswith(" [truncated]"):
                    history_list.pop()
                    if history_list:
                        history_list[-1] = history_list[-1] + " [truncated]"

        examples_list = list(examples or [])
        if examples_list:
            joined = "\n".join(examples_list)
            truncated, observed = _truncate(joined, budgets["examples"])
            if observed > budgets["examples"]:
                logfire.warning(
                    "Context Gate: examples truncated to fit budget",
                    observed=observed,
                    budget=budgets["examples"],
                )
                examples_list = truncated.split("\n")
                if examples_list and examples_list[-1].endswith(" [truncated]"):
                    examples_list.pop()
                    if examples_list:
                        examples_list[-1] = examples_list[-1] + " [truncated]"

        workflow_text: str | None = workflow_name
        if workflow_text:
            truncated, observed = _truncate(
                workflow_text, budgets["workflow_template"]
            )
            if observed > budgets["workflow_template"]:
                logfire.warning(
                    "Context Gate: workflow_template truncated to fit budget",
                    observed=observed,
                    budget=budgets["workflow_template"],
                )
                workflow_text = truncated

        ctx = SeedContext(
            system_slot=system_text,
            task_intent=task_text,
            workflow_template=workflow_text,
            tool_names=tool_names,
            memory_seed=memory_seed,
            graph_seed=graph_seed,
            retrieved_chunks=retrieved_chunks,
            history=history_list,
            examples=examples_list,
        )

        total_tokens = sum(
            _count_tokens(s)
            for s in [
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
            deep=effective_deep,
        )
        return ctx

    def debug_print(self, ctx: SeedContext) -> str:
        """Return a per-slot token summary for diagnostic / smoke tests.

        Per PRD section 18: debug_print() produces output without side
        effects. Operators paste this into support tickets so the
        support engineer can read budget compliance at a glance.
        """
        rows = [
            ("system_slot", _count_tokens(ctx.system_slot)),
            ("task_intent", _count_tokens(ctx.task_intent)),
            ("workflow_template", _count_tokens(ctx.workflow_template or "")),
            ("tool_names", _count_tokens(" ".join(ctx.tool_names))),
            ("memory_seed", _count_tokens(ctx.memory_seed or "")),
            ("graph_seed", _count_tokens(ctx.graph_seed or "")),
            ("retrieved_chunks", _count_tokens(" ".join(ctx.retrieved_chunks))),
            ("history", _count_tokens(" ".join(ctx.history))),
            ("examples", _count_tokens(" ".join(ctx.examples))),
        ]
        lines = ["Context Gate -- per-slot tokens:"]
        total = 0
        for name, tokens in rows:
            lines.append(f"  {name:<20} {tokens:>6}")
            total += tokens
        lines.append(f"  {'TOTAL':<20} {total:>6}")
        return "\n".join(lines)

    def _read_memory_seed(self) -> str | None:
        """Read Memory Seed Protocol files if they exist.

        The directory may be absent (the on-disk default); in that
        case the slot is left empty silently. Files that exist but
        are empty are skipped (the joining logic handles empty
        strings via the if content: guard).
        """
        if not self._memories_dir.is_dir():
            return None

        parts: list[str] = []
        for filename in (
            "mastery.md",
            "blind_spots.md",
            "active_sources.md",
            "position.md",
        ):
            path = self._memories_dir / filename
            if path.is_file():
                content = path.read_text(encoding="utf-8").strip()
                if content:
                    parts.append(content)

        return "\n\n---\n\n".join(parts) if parts else None
