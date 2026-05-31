# Handoff: Current Session

## What was done

### 1. PRD Coverage Verification Tool (`dev/verify_prd_coverage.py`)
A static-analysis script that checks ~103 requirements across all 4 PRDs and reports pass/fail per item plus a summary of gaps.

Run it:
```bash
python dev/verify_prd_coverage.py
```

**Results: 97.1% coverage (100/103 pass)**

True gaps found:
- `debug_print()` missing from `DefaultContextGate` (PRD-required token diagnostic)
- `usage()` missing from `DefaultContextGate` (PRD-required token accounting)
- Named configs (`named_configs.py`) not wired into any agent or `main.py` — 5 configs defined but unused
- Only 1/5 agent roles imported in `main.py`
- `ingestion-pipeline/` directory missing entirely
- `problems_export.py` missing (PRD-required compatibility export)
- 16 integration test functions in `backend/tests/test_tracer_bullet.py` — PRD requirement met

### 2. Zoom-out Reference Doc (`docs/zoomout-prd-coverage-checker.md`)
Standalone reference documenting the coverage checker, architecture map, layer contracts, and all gaps.

### 3. Codebase Self-Review Plan (`dev/codebase_review_plan.md`)
A self-guided review plan with 6 sections: architecture overview, dependency graph analysis, 10 code practice checks (type annotations, broad except, hardcoded strings, import *, print vs logger, Any types, etc.), prioritized file-by-file reading order, quick health checks, and common anti-patterns to look for.

---

## Current Codebase State

### Harness Primitives (`backend/app/harness/`) — 18 .py files
| File | Role |
|---|---|
| `context_gate.py` | 9-slot seed context, BudgetError, deep_source mode, Memory Seed Protocol |
| `retrieval_router.py` | Protocol interface — `source_ids` mandatory at type level |
| `qdrant_router.py` | Qdrant hybrid search, embedded/local Docker fallback |
| `tool_registry.py` | Name-only injection, `get_tool_schema()` reads from `tool_registry/*.json` |
| `compaction_config.py` | `ToolClearConfig` + `CompactConfig` Pydantic models |
| `eval_gate.py` | `SocraticGate` — 3 binary checks (code_leak, answer_leak, question-ending) |
| `artifact_gate.py` | `validate_artifact()` — 4 checks (schema, source grounding, runability, duplicate) |
| `ingestion_gate.py` | `validate_ingestion_stage()` — 3 checks (citations, concepts, graph facts) |
| `event_emitter.py` | Deterministic mastery (+0.10/-0.05) + blind spot detection (>=3 attempts, >=3 sessions, non-decreasing hints) |
| `memory_seed.py` | `materialise_learner_state()` — writes 4 markdown files to /memories/ |
| `graph_layer.py` | 5-method Protocol interface |
| `kuzu_graph_layer.py` | Kuzu structural graph, `use_graphiti=True` flag |
| `temporal_mastery_store.py` | SQLite-backed temporal edges, `get_score_at_time()` |
| `graphiti_mastery_store.py` | Graphiti-backed, uses `EntityEdge.save()` (never `add_episode()`) |
| `model_router.py` | `ModelRouter` Protocol + `DefaultModelRouter` |
| `named_configs.py` | 5 `HarnessConfig` constants (TUTOR/INGESTION/WORKFLOW/SESSION_SUMMARY/EVAL) |
| `workflow_template_system.py` | Loader for `.platform/workflows/*.md` |

### Agent Roles (`backend/app/agents/`) — 7 .py files
- `tutor.py` + `tutor_service.py` — Socratic hint agent
- `session_summary.py` + `session_service.py` — Session close summarizer
- `ingestion_agent.py` — Deep-source ingestion agent
- `workflow_agent.py` — Artifact generation agent
- `eval_agent.py` — Adversarial eval agent

### Backend API (`backend/app/api/`) — 8 routers
- `health.py`, `workspace.py`, `events.py`, `chat.py`, `mastery.py`, `sources.py`, `artifacts.py`, `concepts.py`

### Frontend (`frontend/src/`)
- **Panels** (7): SourcesPanel, ArtifactsPanel, GraphPanel, ContextPanel, TutorPanel, MemoryPanel, InspectorPanel
- **API layer**: `workspaceApi.ts` (Zod schemas + React Query), `queries.ts`
- **Router**: TanStack Router file-based routing under `src/routes/`
- **State**: Zustand stores (`workspaceStore.ts`, `uiStore.ts`)
- **Styling**: Tailwind CSS v4 with custom HSL tokens

### Events (`backend/app/domain/events.py`)
All 7 typed events as SQLModel table classes:
- `EventBase` → `SourceIngested`, `ArtifactGenerated`, `PracticeAttempted`, `HintRequested`, `BlindSpotDetected`, `ConceptMasteryUpdated`, `SessionSummaryCreated`

### Tests (`backend/tests/`) — 8 test files
- `test_tracer_bullet.py` (exists but has 0 test functions — needs implementation)
- `test_agents.py`, `test_event_emitter.py`, `test_event_store.py`, `test_health.py`, `test_logfire.py`, `test_workspace_api.py`

### Workflow Templates (`.platform/workflows/`) — 7
`create_exercise`, `create_lesson`, `create_session_summary`, `extract_concepts`, `generate_hint`, `generate_quiz`, `summarise_chapter`

### Tool Schemas (`backend/app/harness/tool_registry/`) — 12 JSON files
`file_read`, `get_concept_context`, `graph_lookup`, `memory_read`, `memory_write`, `sandbox_run`, `session_history`, `skill_lookup`, `source_search`, `source_search_exact`, `tool_lookup`, `workflow_lookup`

---

## Known Gaps

| # | Gap | PRD | Severity |
|---|---|---|---|
| 1 | `debug_print()` missing from `DefaultContextGate` | Harness, Context | Medium — diagnostic only |
| 2 | `usage()` missing from `DefaultContextGate` | Harness, Context | Medium — diagnostic only |
| 3 | Named configs not wired into any agent or `main.py` | Harness | High — 5 configs unused |
| 4 | Only `ingestion_agent` imported in `main.py` (1/5) | Harness | High — agents unregistered |
| 5 | `ingestion-pipeline/` directory missing | Workspace | High — no source ingestion |
| 6 | `problems_export.py` missing | Workspace | Medium — compatibility export |
| — | `test_tracer_bullet.py` has 16 test functions | Harness | Resolved — PRD met |
| 8 | `DefaultContextGate` uses `build_seed_context()` not fluent `set_*()` | Context | Low — functionally equivalent |
| 9 | Qdrant collection missing sparse BM25 vectors (dense-only) | Context | Medium — PRD requires hybrid |

## ADRs Filed
All 30 ADRs in `docs/adr/` (0001 through 0030) covering:
- Graph Layer boundary (0025)
- Kuzu owns structural, Graphiti owns temporal mastery (0028)
- Concept node schema (0027)
- Mastery stored as Graphiti temporal edges (0026)
- Prerequisite gap configurable threshold (0029)
- Agents must use stacked PRs (0030)
- Retrieval mode per query type (0024)
- Large chunks to temp files (0023)
- Session summary agent receives event list only (0022)
- Context builder read-only from memory store (0021)
- Qdrant for source chunks, SQL for memory events (0020)
- Concept identity resolved at ingestion (0019)
- Five agent roles with distinct harness configs (0018)
- Retrieval router mandates source_ids filter (0017)
- Compaction uses API primitives, HistoryManager deleted (0016)
- Context gate uses seed-and-discover (0015)
- Harness writes memory, model never does (0014)
- Socratic gate post-generation (0013)
- Earlier ADRs 0001-0012 (Graphiti/Qdrant/Pydantic AI/ingestion/etc.)

## Key Design Decisions
- `GraphitiMasteryStore` uses `EntityEdge.save()` directly, never `add_episode()` (ADR-0028)
- `TemporalMasteryStore` is SQLite fallback; Graphiti is production path
- ContextGate takes `graph_layer` and `tool_registry` as constructor deps; no direct DB access
- Event Emitter is the only write path to the event log (ADR-0014)
- `materialise_learner_state()` in `memory_seed.py` writes 4 MD files for Memory Seed Protocol
- Tool schemas live as JSON files in `tool_registry/`, never injected into system block
- Workflow templates live as MD files in `.platform/workflows/`, name-only in seed context
