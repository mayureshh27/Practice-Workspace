"""Tests for the context gate (Phase 6).

The nine-slot fixed-budget system: tiktoken budget enforcement,
sentence-boundary cut (C-H2), per-call deep_source override (C-H3),
graph_seed failure handling (C-B3), tool descriptions rendering, and
the diagnostic ``debug_print()`` helper.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.harness.context_gate import (
    BudgetError,
    DefaultContextGate,
    SeedContext,
    _count_tokens,
    _truncate,
)


# ── 1. Tiktoken budget enforcement (C-H1) ───────────────────────────


def test_count_tokens_uses_tiktoken_cl100k() -> None:
    """Token count is via tiktoken, not the old word-split heuristic."""
    text = "The quick brown fox jumps over the lazy dog."
    n = _count_tokens(text)
    # tiktoken cl100k_base on a 9-word English sentence -> ~9-11 tokens
    assert 8 <= n <= 12


def test_count_tokens_empty_string() -> None:
    assert _count_tokens("") == 0


def test_truncate_returns_original_when_within_budget() -> None:
    """Short text is returned verbatim; the tuple's observed == actual."""
    text = "Short."
    out, observed = _truncate(text, 100)
    assert out == text
    assert observed == _count_tokens(text)


# ── 2. Sentence-boundary cut (C-H2) ─────────────────────────────────


def test_truncate_cuts_at_sentence_boundary() -> None:
    """The truncated text ends at the last sentence boundary, not mid-word."""
    sentences = [f"Sentence number {i} is here." for i in range(20)]
    text = " ".join(sentences)
    out, _ = _truncate(text, budget=35)
    assert " [truncated]" in out
    pre_marker = out.replace(" [truncated]", "").rstrip()
    # The cut ends on a sentence boundary (a period) — not in the
    # middle of "Sentence number N"
    assert pre_marker.endswith(".")
    # The cut shouldn't have included the very last sentences
    assert "Sentence number 19" not in pre_marker


def test_truncate_handles_no_sentence_boundary() -> None:
    """If the budget is hit before any sentence boundary, fall back to
    the head as-is."""
    text = "abcdefghij " * 50
    out, _ = _truncate(text, budget=20)
    assert len(out) > 0
    assert out.endswith(" [truncated]")


# ── 3. Per-call deep_source override (C-H3) ─────────────────────────


def test_deep_source_per_call_overrides_constructor_default() -> None:
    """C-H3: the same gate instance can serve different roles in one process."""
    gate = DefaultContextGate(system_prompt="x", deep_source=False)
    shallow = gate.build_seed_context(
        task_intent="q", source_ids=[], workflow_name=None, deep_source=False
    )
    deep = gate.build_seed_context(
        task_intent="q", source_ids=[], workflow_name=None, deep_source=True
    )
    assert isinstance(shallow, SeedContext)
    assert isinstance(deep, SeedContext)
    assert gate._deep_source_default is False
    # The effective budget for retrieved_chunks differs (2000 vs 8000)
    assert gate._effective_budgets(False)["retrieved_chunks"] == 2000
    assert gate._effective_budgets(True)["retrieved_chunks"] == 8000


# ── 4. System slot hard budget raises BudgetError ────────────────────


def test_system_slot_over_budget_raises_budget_error() -> None:
    """The only hard budget in the gate — over it aborts the call."""
    gate = DefaultContextGate(system_prompt="word " * 1000)
    with pytest.raises(BudgetError) as exc_info:
        gate.build_seed_context(task_intent="q", source_ids=[], workflow_name=None)
    err = exc_info.value
    assert err.slot == "system_slot"
    assert err.observed > err.budget
    assert err.budget == 800


def test_system_slot_override_replaces_constructor_prompt() -> None:
    """system_slot_override (per-call) wins over the constructor's system_prompt."""
    gate = DefaultContextGate(system_prompt="")
    override = "You are a helpful assistant. " * 5
    ctx = gate.build_seed_context(
        task_intent="q", source_ids=[], workflow_name=None,
        system_slot_override=override,
    )
    assert ctx.system_slot == override


# ── 5. Tool descriptions rendering ───────────────────────────────────


def test_tool_names_includes_descriptions_when_available(tmp_path: Path) -> None:
    """list_tools_with_descriptions() renders name + description."""
    from app.harness.tool_registry import FileToolRegistry

    (tmp_path / "search.json").write_text(
        json.dumps(
            {
                "name": "source_search",
                "description": "Search the learner's sources for relevant passages.",
            }
        ),
        encoding="utf-8",
    )
    (tmp_path / "no_desc.json").write_text(
        json.dumps({"name": "no_desc"}),
        encoding="utf-8",
    )
    reg = FileToolRegistry(registry_dir=tmp_path)
    rendered = reg.list_tools_with_descriptions()
    assert (
        "source_search: Search the learner's sources for relevant passages."
        in rendered
    )
    assert "no_desc" in rendered


def test_context_gate_uses_list_tools_with_descriptions(tmp_path: Path) -> None:
    """The gate prefers list_tools_with_descriptions() over list_tool_names()."""
    from app.harness.tool_registry import FileToolRegistry

    (tmp_path / "echo.json").write_text(
        json.dumps(
            {"name": "echo", "description": "Echoes the input back."}
        ),
        encoding="utf-8",
    )
    reg = FileToolRegistry(registry_dir=tmp_path)
    gate = DefaultContextGate(system_prompt="", tool_registry=reg)
    ctx = gate.build_seed_context(task_intent="q", source_ids=[], workflow_name=None)
    assert any("echo: Echoes the input back." in s for s in ctx.tool_names)


# ── 6. Graph seed failure handling (C-B3) ────────────────────────────


def test_graph_seed_failure_leaves_slot_empty() -> None:
    """C-B3: graph_seed exception -> empty slot, agent still runs.

    The original code was ``except Exception: pass`` — silent. Phase 6
    replaces it with a WARNING log + empty slot.
    """
    from app.harness.context_gate import _DEFAULT_BUDGETS

    class _BoomLayer:
        def get_concept_context(self, _ids):
            raise RuntimeError("graph layer down")

    gate = DefaultContextGate(system_prompt="", graph_layer=_BoomLayer())
    ctx = gate.build_seed_context(
        task_intent="q", source_ids=["c1", "c2"], workflow_name=None
    )
    # The graph_seed slot is empty
    assert ctx.graph_seed is None
    # The build didn't crash
    assert ctx.system_slot == ""
    assert ctx.task_intent == "q"
    # The budgets object is still the default (no exception leak)
    assert _DEFAULT_BUDGETS["graph_seed"] == 800


# ── 7. debug_print diagnostic helper ─────────────────────────────────


def test_debug_print_renders_per_slot_table() -> None:
    """debug_print() returns a per-slot token table with a TOTAL row."""
    gate = DefaultContextGate(system_prompt="You are a tutor.")
    ctx = gate.build_seed_context(
        task_intent="Quiz the learner on Go loops.",
        source_ids=[],
        workflow_name="Loops Quiz",
    )
    out = gate.debug_print(ctx)
    for slot in (
        "system_slot", "task_intent", "workflow_template", "tool_names",
        "memory_seed", "graph_seed", "retrieved_chunks", "history", "examples",
    ):
        assert slot in out
    assert "TOTAL" in out
    assert out.count("\n") >= 9


# ── 8. Nine slots are all populated on a successful call ───────────


def test_nine_slots_all_present_on_seed_context() -> None:
    """The SeedContext model has the nine ADR-0006 slots + they all
    carry a value (possibly None / empty list / empty string)."""
    gate = DefaultContextGate(system_prompt="x")
    ctx = gate.build_seed_context(task_intent="q", source_ids=[], workflow_name=None)
    for slot in (
        "system_slot", "task_intent", "workflow_template", "tool_names",
        "memory_seed", "graph_seed", "retrieved_chunks", "history", "examples",
    ):
        assert hasattr(ctx, slot), f"SeedContext is missing slot {slot}"
    # The model is frozen (per ADR-0006: the seed context is never
    # mutated after build_seed_context returns).
    with pytest.raises((AttributeError, TypeError, ValueError)):
        ctx.system_slot = "mutated"  # type: ignore[misc]
