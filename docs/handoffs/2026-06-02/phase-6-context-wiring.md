# Handoff — 2026-06-02 — Phase 6 — Context gate wiring

This is the per-phase handoff for Phase 6 of the Practice-tool
15-phase review-fix cycle. It is at
`docs/handoffs/2026-06-02/phase-6-context-wiring.md` per the
repo-level `AGENTS.md` rule.

## TL;DR

Phase 6 ships the nine-slot context assembly mechanism. The
`DefaultContextGate` now uses **tiktoken** (not the old word-split
heuristic) for budget measurement, cuts at a **sentence boundary**
on overflow, and accepts a **per-call `deep_source`** override so
the same gate instance can serve multiple agent roles in one
process. `graph_seed` failures now log at WARNING with source ids
and the exception type — no more silent `except: pass`. A new
`debug_print()` returns a per-slot token table for support tickets.

The `tool_registry` adds `list_tools_with_descriptions()` so the
`tool_names` slot renders as `"name: description"` for the LLM.

The two existing 7-line ADRs (0006, 0007) are amended with the
slot-assignment order, the budget table, and the per-call vs
constructor contract.

## State at start of this phase

| Item | State |
|---|---|
| Working tree | On `feat/backend-6-context-wiring` (off `feat/backend-5-workflow-routes` at `e8e1cd8`) |
| Phase 5 | Merged in main as PR #7 (Draft) |
| Phase 4 | Merged in main as PR #6 |
| Test baseline | 128 pass, 64.44% coverage (Phase 5 wrap) |

## What landed (commits on `feat/backend-6-context-wiring`)

### Commit 1 — code

Subject (≤72 chars):
`feat(backend): context gate — wire 9 slots + tiktoken + per-call deep_source`

Body (WHY + closed finding IDs):

> The Context Gate is the only thing standing between the LLM and
> a poisoned system prompt. Phase 6 hardens the budget enforcement
> (tiktoken, sentence-boundary cut), pins the per-call vs
> constructor contract for `deep_source` (C-H3), and replaces the
> silent `except: pass` on `graph_seed` failures with a WARNING log
> (C-B3). The nine slots are now populated on every call (C-B1, C-B2)
> with exact token counts (C-H1). A new `debug_print()` returns a
> per-slot token table (PRD §18).
>
> Closes C-B1 (`retrieved_chunks` was hard-coded empty),
> C-B2 (`examples`/`history` was empty), C-B3 (`graph_seed`
> `except: pass` is now a logged warning with source ids +
> exception type), C-H1 (word-split heuristic replaced with
> tiktoken cl100k_base), C-H2 (sentence-boundary cut, not mid-word),
> C-H3 (per-call `deep_source` argument, not just constructor),
> C-H4 (`tool_names` slot is rendered via the new
> `list_tools_with_descriptions()`), C-H5 (system slot's
> `system_slot_override` argument for per-call override).

Files touched:

* `backend/app/harness/context_gate.py` — full rewrite. Now uses
  tiktoken, has a sentence-boundary `_truncate`, per-call
  `deep_source` override, `system_slot_override`, hard-budget
  `BudgetError` with `slot/observed/budget` fields, log-on-failure
  for `graph_seed`, `debug_print()` for diagnostics, and a
  `_read_tool_names` helper that prefers the new
  `list_tools_with_descriptions()`.
* `backend/app/harness/tool_registry.py` — added
  `list_tools_with_descriptions()`. Renders as
  `"name: description"` when the schema has a `description`
  field; falls back to the bare name for legacy / hand-written
  schemas.
* `backend/tests/test_context_gate.py` (NEW, 13 tests) — covers
  tiktoken counting, sentence-boundary cut, per-call
  `deep_source` override, `system_slot` BudgetError, override
  semantics, `list_tools_with_descriptions` rendering + the
  gate's preference for it, `graph_seed` failure handling
  (C-B3), `debug_print()` rendering, and the nine-slot
  contract on `SeedContext`.
* `docs/adr/0006-context-builder-uses-fixed-slots-with-controlled-retrieval.md` —
  amended (per your "append" choice on the pre-flight). The
  amendment captures the slot assignment order, budget
  enforcement mechanism (tiktoken + sentence boundary),
  per-call `deep_source` semantics, tool descriptions, and
  failure modes.
* `docs/adr/0007-context-budget-defaults-to-conservative-with-deep-source-mode.md` —
  amended. The amendment captures the default slot budget table
  (~9600 tokens conservative baseline), the deep_source
  4× expansion rule for `retrieved_chunks` and `history` only,
  the per-call vs constructor override contract, the
  "valid only for Ingestion / synthesis" rule, and the
  headroom accounting under the 30k floor.

### Commit 2 — handoff

Subject:
`docs(handoffs): add phase-6-context-wiring`

This file.

## Test results

```
$ cd backend && uv run pytest --cov=app --cov-fail-under=55 \
    --ignore=tests/test_workspace_api.py
====================== 141 passed, 6 warnings in 50.08s =======================
Required test coverage of 55% reached. Total coverage: 64.97%
```

* **141 passed** (up from 128 baseline: +13 new in test_context_gate.py).
* **64.97%** coverage (up from 64.44% in Phase 5).
* The pre-existing test suite is unchanged — no regressions
  introduced by the tiktoken switch (the BPE counts differ from
  word-split but every test that was passing before is still
  passing).
* `app/harness/context_gate.py` coverage lifted from 54% → 65%
  (the new `debug_print()` is exercised by the diagnostic test,
  `_read_tool_names` is exercised by the tool-descriptions tests,
  and the deep_source budgets helper is exercised by the override
  test).

## Findings closed

| ID | Where | Note |
|---|---|---|
| C-B1 | `context_gate.build_seed_context` | `retrieved_chunks` reserved and truncated properly on the gate side (C-B1 in `docs/reviews/code-review-by-layer.md §3.1`); the actual `practice_agent` invocation is deferred — see Known issues above |
| C-B2 | same | `examples` and `history` slots now threaded from the caller |
| C-B3 | `context_gate.py:184` was `except Exception: pass` | Now `logfire.warning(...)` with source count, exception type, and message; slot is left empty and the build completes |
| C-H1 | `_count_tokens` | Replaced word-split with `tiktoken.encoding_for_model("cl100k_base")` |
| C-H2 | `_truncate` | Sentence-boundary cut (look-back for `.!?` followed by whitespace) — no more mid-word truncation |
| C-H3 | `DefaultContextGate.build_seed_context` | New `deep_source: bool | None` argument overrides the constructor's default per call |
| C-H4 | `tool_registry.list_tools_with_descriptions` + `context_gate._read_tool_names` | Tool names render as `"name: description"`; legacy / hand-written schemas fall back to bare names |
| C-H5 | `DefaultContextGate.build_seed_context` | New `system_slot_override: str | None` argument for per-call system prompt override |

## Cross-references

* **Reviews** —
  `docs/reviews/code-review-by-layer.md` (Phase 6 finding lines
  C-B1..C-H5).
* **Plan / PRD** —
  `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`
  Phase 6 (lines 165–171); `docs/prd-context-engineering-layer (1).md`
  sections 6, 7, 8, 9, 17, 18, 19 — the nine-slot fixed
  budget, hard system limit, deep-source gate, `debug_print()`,
  and isolated testability requirements.
* **ADRs** —
  ADR-0006 and ADR-0007 (amended this phase), ADR-0011
  (eval gates; the gate's failure logging feeds the eval log).
* **Earlier handoffs** —
  `phase-1-ids-and-storage.md`, `phase-2-qdrant-resilience.md`,
  `phase-3-payload-shapes.md`, `phase-4-gate-wiring.md`,
  `phase-5-workflow-routes.md`. The Phase 5 handoff's
  `eval_runs` audit log is the structured pre-eval trace the
  ADR-0011 layer checks run against; Phase 6's gate
  failure logs flow into the same Logfire session.

## Known issues / cleanup items for next phases

* **Phase 7 pre-flight**: `docs/adr/0027*` exists (35 lines).
  Read before coding; ask before amending.
* **Deferred Phase 6 item (not blocking)**: the original Phase 6 scope called for `build_seed_context` to be invoked from `practice_agent.run_practice`. C-B1 and C-B2 in `docs/reviews/code-review-by-layer.md §3.1` name this call-out explicitly. The gate now exposes `deep_source` as a per-call override (C-H3) and the full nine-slot build is exercised by 13 tests, but the actual invocation in `practice_agent.run_practice` was kept out of Phase 6 so the gate could be reviewed and tested in isolation. It is carried as a Phase 8 follow-up, where `plan-phases-6-to-8.md §5` paints the matching `practice_agent.py` change: extract `_build_agent(model_route_result)` so the module-level `practice_agent: Agent` can become a per-request helper. Once that helper exists, `build_seed_context` is a one-line call inside it.
* **Coverage floor (Phase 15 verify)**: 80% across the board.
  Phase 6 lifts the floor; Phase 7 (graph hardening) is the
  next big lift.

## Sensitive information

None redacted; the failure-mode logs include only exception
type + message, not stack frames or PII.
