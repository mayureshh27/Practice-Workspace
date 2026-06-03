# Handoff — 2026-06-03 — Phase 7 — Graph Hardening

This is the per-phase handoff for Phase 7 of the Practice-tool 15-phase review-fix cycle. It is at `docs/handoffs/2026-06-03/phase-7-graph-hardening.md` per the repo-level `AGENTS.md` rule.

## TL;DR

Phase 7 hardens the Kuzu structural graph layer (`KuzuGraphLayer`) and optimizes Context Gate caching/truncation.

Key items implemented:
1. **Fuzzy Matching Threshold & Index**: Moved the hardcoded `85.0` fuzzy match score threshold to a constructor parameter `fuzzy_threshold`. Added `_FuzzyIndex` to run fuzzy lookups-cache checks synchronously under a thread lock.
2. **Schema Versioning**: Concept table schema versioning with `schema_version` (INT64) and `created_at` (TIMESTAMP).
3. **Alias Write Lock Concurrency**: Instance-level write lock `self._write_lock` serializes writes on read-modify-write.
4. **FK Validation**: Rejects mastery updates for non-existent concepts.
5. **2-Query Context Retrieval**: Replaced single concept query roundtrips with exactly two batched Cypher queries.
6. **Context Gate Caching & Truncation Quality**: Consolidated directory status check (`st.st_mtime`) on `memories_dir`. Prevented budget overflow in `_truncate` by accounting for the marker's token size. Prevented data corruption during history/examples list truncation splits by popping the truncated element and moving the marker.

## State at start of this phase

| Item | State |
|---|---|
| Working tree | On `feat/backend-7-graph-hardening` (off `feat/backend-6-context-wiring` at `1d6d337`) |
| Phase 6 | Stacked below, PR #8 (Updated) |
| Test baseline | 141 pass, 64.69% coverage (Phase 6 wrap) |

## What landed (commits on `feat/backend-7-graph-hardening`)

### Commit 1 — code

Subject:
`feat(backend): graph layer - batched cypher + fuzzy index + alias concurrency fix`

Files touched:
* `backend/app/harness/graph_layer.py` — Added `@runtime_checkable` to GraphLayer.
* `backend/app/harness/kuzu_graph_layer.py` — Schema updates, `_FuzzyIndex`, write lock concurrency serialization, FK mastery validation, 2-query batched concept context fetch.
* `backend/app/harness/context_gate.py` — Cached memories directory mtime, fixed marker-token budget overflow, and fixed list-splitting truncation corruption.
* `backend/tests/test_kuzu_graph_layer.py` (NEW) — 8 tests covering schema versioning, fuzzy index caching, batch query limits, concurrent updates, FK constraints, and depth limits.
* `backend/tests/test_context_gate_cache.py` (NEW) — 2 tests covering mtime invalidation and same-call short-circuiting.
* `docs/adr/0027-concept-node-schema-canonical-name-alias-list.md` — Amended to document the schema changes and versioning.

## Test results

```
$ cd backend && uv run pytest --cov=app --cov-fail-under=55 --ignore=tests/test_workspace_api.py
================= 151 passed, 19 warnings in 73.41s (0:01:13) =================
Required test coverage of 55% reached. Total coverage: 69.21%
```

* **151 passed** (+10 new tests).
* **69.21%** coverage (up from 64.69% in Phase 6).

## Findings closed

| ID | Where | Note |
|---|---|---|
| G-B1 | `kuzu_graph_layer.py:_ensure_schema` | Implemented version checking and schema alterations for `schema_version` and `created_at` migration. |
| G-B2 | `kuzu_graph_layer.py:_FuzzyIndex` | Lazy-initialized in-process fuzzy cache under a thread lock. Invalidated on concept additions or alias updates. |
| G-B4 | `kuzu_graph_layer.py:extract_and_link_concepts` | Instance-level `self._write_lock` serializes updates to prevent race conditions on alias list appends. |
| G-B5 | `kuzu_graph_layer.py:update_mastery` | Added database check ensuring `concept_id` exists in Concept table before mastery edge creation, raising `ValueError` on failure. |
| G-H1 | `kuzu_graph_layer.py:get_concept_context` | Replaced concept iteration roundtrips with exactly two batched Cypher queries. |
| G-H2 | `graph_layer.py` | Added `@runtime_checkable` decorator to the base `GraphLayer` protocol. |
| G-M1 | `kuzu_graph_layer.py` | Added `created_at` timestamp column to Concept nodes matching the canonical ADR-0027 schema. |
| C-H2 | `context_gate.py:_truncate` | Prevents budget overflow by subtracting marker token length from remaining budget prior to decoding. |

## Cross-references

* **Reviews** —
  `docs/reviews/code-review-by-layer.md` (Phase 7 graph findings G-B1..G-H2).
* **Plan / PRD** —
  `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md` Phase 7.
* **ADRs** —
  ADR-0027 (amended this phase to align schema fields).
* **Earlier handoffs** —
  `docs/handoffs/2026-06-02/phase-6-context-wiring.md` (Stacked directly below this phase).

## Known issues / cleanup items for next phases

* **Phase 8 follow-up**: `practice_agent.py` refactoring (the `_build_agent` per-request helper) and wiring `build_seed_context` inside `run_practice`.
