# Zoom-Out: PRD Coverage Checker

A automated verification script that checks implementation status across all 4 PRDs.

## Usage

```bash
python dev/verify_prd_coverage.py
```

Exits 0 if all pass. Output shows `[PASS]`/`[FAIL]` per requirement and a summary of gaps.

## What It Checks (~103 requirements)

| PRD | Focus | Coverage |
|---|---|---|
| **PRD 1** | Adaptive Practice Workspace | FastAPI app factory, 8 API routers, frontend panels (Sources/Artifacts/Graph/Context/Tutor/Memory/Inspector), SQLite init, workspace repo, event store, 7 event types, docker-compose |
| **PRD 2** | Context Engineering Layer | DefaultContextGate (9-slot, BudgetError, deep_source, memory_seed), CompactionConfig (ToolClearConfig/CompactConfig), FileToolRegistry (get_tool_schema/list_tool_names), 12 tool schemas, MemorySeed, QdrantRetrievalRouter (index_chunks/search/search_exact), RetrievalRouter Protocol |
| **PRD 3** | Memory Layer | All 7 typed events (EventBase → SourceIngested/ArtifactGenerated/PracticeAttempted/HintRequested/BlindSpotDetected/ConceptMasteryUpdated/SessionSummaryCreated), Event Emitter (mastery +0.10/-0.05, blind spot ≥3 attempts ≥3 sessions, clearing at ≥0.70), materialise_learner_state(), TemporalMasteryStore (get_score_at_time), GraphitiMasteryStore (append_mastery_edge via EntityEdge.save), GraphLayer Protocol, KuzuGraphLayer |
| **PRD 4** | Custom Harness Layer | SeedContext, BudgetError, deep_source default, MemorySeed Protocol, Retrieval Router 3 modes, source_ids mandatory, Tool Registry name-only injection, CompactionConfig, SocraticGate (3 checks), validate_artifact (4 checks), validate_ingestion_stage (3 checks), WorkflowTemplateSystem, 7 workflow templates, Event Emitter, 5 NamedConfigs, ModelRouter Protocol + DefaultModelRouter, 5 agent files |

## Current Gaps (7 items)

1. `debug_print()` missing from `DefaultContextGate` — PRD-required token diagnostic
2. `usage()` missing from `DefaultContextGate` — PRD-required token accounting
3. Named configs not wired into any agent or `main.py` — 5 configs defined but unused
4. Only 1/5 agent roles imported in `main.py`
5. `ingestion-pipeline/` directory missing or no Python files
6. `problems_export.py` missing — PRD-required compatibility export
7. No integration tests — PRD requires `test_tracer_bullet.py` with 16 tests

## Architecture Map

### Harness Primitives (`backend/app/harness/`)
- `context_gate.py` — 9-slot seed context assembly
- `retrieval_router.py` — Protocol interface with mandatory `source_ids`
- `qdrant_router.py` — Qdrant hybrid search (embedded/Docker fallback)
- `tool_registry.py` — Name-only injection, file-backed schemas
- `compaction_config.py` — ToolClearConfig + CompactConfig
- `eval_gate.py` — SocraticGate (code_leak/answer_leak/question-ending)
- `artifact_gate.py` — validate_artifact: schema/grounding/runability/duplicate
- `ingestion_gate.py` — validate_ingestion_stage: citations/concepts/graph_facts
- `event_emitter.py` — Deterministic mastery + blind spot rules
- `memory_seed.py` — materialise_learner_state: 4 Markdown files
- `graph_layer.py` — 5-method Protocol
- `kuzu_graph_layer.py` — Kuzu structural graph, `use_graphiti` flag
- `temporal_mastery_store.py` — SQLite temporal edges
- `graphiti_mastery_store.py` — Graphiti EntityEdge.save() temporal edges
- `model_router.py` — ModelRouter Protocol + DefaultModelRouter
- `named_configs.py` — 5 HarnessConfig constants
- `workflow_template_system.py` — `.platform/workflows/*.md` loader

### Agent Roles (`backend/app/agents/`)
- `tutor.py` — Socratic hint agent
- `ingestion_agent.py` — Deep-source ingestion
- `workflow_agent.py` — Artifact generation
- `session_summary.py` — Session close summarizer
- `eval_agent.py` — Adversarial eval agent

### Frontend (`frontend/src/`)
- `api/workspaceApi.ts` — Zod schemas + React Query hooks
- `components/panels/` — SourcesPanel, ArtifactsPanel, GraphPanel, ContextPanel, TutorPanel, MemoryPanel, InspectorPanel
- `stores/` — workspaceStore (Zustand) + uiStore
- `routes/` — TanStack Router file-based routing

### Backend API (`backend/app/api/`)
- sources, artifacts, concepts, events, mastery, chat, workspace, health

### Events (`backend/app/domain/events.py`)
- `EventBase(SQLModel)` → 7 typed table events

### Layer Contracts
- **MemoryStore** → SQLite typed event log (`event_store.py`)
- **GraphLayer** → Kuzu structural + Graphiti temporal
- **RetrievalLayer** → Qdrant hybrid search
- **ModelRouter** → task-based model routing
- **ToolRegistry** → name-injection, file-backed schemas
