# Handoff: Context Engineering Layer — Ready for Development

## Purpose of next session

Implement the Context Engineering Layer upgrade described in `prd-context-engineering-layer.md`. The research and architecture phases are complete. No further reading or design work is needed. Build.

## What was decided (summary)

Over the course of this conversation, the context engineering architecture for the Adaptive Practice Workspace was researched, stress-tested against seven sources (Anthropic engineering blog, promptingguide.ai, Anthropic Cookbook tool-use, Anthropic Memory Cookbook, Cursor dynamic context discovery blog, cursor.directory agent skills, Medium advanced context engineering), and upgraded from the baseline `context/builder.py` handoff.

The five concrete decisions that came out of that research:

1. **Delete `HistoryManager`.** Replace with `compact_20260112` + `clear_tool_uses_20250919` API primitives via a `CompactionConfig` Pydantic model. Raw history persists to `sessions/{session_id}.sqlite` on every push. ~120 lines deleted, ~40 lines added.

2. **Static → dynamic injection for tools and skills.** `set_tools()` takes a name list only. `set_skills()` takes a name→description index only. Full schemas and full skill text are fetched at runtime via `tool_lookup(name)` and `skill_lookup(tag)` tools reading from `tool_registry/` and `.platform/skills/`. Cursor's A/B test showed 46.9% token reduction from this change alone.

3. **Migrate Chroma → Qdrant with hybrid retrieval.** Qdrant is already the PRD's stated backend (ADR-0002). Enable BM25 sparse + MiniLM dense + RRF fusion on ingest. Add `source_search_exact` as a distinct named tool for error messages and API names. Large chunks (> 800 tok) write to temp files; agent reads sub-sections via `file_read`.

4. **`/memories` pre-seed pattern.** Session start writes `mastery.md`, `blind_spots.md`, `active_sources.md`, `position.md` to `/memories/`. Agent reads these as first tool call. Not injected into system block. `memory_write(file, content)` for in-session updates. Survives process restarts.

5. **9-slot `ContextBuilder`.** Two new slots: `workflow_template` (name+description only, 1 000 tok) and `graph_seed` (1-hop triples, 1 500 tok). `memories` slot replaced by `memory_seed_path`. Total seed budget ~4k tokens vs former 33.5k.

## Current state of the codebase (as of handoff)

- `context/builder.py`: the baseline implementation. Has the 7-slot `ContextBuilder` class and `HistoryManager`. Both need modification/deletion as per the PRD.
- `context/` module is the implementation target for this PRD.
- `prd-adaptive-practice-workspace.md`: the parent PRD (uploaded by user). The context engineering work is a subsystem of this. Layer Contracts defined there stand.
- ADR files in project root (`0001` through `0012`): read these before touching any component. Especially `0002` (Qdrant), `0003` (Pydantic AI), `0006` (context builder), `0007` (conservative budget), `0011` (eval gates).
- No live running code yet — this is greenfield implementation against the contracts.

## Build sequence (strict order)

**Week 1 — foundation (delete and replace)**
1. Delete `HistoryManager` class from `context/builder.py`.
2. Add `CompactionConfig` Pydantic model with `ToolClearConfig` and `CompactConfig` sub-models (schemas in PRD).
3. Add `raw_history_db` SQLite write on session push.
4. Change `set_tools(schemas: list[dict])` → `set_tools(names: list[str])`. Create `tool_registry/` dir. Move all schemas to individual JSON files.
5. Add `tool_lookup(name: str)` tool reading from `tool_registry/`.
6. Change `set_skills(text: str)` → `set_skills(index: dict[str, str])`. Descriptions only.
7. Add `skill_lookup(tag: str)` tool reading from `.platform/skills/`.
8. Add large-chunk temp-file write in `RetrievalLayer`. Add `file_read(path, start_line, end_line)` tool.
9. Write tests for all of the above before proceeding.

**Week 2 — memory and retrieval**
1. Add `/memories` pre-seed writer on session start (4 files).
2. Change `set_memories()` → `set_memory_seed(path: str)`.
3. Add `memory_write(file, content)` tool.
4. Migrate `RetrievalLayer` from Chroma to Qdrant. Enable sparse + dense on ingest.
5. Add RRF fusion to `source_search`. Add `source_search_exact` tool.
6. Add domain/subject/chapter/concept filters to all search tools.
7. Add `set_workflow_template(name: str)` to `ContextBuilder`. Add `workflow_lookup(name: str)` tool.
8. Add `set_graph_seed(triples: list[dict])` to `ContextBuilder`.
9. Write integration test: hint pipeline seed < 6 000 tokens end-to-end.

**Weeks 3–4 — graph and workflow layer**
See parent PRD for GraphLayer and WorkflowEngine implementation. These depend on week 1–2 foundations being stable and tested.

## What to read before coding

- `prd-context-engineering-layer.md` (the output PRD from this session) — implementation decisions section has the exact slot table, `CompactionConfig` schema, and retrieval routing rules.
- `prd-adaptive-practice-workspace.md` — parent PRD, especially the Deep Modules and Layer Contracts sections.
- ADR-0002 (Qdrant), ADR-0006 (context builder fixed slots), ADR-0007 (conservative budget) — these constrain the implementation.
- `context/builder.py` — the baseline to modify, not replace from scratch. Keep the fluent interface, keep `BudgetError`, keep `ContextUsage`, keep `debug_print()`.

## What NOT to research further

The context engineering knowledge base is complete for this project. Do not read more blogs, articles, or watch talks before starting implementation. The five decisions above are sufficient. All remaining unknowns are implementation details that code and tests will resolve faster than more research.

Specifically: do not investigate DSPy, LangGraph, LlamaIndex, LangChain, CGR³ multi-hop, or hierarchical compression before having working week 1 code. These are deferred in the PRD.

## Key invariants to never break

- `set_system()` hard limit is sacred. `BudgetError` must always raise. Never swallow it.
- `set_user()` output must always be the last message in `build()`. No exceptions.
- `deep_source_mode=False` is the default. Large context requires explicit opt-in at the call site.
- Tool schemas never appear in the system block. Only names.
- `memory_write` and `sandbox_run` tool results must be excluded from `clear_tool_uses` clearing.
- `debug_print()` must work after `build()` without side effects.

## Suggested skills

- `/prototype` — useful for testing `ContextBuilder` slot behaviour before wiring to a real LLM call.
- `/to-prd` — if scope expands during implementation (e.g. GraphLayer needs its own PRD), use this to capture the new slice.
- `/handoff` — run at end of week 1 to pass to the week 2 agent with current implementation state.
