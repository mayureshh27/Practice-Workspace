# Implementation Plan — Adaptive Practice Workspace

Planned against all 4 PRDs and 30 ADRs. Ordered to respect the Harness PRD's critical build ordering (§Critical Build Ordering), deliver the tracer bullet (Workspace PRD §Agent Work Split) as early as possible, and address every known gap.

---

## Phase 0 — Foundations (Days 1–3)

Write the missing ADR and the missing Layer Contract before touching any other code.

### 0.1 Write ADR-0025

**What:** `docs/adr/0025-graph-layer-five-method-surface-boundary.md`  
**Why:** Referenced in 6 files, enforced in `graph_layer.py:11`, but the file itself is missing. The spike (`graph-layer-spike.md`) was written specifically "prior to writing ADRs 0025–0029."  
**Status quo:** ADR numbering jumps 0024 → 0026. The code implements the 5-method Protocol but the decision record does not exist.  
**Gap closed:** Missing ADR-0025 file.  
**Dependencies:** None.  
**Verification:** `find docs/adr -name "*0025*"` returns a file.

### 0.2 Implement Model Router Contract

**Files to create:**
- `backend/app/harness/model_router.py` — Protocol + concrete implementations
- `backend/app/harness/provider_configs.py` — per-provider adapters
- Update `backend/app/config.py` — add `ModelRouterSettings`
- Update `backend/app/main.py` — wire it into startup

**What:** The Model Router Contract is called out as a mandatory v1 Layer Contract in all 4 PRDs but has zero implementation. Currently models are hardcoded per-agent: `tutor.py` has `"google:gemini-2.5-flash"` hardcoded, `session_summary.py` duplicates the same logic, `ingestion-pipeline/generator.py` has `"ollama/llama3.1"` hardcoded.

**Design (per PRD-adaptive-practice-workspace.md §75–76, §106):**
```python
class ModelRouter(Protocol):
    def route(self, task_type: str, *, task_budget: int | None = None,
              privacy_mode: bool = False) -> ModelConfig: ...

class ModelConfig(BaseModel):
    provider: str          # "google" | "openai" | "ollama" | "anthropic"
    model_name: str        # "gemini-2.5-flash" | "gpt-4o" | ...
    max_tokens: int
    temperature: float = 0.0
    adapter: str | None = None  # optional model-specific prompt adapter
```

**Integration points:**
- `backend/app/config.py`: add `model_router_providers: list[str]`, `model_router_default_task: str`
- `backend/app/agents/tutor.py`: inject `ModelRouter` via `TutorDeps`; `_select_model()` delegates to `router.route("tutor")`
- `backend/app/agents/session_summary.py`: same pattern
- `backend/ingestion-pipeline/generator.py`: same pattern (or accept it as a cross-cutting concern for Phase 4)

**Gap closed:** Missing Model Router Contract — the single largest gap across all PRDs.  
**Dependencies:** None.  
**Verification:** `tutor_agent.run()` with `GOOGLE_API_KEY` unset → falls through router to local `test` model; with key set → uses router-resolved model. Unit test: `router.route("tutor")` returns `ModelConfig` with non-empty fields.

### 0.3 Create file-based tool schemas

**What:** Write JSON schema files for all mandatory v1 tools into `backend/app/harness/tool_registry/`.

**Files to create:**
- `backend/app/harness/tool_registry/source_search.json`
- `backend/app/harness/tool_registry/source_search_exact.json`
- `backend/app/harness/tool_registry/get_concept_context.json`
- `backend/app/harness/tool_registry/memory_read.json`
- `backend/app/harness/tool_registry/memory_write.json`
- `backend/app/harness/tool_registry/skill_lookup.json`
- `backend/app/harness/tool_registry/graph_lookup.json`
- `backend/app/harness/tool_registry/session_history.json`
- `backend/app/harness/tool_registry/file_read.json`
- `backend/app/harness/tool_registry/sandbox_run.json`
- `backend/app/harness/tool_registry/workflow_lookup.json`

**Status quo:** Only 3 exist (`source_search.json`, `source_search_exact.json`, `get_concept_context.json`).  
**Gap closed:** PRD-harness-layer.md §134 (mandatory v1 tool set for Tutor Agent = 11 tools); ADR-0015 (on-demand schemas).  
**Dependencies:** None.  
**Verification:** `FileToolRegistry().list_tool_names()` returns ≥ 11 names.

---

## Phase 1 — Tracer Bullet (Days 4–8)

The Workspace PRD (§95) says: "start with one or two vertical tracer bullets through source ingestion, storage, retrieval, graph updates, workflow execution, UI, and evals."

This phase delivers exactly one: **source-in → chunks in Qdrant → concepts in Kuzu → seed context assembled → tutor responds → memory updated**. Every layer touched, every layer real.

### 1.1 Wire ingestion pipeline → Qdrant

**Files to modify:**
- `backend/ingestion-pipeline/pipeline.py` — after chunking, call `qdrant_router.index_chunks()`
- `backend/ingestion-pipeline/chunker.py` — implement large-chunk protocol (write to `tmp/chunks/{chunk_id}.md`, return file_path)
- `backend/app/harness/qdrant_router.py` — add `index_chunks(chunks: list[Chunk]) -> None` method
- `backend/app/domain/graph.py` or new `backend/app/domain/chunk.py` — add `Chunk` domain model

**Key design decisions:**
- `index_chunks()` creates/uses Qdrant collection with BM25 sparse + MiniLM dense (hybrid index) per ADR-0002 and ADR-0024
- Chunks >800 tokens: preview = first 200 tokens in payload, content written to `tmp/chunks/{chunk_id}.md`, `file_path` in payload
- Add `SentenceTransformer` as optional dependency (falls back to MD5 pseudo-embedding as already implemented)

**Gap closed:** ADR-0023 (large chunk protocol), ADR-0024 (hybrid index at collection creation), PRD-context-engineering-layer.md §64 (Qdrant migration); agent tool stubs in `tutor.py:81-86` become real.

### 1.2 Wire ingestion pipeline → Kuzu

**Files to modify:**
- `backend/ingestion-pipeline/pipeline.py` — after concept extraction, call `graph_layer.extract_and_link_concepts()`
- `backend/ingestion-pipeline/pipeline_stages/` — wire concept candidate extraction to produce `ConceptCandidate` objects

**What changes:** Currently Kuzu nodes exist (schema auto-created in `kuzu_graph_layer.py:43-53`) but no ingestion pipeline populates them. The `_resolve_concept_identity` fuzzy match via RapidFuzz works (`kuzu_graph_layer.py:55-86`) but is never called from a real ingestion flow.

**Gap closed:** ADR-0019 (concept identity resolved at ingestion), ADR-0001 (Kuzu real), PRD-memory-layer.md §198-209 (concept identity resolution).

### 1.3 Wire Context Gate → GraphLayer

**Files to modify:**
- `backend/app/harness/context_gate.py:164` — populate `graph_seed` slot via `graph_layer.get_concept_context()` instead of leaving it `None`
- `backend/app/main.py` — pass `graph_layer` into `DefaultContextGate` constructor

**What changes:** The `graph_seed` slot has been `None` since implementation. The Context Gate already has the dependency pattern; it just needs to call `get_concept_context()` when `graph_layer` is provided.

**Gap closed:** PRD-harness-layer.md §75 (`graph_seed` slot), PRD-context-engineering-layer.md §89-90.

### 1.4 Wire tutor agent tools → real implementations

**Files to modify:**
- `backend/app/agents/tutor.py:69-123` — replace stub returns with calls to `RetrievalRouter` and `GraphLayer`

**What changes:** `source_search`, `source_search_exact`, and `get_concept_context` tools currently return "No source chunks indexed yet" / "Knowledge Graph not yet connected". Replace with actual Dispatch dependency calls.

**Key design:**
- `TutorDeps` gains `retrieval_router: RetrievalRouter` and `graph_layer: GraphLayer` fields
- `source_search()` → `ctx.deps.retrieval_router.source_search(query, source_ids=ctx.deps.source_ids, mode=mode)`
- `source_search_exact()` → same pattern
- `get_concept_context()` → `ctx.deps.graph_layer.get_concept_context(ctx.deps.concept_ids)`

**Gap closed:** PRD-adaptive-practice-workspace.md §15-18 (hints use context), PRD-harness-layer.md §31-35 (Socratic Gate with context).

### 1.5 Write ADR-0016 CompactionConfig

**Files to create:**
- `backend/app/harness/compaction_config.py` — `CompactionConfig`, `ToolClearConfig`, `CompactConfig` Pydantic models
- Update `backend/app/harness/context_gate.py` — accept `CompactionConfig` in constructor

**What changes:** `HistoryManager` was already deleted (confirmed in last session's diff). But `CompactionConfig` was never added. This is a clean gap — nothing to undo, just add.

```python
class ToolClearConfig(BaseModel):
    trigger_tokens: int = 30_000
    keep_results: int = 4
    clear_at_least_tokens: int = 10_000
    exclude_tools: list[str] = ["memory_write", "sandbox_run"]

class CompactConfig(BaseModel):
    trigger_tokens: int = 60_000
    target_tokens: int = 8_000
    preserve_instruction: str = (
        "Preserve: blind spots detected, mastery level changes, "
        "error patterns in student code, code context seen, "
        "concept connections made. Omit: raw tool outputs, "
        "repeated similar chunks, preamble turns."
    )

class CompactionConfig(BaseModel):
    clear: ToolClearConfig = ToolClearConfig()
    compact: CompactConfig = CompactConfig()
    raw_history_db: str  # path to sessions/{session_id}.sqlite
```

**Gap closed:** ADR-0016 — the only ADR marked "not implemented" in the status map.  
**Dependencies:** HistoryManager already deleted (precondition met).  
**Verification:** `pytest tests/` passes.

### 1.6 Wire raw session history to SQLite

**Files to modify:**
- `backend/app/agents/session_service.py` — on every push, write raw history to `sessions/{session_id}.sqlite`
- `backend/app/harness/context_gate.py` — set `raw_history_db` in `CompactionConfig`

**What changes:** Per ADR-0016, raw session history must be persisted before compaction can discard anything.  
**Gap closed:** PRD-context-engineering-layer.md §56; PRD-harness-layer.md §150.

---

## Phase 2 — Remaining Eval Gates (Days 9–10)

### 2.1 Artifact Gate

**Files to create:** `backend/app/harness/artifact_gate.py`  
**Files to modify:**
- `backend/app/harness/eval_gate.py` — add `ArtifactGate` as concrete `EvalGate` implementation
- Update `backend/app/main.py` — wire into startup

**Four checks (PRD-harness-layer.md §167-173):**
1. Schema validity (Pydantic validation)
2. Source grounding (do cited chunk_ids exist in active source set?)
3. Exercise runability (starter code compiles? tests pass against solution in sandbox?)
4. Duplicate detection (same concept_ids + source_ids already exists?)

**Gap closed:** PRD-harness-layer.md §167-173 (Artifact Gate); ADR-0011 (eval gates use Pydantic evals).  
**Dependencies:** Phase 1.1 (Qdrant has chunks to check source grounding).  
**Verification:** Generated exercise with invalid schema → blocked; valid exercise → stored.

### 2.2 Ingestion Gate

**Files to create:** `backend/app/harness/ingestion_gate.py`  
**Files to modify:**
- Update `backend/app/harness/eval_gate.py` — add `IngestionGate` as concrete `EvalGate` implementation
- `backend/ingestion-pipeline/pipeline.py` — run IngestionGate after each stage

**Three checks (PRD-harness-layer.md §173):**
1. Chunks carry citation metadata: `source_id`, `chunk_index`, `page_or_timestamp`
2. Concept candidates meet minimum alias resolution requirements
3. Graph facts are well-formed Pydantic models

**Gap closed:** ADR-0011 (IngestionGate), PRD-harness-layer.md §173.  
**Dependencies:** Phase 1.1 (ingestion pipeline populates chunks/concepts).  
**Verification:** Chunk missing `source_id` → blocks source record from active status.

---

## Phase 3 — Workflow Templates & Remaining Agent Roles (Days 11–14)

### 3.1 Workflow Template System + `.platform/workflows/` files

**Files to create:**
- `.platform/workflows/create_exercise.md`
- `.platform/workflows/create_lesson.md`
- `.platform/workflows/generate_hint.md`
- `.platform/workflows/summarise_chapter.md`
- `.platform/workflows/extract_concepts.md`
- `.platform/workflows/generate_quiz.md`
- `.platform/workflows/create_session_summary.md`
- `backend/app/harness/workflow_template_system.py` — `workflow_lookup(name)`

**What:** Per PRD-harness-layer.md §175-183, templates live at `.platform/workflows/{name}.md` with a header block (machine-readable) and prompt text (human-editable). Currently the domain model for `WorkflowTemplate` exists in `backend/app/domain/workspace.py` but no `.platform/workflows/` files and no `workflow_lookup()` function.

**Gap closed:** ADR-0008 (workflow templates), ADR-0009 (v1 workflow set), PRD-harness-layer.md §175-183.  
**Verification:** `workflow_lookup("create_exercise")` returns full template content.

### 3.2 Implement IngestionAgent

**Files to create:** `backend/app/agents/ingestion_agent.py`  
**Files to modify:** `backend/app/main.py` — register IngestionAgent config

**What:** Per ADR-0018, five agent roles exist but only Tutor and SessionSummary are implemented. IngestionAgent runs the ingestion pipeline with `deep_source=True`, Ingestion Gate, extractor-only Tool Registry, and no memory/graph seed slots in Context Gate.

**Gap closed:** ADR-0018 (IngestionAgent role).  
**Dependencies:** Phase 3.1 (workflow templates for `ingest_pdf`, `ingest_repo`, etc.).

### 3.3 Implement WorkflowAgent

**Files to create:** `backend/app/agents/workflow_agent.py`  
**Files to modify:** `backend/app/main.py` — register WorkflowAgent config

**What:** Runs structured workflows from templates. Tool set adds `artifact_lookup`, `dedup_check`. Artifact Gate active. Default context budget + expanded source_chunks.

**Gap closed:** ADR-0018 (WorkflowAgent role).  
**Dependencies:** Phase 3.1.

### 3.4 Implement EvalAgent

**Files to create:** `backend/app/agents/eval_agent.py`  
**Files to modify:** `backend/app/main.py` — register EvalAgent config

**What:** Adversarial config for red-teaming and regression testing. No Memory Seed, no Retrieval Router. Writes JSONL logs for every eval run.

**Gap closed:** ADR-0018 (EvalAgent role).  
**Dependencies:** Phase 2 (Eval Gates exist).

---

## Phase 4 — Graphiti Temporal Edge Integration (Days 15–16)

### 4.1 Replace in-memory mastery dict with real Graphiti

**Files to modify:**
- `backend/app/harness/kuzu_graph_layer.py` — replace `_temporal_mastery: dict[str, list[dict]]` with Graphiti `add_entity_edge()` calls
- Update `backend/docker-compose.yml` — ensure Graphiti/Memgraph is properly configured alongside Kuzu

**What changes:** Currently `update_mastery()` and `_get_current_mastery()` use a plain Python dict (`kuzu_graph_layer.py:41`, `:147-152`, `:161-186`). This is documented as Gap 2 in `graph-layer-spike.md`. Replace with real Graphiti temporal edge primitives using `add_entity_edge()`:

```python
def update_mastery(self, concept_id, new_score, trigger_event_id, timestamp):
    # Graphiti primitive: add_entity_edge (never add_episode per Gap 5)
    self.graphiti.add_entity_edge(
        source_entity_id=f"concept:{concept_id}",
        edge_type="mastery",
        target_entity_id=f"mastery:{trigger_event_id}",
        attributes={
            "mastery_score": new_score,
            "trigger_event_id": trigger_event_id,
            "recorded_at": timestamp.isoformat(),
            "valid_from": timestamp.isoformat(),
            "valid_to": None,
        }
    )
```

**Gap closed:** ADR-0026 (append-only mastery edges in Graphiti, not dict); Gap 2 in `graph-layer-spike.md`; PRD-memory-layer.md §36-38.  
**Verification:** Point-in-time query for concept returns score that matches expectation from raw event log replay.

### 4.2 Enable point-in-time mastery queries

**Files to modify:** `backend/app/harness/kuzu_graph_layer.py` — implement `_get_mastery_at_time(concept_id, timestamp)`

**What:** After Graphiti edges are real, add the point-in-time filter pattern from `graph-layer-spike.md` §154-157: fetch edges where `recorded_at <= target_timestamp`, then `argmax(recorded_at)`.

**Gap closed:** Gap 2 in `graph-layer-spike.md`.  
**Verification:** `get_concept_context()` with a timestamp from 3 sessions ago returns different (older) scores than current.

---

## Phase 5 — Named Configs & Frontend Wiring (Days 17–20)

### 5.1 Define named `*_HARNESS_CONFIG` constants

**Files to modify:**
- `backend/app/harness/context_gate.py` — add `TUTOR_HARNESS_CONFIG`, `INGESTION_HARNESS_CONFIG`, `WORKFLOW_HARNESS_CONFIG`, `SESSION_SUMMARY_HARNESS_CONFIG`, `EVAL_HARNESS_CONFIG`
- `backend/app/main.py` — use them instead of inline construction

**What:** Per ADR-0018, each agent role should have a distinct configuration of the 8 harness primitives. Currently only one `DefaultContextGate` instance exists in `main.py`.

**Gap closed:** ADR-0018 (named harness configs).  
**Verification:** Each config has correct `deep_source` setting, correct budget multipliers, correct tool set.

### 5.2 Wire frontend panels to live API data

**Files to modify:**
- `frontend/src/components/panels/SourcesPanel.tsx` — replace hardcoded sample data with `source_search` API calls
- `frontend/src/components/panels/ArtifactsPanel.tsx` — replace hardcoded data with `/api/artifacts` calls
- `frontend/src/components/panels/GraphPanel.tsx` — replace hardcoded 7-node graph with `get_concept_context` API data
- `frontend/src/api/queries.ts` — add query hooks as needed

**What:** As noted in the exploration, Sources, Artifacts, and Graph panels currently use hardcoded sample data. With backends now populated (Phase 1), wire them to real API endpoints.

**Gap closed:** PRD-adaptive-practice-workspace.md §22 (Resource Manager, graph view).  
**Dependencies:** Phase 1 (backends populated).

### 5.3 End-to-end eval tests

**Files to create:** `backend/tests/test_tracer_bullet.py`  
**Files to modify:** `backend/tests/conftest.py` — add fixtures for ingested source, Qdrant records, Kuzu concepts

**What:** The golden integration test from the Harness PRD (§308-314):
- Given: one ingested PDF chunk, one mastery state, one active blind spot, one practice exercise
- When: hint pipeline runs end-to-end
- Then: `HintResponse` is valid Pydantic, no solution code, ends with question, cites source chunk_id, seed context < 10,000 tokens

**Gap closed:** PRD-harness-layer.md §308-314; ADR-0011 (Pydantic Evals).  
**Dependencies:** All prior phases.

---

## Dependency Graph

```
Phase 0                  Phase 1                  Phase 2           Phase 3          Phase 4       Phase 5
───────                  ───────                 ───────          ───────          ───────       ───────
0.1 ADR-0025 ──────┐
                   ├── 1.5 CompactionConfig ── (no blockers)
0.2 ModelRouter ───┤
                   │
0.3 Tool schemas ──┤
                   │
                   ├── 1.1 Qdrant wiring ──┐
                   │                       ├── 2.1 ArtifactGate ──┐
                   │                       │                       ├── 3.1 WorkflowTemplates ──┐
                   │                       │                       │                           ├── 3.2 IngestionAgent
                   ├── 1.2 Kuzu wiring ────┤                       │                           ├── 3.3 WorkflowAgent
                   │                       ├── 2.2 IngestionGate ──┤                           └── 3.4 EvalAgent
                   │                       │                       │
                   ├── 1.3 Context→Graph ──┤                       │
                   │                       │                       │
                   ├── 1.4 Agent tools ────┘                       │
                   │                                               │
                   └── 1.6 Raw history ────────────────────────────┘
                                                                     └── 4.1 Graphiti edges ── 4.2 Point-in-time ── 5.3 E2E tests
                                                                     
                                                                     5.1 Named configs ── 5.2 Frontend wiring ── 5.3 E2E tests
```

## Summary of All Gaps Closed

| # | Gap | Phase | ADR/PRD |
|---|-----|-------|---------|
| 1 | ADR-0025 file missing | 0.1 | ADR-0025 |
| 2 | Model Router Contract not implemented | 0.2 | All 4 PRDs |
| 3 | Only 3 tool schemas exist (need 11+) | 0.3 | Harness PRD §134 |
| 4 | Qdrant has no ingestion path; agent tools return stubs | 1.1 | ADR-0002, ADR-0023, ADR-0024 |
| 5 | Kuzu nodes exist but no pipeline populates them | 1.2 | ADR-0019, ADR-0001 |
| 6 | Graph seed slot is always None | 1.3 | Harness PRD §75 |
| 7 | Tutor agent tools return "not indexed yet" stubs | 1.4 | Harness PRD §31-35 |
| 8 | CompactionConfig doesn't exist | 1.5 | ADR-0016 |
| 9 | Raw session history not persisted pre-compaction | 1.6 | ADR-0016 |
| 10 | Artifact Gate not implemented | 2.1 | ADR-0011, Harness PRD §167 |
| 11 | Ingestion Gate not implemented | 2.2 | ADR-0011, Harness PRD §173 |
| 12 | No `.platform/workflows/*.md` files | 3.1 | ADR-0008, ADR-0009 |
| 13 | IngestionAgent not implemented | 3.2 | ADR-0018 |
| 14 | WorkflowAgent not implemented | 3.3 | ADR-0018 |
| 15 | EvalAgent not implemented | 3.4 | ADR-0018 |
| 16 | Mastery stored in dict, not Graphiti temporal edges | 4.1 | ADR-0026 |
| 17 | No point-in-time mastery queries | 4.2 | Spike Gap 2 |
| 18 | No named `*_HARNESS_CONFIG` constants | 5.1 | ADR-0018 |
| 19 | Frontend panels use hardcoded data | 5.2 | Workspace PRD §22 |
| 20 | No end-to-end integration test | 5.3 | Harness PRD §308 |
