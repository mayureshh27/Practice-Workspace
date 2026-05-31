# Handoff: Harness Engineering — Landscape Analysis and Custom Design

## Purpose

This handoff is for a fresh agent continuing work after the harness engineering deep-dive session. Two major artifacts were produced: a comprehensive harness landscape analysis + first-principles custom harness design document, and a three-variant UI prototype for the Workspace Shell. The next session should implement the harness PRD and ADRs produced here, beginning with tracer bullet 1.

---

## What Happened This Session

1. **Landscape evaluation** — Pulled and synthesised primary sources from the `awesome-harness-engineering` README: Anthropic long-running agents article, Anthropic context engineering article, Manus context engineering post, 12 Factor Agents, Martin Fowler harness engineering, LangChain Terminal Bench improvement article, and others.

2. **First-principles harness design** — Produced a full custom harness design document (see artifact below) covering: the five core harness problems (context rot, doom loops, session amnesia, tool bloat, the evaluation gap), five unique platform requirements not addressed by existing literature (Socratic constraint, causal mastery attribution, source pollution prevention, learning continuity, deterministic blind spot detection), three harness laws, eight harness primitives, three-layer CAR architecture, five agent role configurations, and critical deletion/build ordering rules.

3. **UI prototype** — Built a three-variant React prototype for the Workspace Shell answering "what workspace structure best serves the practice loop?" The prototype shares a PRD-aligned reducer + data model across all variants.

---

## Primary Artifacts From This Session

All in `/mnt/user-data/outputs/` (copy to repo `docs/` before starting):

| File | Contents |
|---|---|
| `harness-engineering-design.md` | Full landscape + custom harness design (Part I–IV) |
| `workspace-prototype.jsx` | 3-variant UI prototype — Variant A (IDE Split), B (Notebook Flow), C (Command Panel) |
| `prd-harness-layer.md` | PRD for the custom harness layer (produced this session) |
| `0013-socratic-gate-enforces-no-leakage-post-generation.md` | ADR |
| `0014-harness-writes-memory-model-never-does.md` | ADR |
| `0015-context-gate-uses-seed-and-discover.md` | ADR |
| `0016-compaction-uses-api-primitives-historymanager-deleted.md` | ADR |
| `0017-retrieval-router-mandates-source-ids-filter.md` | ADR |
| `0018-five-agent-roles-have-distinct-harness-configs.md` | ADR |

---

## Pre-existing Artifacts to Read First

The decisions from this session build on and extend these, which are already in the repo:

- `docs/prd-adaptive-practice-workspace.md`
- `docs/prd-context-engineering-layer.md`
- `docs/prd-memory-layer.md`
- `docs/adr/0001` through `0012`
- `CONTEXT.md` at repo root

---

## Locked Decisions From This Session

### The Three Harness Laws

1. The harness controls what enters the context window. The model never does.
2. The harness writes memory. The model never does.
3. The harness enforces pedagogical constraints post-generation. Prompts alone never do.

### The Eight Primitives (in build order)

1. **Context Gate** — 9-slot fixed budget system, hard system slot, seed-and-discover pattern, deep-source mode as explicit boolean constructor param only.
2. **Memory Seed Protocol** — pre-session materialisation of 4 structured markdown files to `/memories/`; agent reads them as first tool calls, never injection.
3. **Retrieval Router** — `source_ids` mandatory at type level; BM25 sparse + MiniLM dense + RRF hybrid; three named modes (semantic / exact / hybrid); large chunk protocol for >800 token chunks.
4. **Tool Registry** — name-only injection into context (~200 tokens); full JSON schemas served via `tool_lookup(name)` on demand.
5. **Compaction Config** — API primitives only: `clear_tool_uses` + `compact`. HistoryManager deleted before this is added.
6. **Eval Gates** — Socratic Gate (post-generation, every tutor response), Artifact Gate (schema + runability + grounding + duplicate), Ingestion Gate (stage outputs). All three categories run before anything reaches the learner or the event log.
7. **Workflow Template System** — `.platform/workflows/{name}.md` files; name+description injected (~200 tokens); full prompt served via `workflow_lookup(name)`.
8. **Event Emitter** — deterministic write path for 7 typed memory events; mastery rule is pure Python `rules.py`; no LLM writes to the event log; SessionSummaryAgent is the only LLM-assisted event and it returns a Pydantic model that the harness writes.

### Critical Ordering Rules

- **Delete before adding**: HistoryManager must be deleted before CompactionConfig is added.
- **Chroma out before Qdrant in**: both must never coexist.
- **Schema-first**: Pydantic models for all event types and artifact types before the first real event is written.
- **Context Gate before any multi-turn tutor session**.
- **Socratic Gate before any real learner interaction**.

### Five Agent Roles

Each has a distinct harness configuration (detailed in `prd-harness-layer.md`):
- Ingestion Agent
- Hint / Tutor Agent
- Workflow Agent (exercise/lesson generation)
- Session Summary Agent
- Eval Agent

---

## Suggested Next Session Focus

**Tracer Bullet 1 — Source to Practice Artifact** (from ADR-0012 ordering):

1. Define Pydantic models: `SourceRecord`, `Chunk` (with mandatory citation + source_id), `PracticeArtifact`, and the 7 `MemoryEvent` subtypes.
2. Adapt one ingestion path (PDF or uploaded transcript) to emit `SourceIngested` event via Event Emitter.
3. Implement `RetrievalLayer` with Qdrant, BM25 sparse + MiniLM dense, source_ids mandatory filter.
4. Implement `ContextGate` with 9 fixed slots, hard system budget, debug_print().
5. Implement `ArtifactGate` (schema + sandbox runability checks).
6. Generate one `PracticeArtifact`, validate through gate, write to SQLite, export `problems.json` compatibility output.
7. Add Pydantic Evals golden cases covering the above chain.

The tracer bullet is not complete until Pydantic Evals pass for the covered behaviour.

---

## Suggested Skills

- `tdd` — build tracer bullet 1 test-first against the contracts defined in the harness PRD.
- `diagnose` — use only if existing ingestion pipeline code conflicts with the new contracts.
- `improve-codebase-architecture` — use after tracer bullet to identify consolidation opportunities.
- `grill-with-docs` — use if any implementation choice conflicts with the ADRs in `docs/adr/`.

---

## Warnings

- The existing ingestion pipeline points at Chroma. Do not build on it; replace it with Qdrant behind RetrievalLayer per ADR-0002 and ADR-0017.
- The existing `HistoryManager` must be **deleted** before any session management work begins.
- `problems.json` is a compatibility export only. Do not treat it as the internal source of truth.
- The workspace prototype (`workspace-prototype.jsx`) answers the UI layout question; it is not production-ready. The variant decision should be captured in an ADR before the prototype is deleted or folded into the real frontend.
- No API keys or secrets were present in this session.
