# Context Builder Uses Fixed Slots With Controlled Retrieval

The Context Engineering Layer will use fixed named slots with hard budgets for system rules, skills, memories, tools, history, examples, and the user message, while allowing dynamic retrieval only inside named slots. This preserves the anti-bloat and anti-poisoning benefits of a deterministic context plan, while leaving room for retrieval from Qdrant, Graphiti/Kuzu, SQLite memory events, and workflow templates as the product evolves.

## Consequences

The system slot is a hard budget and must not be silently truncated. Other slots may be trimmed with usage diagnostics. The implementation should adapt the handoff's ContextBuilder idea but depend on product contracts such as RetrievalLayer, GraphLayer, MemoryStore, ModelRouter, and ToolRegistry rather than directly depending on Chroma, mem0, or provider-specific clients.

---

## Amendment — Phase 6 (2026-06-02)

The "fixed named slots with hard budgets" commitment above is
operationalised by the ``DefaultContextGate`` in
``app/harness/context_gate.py``. The amendment captures the slot
assignment order, the budget enforcement mechanism, and the failure
modes the new code keeps.

### Slot assignment order

The ``build_seed_context`` method assembles the nine slots in this
fixed order (callers cannot reorder):

1. ``system_slot`` — hard budget; raises ``BudgetError`` if exceeded.
2. ``task_intent`` — soft budget; truncated with a logged warning.
3. ``tool_names`` — populated by ``ToolRegistry.list_tool_names()``;
   no truncation (each name is ~20 tokens).
4. ``memory_seed`` — read from the four Memory Seed Protocol files
   in ``memories_dir`` (``mastery.md``, ``blind_spots.md``,
   ``active_sources.md``, ``position.md``); soft budget.
5. ``graph_seed`` — populated by
   ``GraphLayer.get_concept_context(source_ids)``; soft budget.
   Failures (exceptions, timeouts, missing concepts) are logged at
   ``WARNING`` and the slot is left empty — the agent still runs
   without graph context, but the operator sees the gap in Logfire.
6. ``retrieved_chunks`` — populated by ``RetrievalRouter`` (Phase 6
   leaves this empty until the router is wired).
7. ``history`` — populated by the caller (agent service); soft budget.
8. ``examples`` — populated by the caller; soft budget.
9. ``workflow_template`` — passed in as the workflow name; soft budget.

### Budget enforcement

Budgets are token counts measured by ``tiktoken``
(``encoding_for_model(...)``), not word approximations. The
``_truncate`` helper uses the same tokenizer to cut at a
**sentence boundary** (look-back for the last ``.!?`` followed by
whitespace) so the truncated slot never ends mid-word. This is the
C-H2 fix from the layered review.

The ``system_slot`` is the only hard budget (800 tokens). All other
slots are soft — they get truncated to fit and log a warning.

### Per-call `deep_source` (formerly constructor-only)

``deep_source`` is a per-call argument to ``build_seed_context``,
not a constructor parameter on ``DefaultContextGate``. This
resolves C-H3 (the previous design made every agent in the same
process share a single ``deep_source`` setting). When ``True``:

* ``retrieved_chunks`` budget expands 4× (8000 tokens).
* ``history`` budget expands 4× (12000 tokens).
* All other slots are unchanged.

The constructor still takes ``deep_source`` for the simple case
where an agent always wants the same setting; the per-call
argument overrides the constructor value.

### Tool descriptions

The ``tool_names`` slot is populated by the new
``ToolRegistry.list_tools_with_descriptions()`` method (added in
Phase 6). Each entry is rendered as ``"{name}: {description}"``
so the LLM sees what each tool does without needing a separate
``tool_lookup`` call. The slot budget (200 tokens) is enough for
~10 tool entries at ~20 tokens each.

### Failure modes

* ``system_slot`` > 800 tokens → ``BudgetError`` raised; the agent
  call is aborted (no point running with a poisoned system prompt).
* Any other slot over its budget → silently truncated, WARNING
  logged with ``slot=`` and ``observed/budget`` for diagnostics.
* ``graph_seed`` failure → WARNING logged, slot left empty.
* ``memory_seed`` directory missing → slot left empty (silent —
  this is the on-disk default).
* ``tool_registry`` is None → ``tool_names`` is empty list.
