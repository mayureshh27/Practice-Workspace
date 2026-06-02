# Context Budget Defaults To Conservative With Deep Source Mode

The Context Engineering Layer will default to a conservative 30k-40k token context budget even when models support much larger windows, because the core practice loop depends on precise context selection and resistance to bloat. Long-context behavior is available only through explicit deep-source workflows for ingestion, research, or source synthesis tasks where larger context is justified.

## Consequences

Default slots include system, workflow template, skills and rules, learner memories, graph facts, retrieved source chunks, tools, history summary and tail, examples or artifacts, and the user request. Agents should not paste entire sources into tutor or practice prompts; they must retrieve, summarize, or enter deep-source mode intentionally.

---

## Amendment — Phase 6 (2026-06-02)

The "conservative 30k-40k default" commitment above is operationalised
by the slot budget table in
``app/harness/context_gate.py::_DEFAULT_BUDGETS`` (added in Phase 6).
The amendment captures the budget values, the deep_source expansion
rule, and the per-call override contract.

### Default slot budget table

The conservative default totals ~9600 tokens — well under the
30k–40k target. The remaining headroom is for the dynamic slots
(history, retrieved_chunks) which scale with the conversation and
the retrieval query.

| Slot | Default (tokens) | Notes |
|---|---|---|
| ``system_slot`` | 800 | Hard budget — raises ``BudgetError``. |
| ``task_intent`` | 200 | The user's request, truncated. |
| ``workflow_template`` | 400 | The template's name + metadata. |
| ``tool_names`` | 200 | ~10 tool entries with descriptions. |
| ``memory_seed`` | 600 | The four Memory Seed Protocol files concatenated. |
| ``graph_seed`` | 800 | Concept context, prereq chain, gaps. |
| ``retrieved_chunks`` | 2000 | Empty until RetrievalRouter is wired. |
| ``history`` | 3000 | Last N turns + summary. |
| ``examples`` | 1400 | Few-shot examples. |
| **Total** | **~9600** | Conservative baseline. |

### Deep source expansion

When ``deep_source=True`` is passed to
``build_seed_context`` (or set on the constructor), two slots
expand by ``_DEEP_SOURCE_MULTIPLIER = 4``:

* ``retrieved_chunks``: 2000 → 8000 tokens
* ``history``: 3000 → 12000 tokens

The other seven slots are unchanged — the system prompt, task
intent, tools, and graph context are still capped. This keeps the
"context selection is precise" property of the practice loop
intact, while letting the long-context slots scale for the
research / synthesis path.

### When deep_source is valid

The ``INGESTION_HARNESS_CONFIG`` and the synthesis workflow
templates (``SOURCE_SYNTHESIS``, ``LONG_RESEARCH``) set
``deep_source=True``. All other agent roles (Tutor, Workflow,
Session Summary, Eval) set ``deep_source=False``. This is the
operational commitment — agent code is not allowed to set
``deep_source=True`` outside these contexts.

### Per-call vs constructor

The constructor argument sets a default; the per-call argument to
``build_seed_context`` overrides it. This is the resolution for
C-H3 — the same ``DefaultContextGate`` instance can serve a Tutor
Agent (deep_source=False) and an Ingestion Agent (deep_source=True)
in the same process, depending on which role asks for the context.

### Headroom accounting

At the conservative default (9600 tokens), the model has ~22k
tokens of free headroom under the 30k floor. This is for:

* The model's response (typical 2-4k tokens).
* Tool-call output buffers.
* Logfire-instrumented span payloads (invisible to the model but
  still counted by some providers' pricing).

The headroom shrinks when ``deep_source`` is on (~26k total) and
grows when the dynamic slots are empty (~8k total for a cold-start
session). Operators can read the actual token count from the
``logfire.info("Context Gate assembled {total} tokens …")`` span
that fires after every ``build_seed_context`` call.
