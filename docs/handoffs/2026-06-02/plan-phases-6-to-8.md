# Handoff — 2026-06-02 — Plan for Phases 6 → 7 → 8

This is the plan for the next three phases of the Practice-tool
15-phase review-fix cycle. It is a planning artefact only; the actual
phase commits land in the usual `docs/handoffs/2026-06-02/phase-N-…`
files when each phase ships.

Read order: §1 stack state → §2 pre-flights → §3 phase 6 → §4 phase 7
→ §5 phase 8 → §6 cross-phase consistency → §7 stopping point → §8
your decision needed.

---

## 1. Graphite stack where we are now

```
◯  feat/backend-2-qdrant-resilience    (PR #3 merged)
│  ◯  feat/backend-3-payload-shapes    (PR #4 merged)
│  │  ◯  feat/backend-4-gate-wiring    (PR #5 merged)
│  │  │  ◉  feat/backend-5-workflow-routes   (PR #7 Draft, ready when you are)
│  │  │  │     main (5a57524)
```

Each `gt create` for phases 6/7/8 branches off the **previous phase's
branch** (stacked). If you merge PR #7 between phases, I `gt restack`
and re-target onto the new main. If you don't, the stack stays linear
as 5 → 6 → 7 → 8.

## 2. Pre-flight gates (must run before coding each phase)

| Phase | ADR check | Branch-from | Skills |
|---|---|---|---|
| 6 | `docs/adr/0006*` + `docs/adr/0007*` — both exist as 7-line stubs | `feat/backend-5-workflow-routes` | thermo-nuclear + tdd + **fastapi** + **building-pydantic-ai-agents** |
| 7 | `docs/adr/0027*` — exists as a 35-line stub | `feat/backend-6-context-wiring` | thermo-nuclear + tdd + fastapi + **improve-codebase-architecture** |
| 8 | (none in the plan) | `feat/backend-7-graph-hardening` | thermo-nuclear + tdd + **fastapi** + **building-pydantic-ai-agents** + **logfire-instrumentation** |

**ADR-0006** (7 lines) says: fixed 9-slot context, hard budget on
`system_slot`, soft budgets elsewhere, product contracts
(RetrievalLayer, GraphLayer, MemoryStore, ModelRouter, ToolRegistry).

**ADR-0007** (7 lines) says: 30k–40k token conservative default;
`deep_source` mode expands `retrieved_chunks` + `history` by 4× and is
valid only for Ingestion Agent and synthesis workflows.

**ADR-0027** (35 lines) says: concept nodes have `canonical_name` +
`aliases: list[str]`; fuzzy dedup at threshold (default 85) is a
**constructor parameter**, not an env var. The wrapper does the
matching.

I will **ask** before amending any of these (handoff rule), like
Phase 5's ADR-0008. The plan's intent for each is to extend the
stub with the operational commitments the new code keeps
(slot-assignment order, when `deep_source` is set, threshold
lifecycle).

## 3. Phase 6 — `feat/backend-6-context-wiring`

**Closes**: C-B1, C-B2, C-B3, C-H1, C-H2, C-H3, C-H4, C-H5

**File list**:
- `backend/app/harness/context_gate.py` — replace `_count_tokens`
  word-split with `tiktoken.encoding_for_model(…)`; per-call
  `deep_source` argument; sentence-boundary cut in `_truncate`
  (don't end on a half-word); log on `graph_seed` failure
  (currently `except: pass`); honour `system_slot_override` on the
  protocol; emit `BudgetError` with the **slot name + observed vs
  budget** for diagnostics.
- `backend/app/harness/tool_registry.py` — add
  `list_tools_with_descriptions()` (current API returns only names;
  descriptions ride on the schema, but the gate needs them inline
  to populate `tool_names` in a human-readable form for the prompt).
- `backend/app/api/practice_agent.py` — call `build_seed_context`
  from the agent service (currently the gate is constructed but
  never invoked).
- `backend/tests/test_context_gate.py` (NEW, 8 tests): tiktoken
  budget enforcement, sentence-boundary cut, deep_source
  multiplier, system_slot BudgetError, graph_seed failure log,
  tool descriptions populated.
- `docs/adr/{0006,0007}-...md` — amend with the slot-assignment
  order + per-call `deep_source` semantics.

**Acceptance**: 9 slots populated; budget enforced via tiktoken;
8 new tests pass.

**Commit** (≤72):
`feat(backend): context gate — wire 9 slots + tiktoken + per-call deep_source`

**Maintainability hooks**:
- Token counting behind a single private function — swap
  `tiktoken` ↔ custom counter without touching call sites.
- Slot budget map is a module-level constant; deep_source
  expansion is a multiplication at construction (no per-call
  branching in the hot path).
- `_truncate` re-uses the same tokenizer for its cut heuristic
  — the budget is **exact** in tokens, not a word approximation.
- `graph_seed` failure now logs at `WARNING` with the exception
  type + source ids; no more silent `pass`.

## 4. Phase 7 — `feat/backend-7-graph-hardening`

**Closes**: G-B1, G-B2, G-B3, G-B4, G-B5, G-H1, G-H2, G-H3, G-H4,
M-H6

**File list**:
- `backend/app/harness/kuzu_graph_layer.py` — schema versioning
  (`schema_version` column on Concept nodes); `created_at` column;
  in-process fuzzy index (build once on first use, invalidate on
  alias write); batched Cypher for multi-concept lookups (one
  `MATCH … IN $ids` query instead of N round-trips); alias
  concurrency fix (Kuzu alias arrays are read-modify-write — wrap
  in a DB-level lock or move to a join table); FK validation
  (reject `concept_id`s not present in Concept before
  `update_mastery`); 2-query context fetch (one for nodes, one for
  prereq-chain traversal) instead of 3; `detect_prerequisite_gaps`
  traversal depth-capped at 8 per the existing Protocol contract.
- `backend/app/harness/graph_layer.py` — annotate with
  `@runtime_checkable` so test doubles (`isinstance(x, GraphLayer)`)
  work without inheritance.
- `backend/app/harness/context_gate.py` — cache `memories_dir`
  mtime so re-reads inside one `build_seed_context` call don't
  re-stat the dir.
- `backend/tests/test_kuzu_graph_layer.py` (NEW, 12 tests) —
  covers each finding: schema version write/read, `created_at`
  non-null, fuzzy index hit + miss, batched Cypher fires once
  per call, alias concurrent append serialises, FK rejection,
  2-query context, depth-cap.
- `backend/tests/test_context_gate_cache.py` (NEW) — mtime
  invalidation + same-call short-circuit.
- `docs/adr/0027-...md` — amend to pin the threshold as a
  constructor parameter (already says this; amendment documents
  the in-process index lifecycle and the lock used for alias
  concurrency).

**Acceptance**: 12 new tests pass; `process.extractOne` behind an
in-process index.

**Commit** (≤72):
`feat(backend): graph layer — batched cypher + fuzzy index + alias concurrency fix`

**M-B1 closure** (carried from Phase 0 review):
`kuzu_graph_layer.py:23-45` env-var gate + `logfire.error` on
fallback lands here, not in an earlier phase. The plan explicitly
defers it.

**Maintainability hooks**:
- Fuzzy index is a private `__FuzzyIndex` class — owns its own
  lock, the alias-list source of truth, and the
  `process.extractOne` call. The public
  `extract_and_link_concepts` API stays stable.
- Batched Cypher is one helper,
  `_fetch_concepts_by_ids(ids) -> list[ConceptNode]`, so the 12
  tests can target the helper directly.
- `@runtime_checkable` is one decorator; no behaviour change for
  production code, but doubles the test surface for free.

## 5. Phase 8 — `feat/backend-8-orchestration`

**Closes**: H-H6, H-H7, H-M1, H-M2, R-2.2, R-2.5, C-B1, C-B2 (Phase 6 deferred — `practice_agent` invocation of `build_seed_context`)

**File list**:
- `backend/app/api/sources.py` (NEW router) —
  `POST /api/sources/ingest`, thin handler: validate body, open
  `eval_runs` row, call `ingestion_gate`, emit `SourceIngested`,
  return 202.
- `backend/app/harness/ingestion_gate.py` — wire to the new
  route; emit `SourceIngested` event with the source id and the
  `extract_and_link_concepts` results; status follows the
  `eval_runs` taxonomy (from Phase 5).
- `backend/app/main.py` — register the `sources` router; add a
  `lifespan` task that calls
  `compaction_config.compact_history` every 60s (per ADR-0016,
  async-friendly with `asyncio.create_task`).
- `backend/app/harness/compaction_config.py` — implement
  `compact_history` (read from the SQLite raw-history DB,
  summarise, prune). Currently the file has only the config
  Pydantic model.
- `backend/app/harness/model_router.py` — `ModelRouteRequest`
  adds `template_id`, `workflow_id`, `scope` (the trio the Studio
  passes through); `route` returns
  `ModelRouteResult(latency_ms, cost_estimate, cfg)` so the
  per-request agent can log cost in `eval_runs`.
- `backend/app/harness/named_configs.py` — add the **4 missing
  agent role configs**: `PRACTICE_HARNESS_CONFIG` (used by
  `_run_workflow_for_artifact`), `SOURCE_INGESTION_HARNESS_CONFIG`
  (Phase 8's own), `STUDIO_HARNESS_CONFIG` (Studio's Run-button
  path), `EVALUATOR_HARNESS_CONFIG` (adversarial eval). Each is
  a `HarnessConfig` dataclass; no new logic.
 - `backend/app/api/practice_agent.py` — extract a per-request
   `_build_agent(model_route_result) -> Agent`; the current
   `practice_agent: Agent` is module-level and reused, which is
   exactly the multi-tenant-state-leak R-2.5 warned about.
   The resulting helper is also the place to call
   `context_gate.build_seed_context` before the agent runs,
   closing C-B1/C-B2 deferred from Phase 6 (`phase-6-context-wiring.md`
   Known issues) and reviewed in `docs/reviews/code-review-by-layer.md`
   §3.1.
- `backend/tests/test_sources_api.py` (NEW) — 202 on happy path;
  400 on missing body fields; eval_runs row written with
  `status='succeeded'` and `SourceIngested` event emitted.
- `backend/tests/test_model_router.py` (extend) — `route` returns
  latency/cost; new fields on the request are honoured;
  `is_configured` unchanged.
- `backend/tests/test_named_configs.py` (NEW) — 4 new configs
  have unique `system_prompt`s and the right gate flags; the
  existing 5 configs are unchanged.
- `backend/tests/test_compaction.py` (NEW) — `compact_history`
  trims raw history; respects the `keep_results` /
  `trigger_tokens` config; doesn't drop the latest N entries;
  no-op when under budget.

**Acceptance**: Live `POST /api/sources/ingest` returns 202;
lifespan task logs once on startup; 4 new test files pass.

**Commit** (≤72):
`feat(backend): ingestion route + compaction + per-request agent resolution`

**H-H6 wiring**: Phase 4 only tagged this for traceability. Phase 8
makes `SourceIngested` actually fire from the new route.

**Maintainability hooks**:
- Per-request `_build_agent` is the single place to mutate Agent
  config (instructions, deps_type, output_type, retries). Test
  doubles can patch it once instead of monkey-patching the
  module global.
- `compaction_config.compact_history` is a free function — easy
  to test, no app-state dependency. The lifespan task is the
  only caller.
- `ModelRouteResult` is a frozen Pydantic model so the cost figure
  is immutable in the eval log; no accidental mid-run mutation.

## 6. Cross-phase consistency

- **Commit subjects ≤72 chars** (handoff rule). Subjects above are
  the proposed text; I'll shorten if any come out over once I see
  the actual diff.
- **One logical commit per phase** + **one handoff commit** on
  the same branch (Phase 5's pattern).
- **Pre-commit hook** (ruff format + check) and **pre-push hook**
  (full `pytest --cov=app --cov-fail-under=55
  --ignore=tests/test_workspace_api.py`) are non-skippable per
  `docs/adr/0030` and the Phase 0 setup.
- **No new ruff/mypy errors** in files I touch. Pre-existing
  debt stays in Phase 14.
- **Graphite workflow per the handoff**:
  ```bash
  gt create feat/backend-N-<topic>   # off previous phase's branch
  # ... commits ...
  git push
  gt submit --stack --no-edit
  # If parent PR merged between phases:
  gt restack
  git rebase --onto main <old-base> HEAD
  git push --force-with-lease
  gt submit --stack --no-edit
  ```
- **DO NOT** delete `graphite-base/N` branches (closes the PR —
  the lesson from Phase 