# Implementation Plan — Review-Fix Cycle (2026-06-02)

> Combines findings from `docs/reviews/review.md` (chat-style, frontend-heavy)
> and `docs/reviews/code-review-by-layer.md` (layered, backend-heavy). All
> 29 findings addressed across 15 stacked PRs on `dev`. Replaces the
> archived `docs/implementation-plan-original-2026-05.md`.

## Scope

- 15 phases, each = one stacked PR (`gt create feat/<topic>-N-<layer>` +
  one commit + `gt submit --stack`)
- Foundational feedback loop (TS + Python) in Phase 0
- Backend: memory, harness, context, graph layers
- Frontend: file-size decomposition, store cleanup, type contracts
- Three conflicts identified and re-ordered to fix (see §3)

## Pre-Phase 0 — Skill loading

```bash
cd Practice-tool
pnpm dlx @tanstack/intent@latest list
```

Load per phase as needed:
- `thermo-nuclear-code-quality-review` (every PR)
- `tdd` (every PR; the layered review's §5.4 lists 19 test-coverage gaps)
- `typescript-advanced-types` (Phase 12)
- `tanstack-router-best-practices`, `tanstack-query-best-practices` (Phases 9–12)
- `improve-codebase-architecture` (Phases 9, 11)
- `fastapi` (Phases 3–8, 13)
- `building-pydantic-ai-agents` (Phases 3, 8)
- `logfire-instrumentation` (Phases 3, 4, 8)

## AI runtime decision (carried forward)

Per `docs/adr/0003-ai-runtime-uses-pydantic-ai-first.md`:
- Pydantic AI is the harness runtime
- LiteLLM is a *provider adapter* for legacy paths (currently
  `backend/ingestion-pipeline/{cli,generator}.py` only)
- A central LiteLLM gateway is **deferred** per ADR-0003

**Phase 3 design callout:** when the practice agent is refactored,
decide whether to (a) keep Pydantic AI direct, (b) elevate LiteLLM to
gateway (write new ADR; breaking change to model_router), or
(c) hybrid (Pydantic AI agents + LiteLLM proxy on a port).
The plan as written assumes (a) — the cheaper, ADR-0003-aligned default.

## 1. Re-ordering rationale (3 conflicts in the first-draft plan)

| # | Conflict | Fix |
|---|---|---|
| 1 | `practice_agent.py` touched by 3 first-draft phases (context gate, per-request agent, payload discriminator) | Consolidated payload shapes into Phase 3 (locks the return shape); context gate becomes Phase 6 (touches prompt construction only); per-request agent becomes Phase 8 (touches `Agent(...)` construction only) |
| 2 | `title` → `name` rename coupling (was Phase 4 + Phase 11) | The rename was already done in the original `fe3fb71`. The seed still has `title`; the loader still has `as any`. Phase 5 keeps the alias for one minor version; Phase 11 deletes the cast. No coupling. |
| 3 | `IngestionModal` extracted in Phase 8, rewired in Phase 9 | Phase 9 (decompose) extracts only SourcesColumn / ChatColumn / StudioColumn / NotesPanel — leaves IngestionModal in place. Phase 10 (wire ingestion) extracts IngestionModal *and* wires it in the same PR. One PR owns the file. |

## 2. Dependency graph

```
Phase 0  Foundation (Husky, lint-staged, Prettier, typecheck, ruff, mypy, pytest-cov)
   ↓
Phase 1  Backend: IDs + storage paths
   ↓
Phase 2  Backend: Qdrant resilience + embedding
   ↓
Phase 3  Backend: Practice agent payload shapes (consolidated) ← LOCKS the return shape
   ↓
Phase 4  Backend: Gate wiring (uses Phase 3's stable agent)
   ↓
Phase 5  Backend: /customize + /run (uses Phase 4's gates; seed alias kept)
   ↓
Phase 6  Backend: Context gate (touches prompt construction only, not agent result)
   ↓
Phase 7  Backend: Graph hardening (independent of agent; uses Phase 1 storage paths)
   ↓
Phase 8  Backend: Ingestion + compaction + model-router cleanup ← NEW ROUTE FOR PHASE 10
   ↓
Phase 9  Frontend: Decompose SourceNotebookScreen (SourcesColumn/ChatColumn/StudioColumn/NotesPanel; leave IngestionModal)
   ↓
Phase 10 Frontend: Wire ingestion (extract IngestionModal + 4 handlers → real mutations)
   ↓
Phase 11 Frontend: Store cleanup (delete artifacts/workflows/domains fields, delete mockData.ts, remove as any)
   ↓
Phase 12 Frontend: Type contracts (EvalGate enum, Difficulty/Scope/Target Literal, ArtifactPayload discriminator)
   ↓
Phase 13 Backend: Template system + tool registry concretes (independent of agent) ← LAST BACKEND
   ↓
Phase 14 Housekeeping (medium/low items) ← SAFE TAIL
   ↓
Phase 15 Verify (read-only)
```

## 3. Phases

### Phase 0 — Feedback Loop Foundation

**Branch:** `feat/foundation-0-feedback-loops`
**Stack:** off `main`
**Files touched:**
- `frontend/package.json` (add `typecheck`, `test:watch`, `lint:fix`, `format`)
- `frontend/.prettierrc.json`
- `frontend/.prettierignore`
- `frontend/eslint.config.js` (extend to add `eslint-config-prettier` last)
- `frontend/.husky/pre-commit`
- `frontend/.lintstagedrc.json`
- `frontend/.husky/_/`
- `backend/pyproject.toml` (add `[tool.ruff]`, `[tool.mypy]`, `[tool.coverage]`)
- `backend/.pre-commit-config.yaml` (ruff, ruff-format, mypy local, pytest-cov)
- `backend/.ruff.toml`
- `backend/.mypy.ini`
- Root `scripts/check.sh` and `Makefile` — `make check` runs everything
- `AGENTS.md` (one paragraph referencing the new loops)
- `frontend/AGENTS.md` (one paragraph)

**Acceptance:**
- `pnpm typecheck` exits 0
- `pnpm test` (vitest run) still passes
- Pre-commit fires; blocks on a TS error or a ruff error
- `cd backend && uv run ruff check .` exits 0
- `cd backend && uv run mypy app/` exits 0
- `cd backend && uv run pytest --cov=app --cov-fail-under=70` exits 0

**Commit:** `chore(foundation): husky + lint-staged + prettier + ruff + mypy + pytest-cov`

### Phase 1 — Backend IDs + storage paths

**Findings:** M-B2, R-2.1
**Branch:** `feat/backend-1-ids-and-storage`
**Files:** `backend/app/api/_ids.py` (NEW); `backend/app/api/{artifacts,practice_exercises,workflows}.py`; `backend/app/storage/workflows_repo.py`; `backend/app/storage/__init__.py`; `backend/app/harness/{temporal_mastery_store,graphiti_mastery_store,qdrant_router}.py`; `backend/tests/{test_ids,test_storage_paths}.py` (NEW)
**Acceptance:** 4 `int(time.time() * 1000)` sites gone; paths start with `backend/data/`; 4+2 new tests pass
**Commit:** `fix(backend): canonical new_id() + storage paths pinned to backend/data/`

### Phase 2 — Backend Qdrant resilience + embedding

**Findings:** M-B1, M-B3, M-H1, M-H2
**Branch:** `feat/backend-2-qdrant-resilience`
**Files:** `backend/app/harness/qdrant_router.py`; `backend/app/config.py`; `backend/tests/test_qdrant_router.py` (NEW); `docs/adr/0002-retrieval-layer-starts-with-qdrant.md`
**Acceptance:** `/healthz` probe; model pinned; pseudo-embedding fallback raises; 5 new tests pass
**Commit:** `fix(backend): qdrant healthz probe + embedding model pin + no-silent-fallback`

### Phase 3 — Backend Practice agent payload shapes (consolidated)

**Findings:** 5.1, 5.2, R-2.3 (parts), R-2.4 (parts), M-H3 deferred to Phase 8
**Branch:** `feat/backend-3-payload-shapes`
**Files:** `backend/app/domain/artifact.py` (NEW — discriminated `PracticePayload`); `backend/app/api/practice_agent.py` (replace `_coerce_problems`, `_pad_problems` with discriminated union); `backend/app/api/_artifact_factory.py` (NEW — `make_artifact`, `append_artifact`); `backend/app/api/_ids.py` (extend with `now_iso_with_ms`); `backend/app/api/{practice_exercises,artifacts}.py` (use factory); `backend/tests/test_artifact_factory.py` (NEW); `backend/tests/test_practice_agent_payload.py` (NEW — 6 tests)
**Acceptance:** `_coerce_problems` and `_pad_problems` gone; union covers all 3 observed shapes; `kind="placeholder"` marker; existing 28 tests still pass; 6+4 new tests pass
**Commit:** `feat(backend): PracticePayload discriminated union + make_artifact helper + now_iso_with_ms`
**AI runtime:** see "AI runtime decision" callout above — Phase 3 is the decision point for Pydantic AI vs LiteLLM gateway.

### Phase 4 — Backend Gate wiring

**Findings:** H-B5, H-H1, H-H2, H-H4, H-H5, H-H6, R-2.5
**Branch:** `feat/backend-4-gate-wiring`
**Files:** `backend/app/api/practice_agent.py` (call `artifact_gate.validate_artifact`); `backend/app/harness/qdrant_router.py` (add `chunk_exists`); `backend/app/harness/eval_gate.py` (add `LocalSandboxRunner` concrete); `backend/app/harness/artifact_gate.py` (hash-based dedup); `backend/app/harness/model_router.py` (add `is_configured` to protocol); `backend/app/api/workflows.py` (use `router.is_configured`); `backend/tests/{test_artifact_gate,test_eval_gate}.py` (NEW); `backend/tests/test_event_emitter.py` (extend)
**Acceptance:** `provider != "test"` consumer check gone; gates called in agent path; 6+4+ subscriber tests pass
**Commit:** `feat(backend): wire artifact_gate + eval_gate + event_emitter into agent path`

### Phase 5 — Backend /customize + /run endpoints

**Findings:** H-B1, H-B2, H-B3, H-B4, X-1, X-2
**Branch:** `feat/backend-5-workflow-routes`
**Files:** `backend/app/api/workflows.py` (NEW routes: `POST /api/workflows/{id}/customize`, real `POST /api/workflows/{id}/run`); `backend/app/storage/workflows_repo.py` (add `customize_workflow`); `backend/app/storage/eval_runs_repo.py` (NEW); `backend/app/api/practice_exercises.py` (log to `eval_runs`); `docs/adr/0008-artifact-workflows-use-structured-templates-with-editable-prompts.md`
**Acceptance:** Live smoke of both endpoints; `eval_runs` rows written; 8 new tests pass
**Commit:** `feat(backend): POST /api/workflows/{id}/customize + real /run dispatch + eval_runs`

### Phase 6 — Backend Context gate wiring

**Findings:** C-B1, C-B2, C-B3, C-H1, C-H2, C-H3, C-H4, C-H5
**Branch:** `feat/backend-6-context-wiring`
**Files:** `backend/app/harness/context_gate.py` (tiktoken, per-call `deep_source`, sentence-boundary cut, log on graph_seed failure, tool descriptions, system_slot_override); `backend/app/harness/tool_registry.py` (add `list_tools_with_descriptions`); `backend/app/api/practice_agent.py` (call `build_seed_context`); `backend/tests/test_context_gate.py` (NEW — 8 tests); `docs/adr/{0006,0007}-...md`
**Acceptance:** 9 slots populated; budget enforced via tiktoken; 8 new tests pass
**Commit:** `feat(backend): context gate — wire 9 slots + tiktoken + per-call deep_source`

### Phase 7 — Backend Graph hardening

**Findings:** G-B1, G-B2, G-B3, G-B4, G-B5, G-H1, G-H2, G-H3, G-H4, M-H6
**Branch:** `feat/backend-7-graph-hardening`
**Files:** `backend/app/harness/kuzu_graph_layer.py` (schema versioning, `created_at` column, in-process fuzzy index, batched Cypher, alias concurrency fix, FK validation, 2-query context, `detect_prerequisite_gaps` traversal); `backend/app/harness/graph_layer.py` (`@runtime_checkable`); `backend/app/harness/context_gate.py` (cache `memories_dir` with mtime invalidation); `backend/tests/test_kuzu_graph_layer.py` (NEW — 12 tests); `backend/tests/test_context_gate_cache.py` (NEW); `docs/adr/0027-...md`
**Acceptance:** 12 new tests pass; `process.extractOne` behind an in-process index
**Commit:** `feat(backend): graph layer — batched cypher + in-process fuzzy index + alias concurrency fix`

### Phase 8 — Backend Ingestion + compaction + model-router cleanup

**Findings:** H-H6, H-H7, H-M1, H-M2, R-2.2, R-2.5
**Branch:** `feat/backend-8-orchestration`
**Files:** `backend/app/api/sources.py` (NEW router — `POST /api/sources/ingest`); `backend/app/harness/ingestion_gate.py` (wire to new route, emit `SourceIngested`); `backend/app/main.py` (lifespan task for `compaction_config.compact_history` every 60s); `backend/app/harness/compaction_config.py` (implement `compact_history`); `backend/app/harness/model_router.py` (`ModelRouteRequest` adds `template_id`, `workflow_id`, `scope`; `route` returns latency/cost); `backend/app/harness/named_configs.py` (add 4 missing agent role configs); `backend/app/api/practice_agent.py` (per-request `_build_agent`); `backend/tests/{test_sources_api,test_model_router,test_named_configs,test_compaction}.py` (NEW/extend)
**Acceptance:** Live `POST /api/sources/ingest` returns 202; lifespan task logs once; 4 new test files pass
**Commit:** `feat(backend): ingestion route + compaction + per-request agent resolution`

### Phase 9 — Frontend Decompose SourceNotebookScreen

**Findings:** R-1.1, R-2.8, R-3.1
**Branch:** `feat/frontend-9-screen-decomposition`
**Files (NEW):** `frontend/src/components/notebook/{SourcesColumn,ChatColumn,StudioColumn,NotesPanel}.tsx`; `frontend/src/components/notebook/ingestTabs.ts`; `frontend/src/components/notebook/ArtifactPayloadView.tsx`; `frontend/src/types/artifactPayload.ts`
**Files (edit):** `frontend/src/components/SourceNotebookScreen.tsx` (refactored — layout container only)
**Note:** leaves `IngestionModal` in `SourceNotebookScreen.tsx` for Phase 10
**Acceptance:** `wc -l ...SourceNotebookScreen.tsx` < 250; existing 5 tests pass; manual smoke of all 5 features
**Commit:** `refactor(frontend): decompose SourceNotebookScreen into SourcesColumn/ChatColumn/StudioColumn/NotesPanel siblings`

### Phase 10 — Frontend Wire ingestion

**Findings:** R-1.2
**Branch:** `feat/frontend-10-ingestion-truth`
**Files (NEW):** `frontend/src/api/sourcesApi.ts`; `frontend/src/components/notebook/IngestionModal.tsx`
**Files (edit):** `frontend/src/queries/queries.ts` (add `sourceQueries.ingest`); `frontend/src/components/notebook/ingestTabs.ts` (handlers call real mutations); `frontend/src/components/SourceNotebookScreen.tsx` (remove IngestionModal inlined)
**Acceptance:** 4 `setTimeout` mock handlers gone; 3 new tests pass; live: drop a PDF, see `SourceIngested` in Logfire within 5s
**Commit:** `feat(frontend): wire ingestion modal to POST /api/sources/ingest`

### Phase 11 — Frontend Store cleanup

**Findings:** R-1.3, R-1.4, R-2.4, R-2.6, R-2.7, R-3.2
**Branch:** `feat/frontend-11-store-cleanup`
**Files (NEW):** `frontend/src/api/workspaceSchemas.ts`; `frontend/tests/workspaceStore.test.ts` (NEW)
**Files (edit):** `frontend/src/stores/workspaceStore.ts` (delete `artifacts`/`workflows`/`domains` fields, delete local helpers, add `updateInTree`, empty initial state); `frontend/src/api/workspaceApi.ts` (split off schemas, route through `fetchJson`); `frontend/src/api/queries.ts` (route problems fetch through `api.getProblems`); `frontend/src/routes/__root.tsx` (remove 4 try/except blocks, remove `as any`); `frontend/src/types/workspaceTypes.ts` (delete — types from `z.infer`)
**Files (delete):** `frontend/src/api/mockData.ts`
**Acceptance:** `grep -rn "INITIAL_DOMAINS\|INITIAL_WORKFLOWS\|INITIAL_ARTIFACTS" frontend/src` = 0; mockData.ts gone; 4 new store tests pass
**Commit:** `refactor(frontend): delete store-level server-data + use canonical helpers + split schemas`

### Phase 12 — Frontend Type contracts

**Findings:** R-2.9, R-3.1, R-3.3, R-3.4, R-3.5
**Branch:** `feat/frontend-12-type-contracts`
**Files (NEW):** `frontend/src/types/options.ts`; `frontend/src/types/workflow.ts`
**Files (edit):** `frontend/src/types/artifactPayload.ts` (refine); `frontend/src/routes/WorkflowEditorScreen.tsx` (`evalGates: EvalGate[]`, options data-driven, extract `WorkflowMetadataCards` + `PromptEditor`); `frontend/src/components/notebook/StudioColumn.tsx`; `frontend/src/components/notebook/ArtifactPayloadView.tsx`; `frontend/tests/workflow-editor.test.ts` (NEW)
**Acceptance:** `grep -n "evalGates >= " frontend/src` = 0; 3 new tests pass
**Commit:** `refactor(frontend): EvalGate enum + Difficulty/Scope/Target Literal types + ArtifactPayload discriminator`

### Phase 13 — Backend Template system + tool registry concretes

**Findings:** H-H3, H-H4, M-H5
**Branch:** `feat/backend-13-template-registry`
**Files:** `backend/app/harness/workflow_template_system.py` (add `CompositeWorkflowTemplate`); `backend/app/harness/tool_registry.py` (add `DefaultToolRegistry`; resolve `tool_registry/` directory question — delete the dir if empty); `backend/app/harness/graphiti_mastery_store.py` (`get_all_concept_ids` reads from Kuzu via `MATCH (n:Entity)`, add cache-invalidation hook on `append_mastery_edge`); `backend/tests/{test_workflow_template_system,test_tool_registry,test_graphiti_cache_invalidation}.py` (NEW)
**Acceptance:** 4+3+2 new tests pass
**Commit:** `feat(backend): concrete workflow template system + tool registry + graphiti cache invalidation`

### Phase 14 — Housekeeping

**Findings:** medium/low from both reviews
**Branch:** `feat/housekeeping-14-misc-cleanups`
**Files:** ~20 small edits; deletes a few stale doc lines
**Acceptance:** All low/medium items closed; `pnpm typecheck`, `uv run pytest`, `uv run mypy`, `uv run ruff` all green
**Commit:** `chore: housekeeping — medium/low cleanup from combined reviews`

### Phase 15 — Verify

**Branch:** `feat/verify-15-final-gates`
**Files:** none (read-only verification; tag `v0.2.0` after merge)
**Checks:**
- `pnpm install && pnpm typecheck && pnpm test && pnpm build`
- `cd backend && uv sync && uv run ruff check . && uv run mypy app/ && uv run pytest --cov=app --cov-fail-under=80`
- Live smoke: `pnpm dev` + `fastapi dev backend/app/main.py`; open `/notebook/...`, run a workflow, see artifact, see `ConceptMasteryUpdated` event in Logfire
- `gt log --stack` shows all 15 branches in a clean linear stack
- `gt submit --stack` opens 15 PRs against `main`
- Update `AGENTS.md` to reference the new skill-set / typecheck loop
**Acceptance:** All 15 PRs green in CI; live smoke demonstrates end-to-end practice gen
**Commit:** `chore(release): v0.2.0 — feedback loops + review-fix cycle landed`

## 4. Sharp edges and mitigations

| Phase | Risk | Mitigation |
|---|---|---|
| 3 (payload shapes) | Stricter parse rejects shapes the LLM produces | Union covers all 3 observed shapes; existing 28 tests pass; manual smoke; 6 new tests |
| 9 (decompose 983 lines) | Feature loss during split | Existing 5 tests pass; manual smoke of all 5 features; 4 new component tests; visual diff |
| 11 (store cleanup) | Empty initial state → first-render flash | Components render "Loading…"; vitest with slow-resolving query mock; `gt restack` re-tests |

## 5. Branching rules (recap from `AGENTS.md` + `docs/adr/0030-...`)

```bash
git checkout main
git pull --rebase
gt create feat/<topic>-N-<layer>   # off main for Phase 0; off the previous branch for Phase 1+
# ... commits ...
gt submit --stack                    # one PR per branch in the stack
gt restack                           # after main moves
gt absorb                            # auto-attribute fixups
```

- No `git commit` shortcuts that skip hooks once Husky is installed in Phase 0
- No force-push, no skipping hooks, no committing secrets

## 6. What NOT to redo (carried-forward decisions)

- The 12 commits on `feat/studio-workflows-integration` (now part of `main`) — do not rewrite
- The README rewrite on `dev` (`10a471a`) — keep as-is
- The repo migration to `Practice-Workspace` — already executed
- `legacy-fork-main` and `revamp-frontend-design` branches on the new remote — keep for reference
- ADR-0003 (Pydantic AI first, LiteLLM gateway deferred) — unless a new ADR elevates it
