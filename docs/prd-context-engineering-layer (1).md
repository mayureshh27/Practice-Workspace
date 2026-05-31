# PRD: Context Engineering Layer (v1 → v1.1 Upgrade)

## Problem Statement

The current `ContextBuilder` and `HistoryManager` implementation (from `context/builder.py`) is a synchronous, pre-assembly model: all slots — skills, tool schemas, memories, history — are populated at call time and injected as a static block before the LLM sees any of it. This means every hint call sends the full 33.5k token budget regardless of what the problem actually requires, the model attends to irrelevant skill content, exact-token retrieval misses critical signals (error messages, API names, variable names), compaction logic is ~120 lines of custom code that duplicates Anthropic's first-party API primitives, and memory state is lost if the process restarts between sessions.

The Harness cannot be production-ready until its context assembly is dynamic, its retrieval is hybrid, its compaction is delegated to the API, and its memory is file-persisted across the process boundary.

## Solution

Replace the static pre-assembly model with a **seed-and-discover** architecture. `ContextBuilder` produces a minimal seed context (~4k tokens: system + tool names + workflow template + user message). The agent discovers everything else at runtime through typed tool calls: `skill_lookup`, `tool_lookup`, `source_search_semantic`, `source_search_exact`, `memory_read`, `graph_lookup`, `session_history`. Compaction is delegated entirely to `compact_20260112` and `clear_tool_uses_20250919`. Raw session history is persisted to SQLite on every push so it survives compaction.

The `RetrievalLayer` migrates from Chroma dense-only to Qdrant hybrid (BM25 sparse + MiniLM dense + RRF fusion), which is the only retrieval architecture that correctly handles exact-token matches (error messages, function names, quoted lecture text) alongside semantic queries.

## User Stories

1. As a learner requesting a hint, I want the tutor to only load context relevant to my current problem, so that irrelevant source material from other chapters does not pollute the response.
2. As a learner requesting a hint, I want the tutor to find exact matches for error messages in my code, so that "NameError: name 'df' not defined" retrieves the chunk that defines `df` scope rather than a semantically similar but wrong chunk.
3. As a learner, I want the tutor to remember my blind spots and mastery state from previous sessions even after a server restart, so that learning continuity does not depend on process uptime.
4. As a learner in a long session, I want context to be managed automatically without degrading tutor quality, so that a 3-hour session is as good as a 10-minute one.
5. As a learner, I want graph facts about prerequisites (e.g. "dot product requires vector norm") to be available to the tutor, so that hints reference missing prerequisites by name.
6. As a learner, I want workflow-specific instructions to be separate from the tutor persona, so that a "generate exercise" workflow and a "Socratic hint" workflow share the same core rules but have distinct task specs.
7. As a developer, I want the system slot hard limit to remain strictly enforced, so that the tutor persona can never be silently truncated.
8. As a developer, I want deep-source mode to be an explicit boolean gate, so that the ~162k unused context is never accidentally populated by a misconfigured call.
9. As a developer, I want context assembly to be independently testable per slot, so that a retrieval regression does not require re-running the full hint pipeline.
10. As a developer, I want token usage diagnostics available after every build, so that context bloat is visible and attributable to a specific slot.
11. As a developer, I want compaction to preserve blind spots, mastery events, and error patterns verbatim, so that the compaction summary retains pedagogically critical details.
12. As a developer, I want tool schemas stored as files in `tool_registry/` rather than injected JSON, so that changing a tool's schema does not change the token count of the system block.
13. As a developer, I want skill content stored in `.platform/skills/` and loaded on demand, so that adding a new skill file does not increase the cost of unrelated hint calls.
14. As a developer, I want raw session history written to SQLite on every push, so that a post-compaction agent can recover any historical detail via `session_history(session_id)`.
15. As a developer, I want the retrieval contract to accept a `mode` parameter (`semantic | exact | hybrid`), so that callers can choose the right retrieval strategy for their query type.
16. As a developer, I want large source chunks (> 800 tokens) written to temp files with a `file_read(path, lines)` tool, so that the agent can pull sub-sections instead of loading whole chunks.
17. As a developer, I want the `/memories` directory pre-seeded at session start, so that the agent's first tool call reads structured mastery/blind-spot state rather than reconstructing it from events.
18. As an agent working on the repo, I want `ContextBuilder` to have a `debug_print()` that shows actual tokens per slot, so that I can verify budget compliance without running an LLM call.
19. As an agent working on the repo, I want all context assembly components callable in isolation (no side effects), so that I can unit test slot ordering, budget truncation, and hard-limit violations.

## Implementation Decisions

### Module changes

**`ContextBuilder` — modified, not rewritten**
- `set_system(text)`: unchanged. Hard limit, raises `BudgetError` if exceeded. No silent truncation.
- `set_skills(index: dict[str, str])`: changed from full text injection to name→description index only. Descriptions are 1–2 sentences max. Full content via `skill_lookup(tag)` tool.
- `set_tools(names: list[str])`: changed from full JSON schema injection to name list only. Full schemas live in `tool_registry/{name}.json`. Agent calls `tool_lookup(name)` to fetch.
- `set_memory_seed(path: str)`: replaces `set_memories(list[str])`. Takes the path to the `/memories` directory seeded before session start. Agent reads individual files as needed.
- `set_workflow_template(name: str)`: new. Loads template description (not full prompt) from `.platform/workflows/{name}.md`. Full prompt injected only when agent calls `workflow_lookup(name)`.
- `set_graph_seed(triples: list[dict])`: new. 1-hop triples from the current concept only. Budget: 1 500 tok. Not mixed with episodic memories.
- `set_compaction_config(cfg: CompactionConfig)`: new. Configures both API primitives per session.
- `set_examples`, `set_user`: unchanged.
- `deep_source_mode: bool = False`: constructor parameter. When `True`, budget multipliers unlock for ingestion/synthesis workflows. When `False` (default), conservative 30–40k total cap enforced.

**`HistoryManager` — deleted**
All compaction logic replaced by two Anthropic API primitives passed via `CompactionConfig`:
- `clear_tool_uses_20250919`: trigger=30 000 tok, keep=4, clear_at_least=10 000, exclude=["memory", "sandbox_run"]. Frees large tool results from deep history. Lossless for non-referenced outputs.
- `compact_20260112`: trigger=60 000 tok, target=8 000, custom_instruction="preserve: blind spots, mastery level changes, error patterns, code context seen, concept connections made". Haiku-class server-side summary.
- Raw history written to `sessions/{session_id}.sqlite` on every `push()`. Compaction summary references this path so agent can recover any detail.

**`RetrievalLayer` — upgraded, same contract**
- Migrate from Chroma to Qdrant (Qdrant is already the PRD choice per ADR-0002).
- Enable sparse (BM25/SPLADE) + dense (MiniLM) vectors per chunk on ingest.
- Default search: hybrid with RRF fusion (`score = 1/(k + rank_dense) + 1/(k + rank_sparse)`, k=60).
- `source_search` tool gains `mode: Literal["semantic", "exact", "hybrid"] = "hybrid"` and `filters: dict` for domain/subject/chapter/concept.
- `source_search_exact` is a separate named tool exposing BM25-only path for error messages and API names.
- Large chunks (> 800 tokens): written to `tmp/chunks/{chunk_id}.md`. Tool result contains path + first 200 tokens. Agent calls `file_read(path, start_line, end_line)` for sections.

**`MemoryStore` — pre-seed pattern added**
- Session start: write structured markdown files to `/memories/`: `mastery.md` (concept→level map), `blind_spots.md` (detected gaps), `active_sources.md` (currently selected sources), `position.md` (last problem, chapter, topic).
- Agent reads `/memories/` as first tool call. Not injected into system block.
- Agent writes back via `memory_write(file, content)` tool on new blind spot or mastery update. Immediate persist.
- Existing `MemoryEvent` taxonomy unchanged: SourceIngested, ArtifactGenerated, PracticeAttempted, HintRequested, BlindSpotDetected, ConceptMasteryUpdated, SessionSummaryCreated.

**`ToolRegistry` — schema separation**
- Each tool: name, description, and one JSON schema file in `tool_registry/{name}.json`.
- `tool_lookup(name: str) -> dict`: reads schema file, returns as dict. This is the only schema injection path.
- System block (via `set_tools`) contains only the tool name list. ~60 tokens vs ~2 000 tokens previously.

**`WorkflowEngine` — template discovery**
- Workflow templates in `.platform/workflows/{name}.md`. Format: header with name/description, then full prompt + output schema.
- `workflow_lookup(name: str) -> str`: returns full template content. Agent fetches before executing.
- `set_workflow_template(name)` in `ContextBuilder` injects name + description only (2 lines). Full prompt on demand.

**New slot table (9 slots)**

| Position | Slot | Budget (default) | Limit type |
|---|---|---|---|
| Primacy | system | 2 000 | HARD, raises |
| Primacy | workflow_template | 1 000 | soft truncate |
| Primacy | skills index | 500 | soft truncate |
| Primacy | graph seed | 1 500 | soft truncate |
| Primacy | memory seed path | 200 | soft truncate |
| Primacy | tools names | 200 | soft truncate |
| Middle | history tail | 20 000 | managed by API |
| Recency | examples | 2 000 | soft truncate |
| Recency | user | 2 000 | soft truncate |
| **Total** | | **~29 400** | |

Deep-source mode multiplies history, examples, and retrieved chunk budgets by 4× for ingestion/synthesis calls.

**`CompactionConfig` schema**
```python
# Decision encoded from research — not a working demo
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

### Retrieval query routing
The agent chooses retrieval mode per query type:
- Conceptual questions ("explain dot product") → `source_search_semantic`
- Error messages, function names, quoted text → `source_search_exact`
- Most hint calls → `source_search` (hybrid, default)

### build() output shape
`build()` returns a minimal messages list (~4k tokens seed). The agent's tool calls grow the effective context dynamically. `usage()` reports seed tokens + estimated tool-fetched tokens separately.

## Testing Decisions

Tests should target external behavior and contracts. No tests for internal token counting math — only for observable slot output and budget enforcement.

**`ContextBuilder` tests**
- `set_system` over budget → `BudgetError` raised, message includes current token count and char count.
- `set_system` at exactly budget → no error.
- `build()` before `set_user()` → `ValueError`.
- `build()` slot ordering: system is first, user is last, examples immediately precede user.
- `set_skills(index)` injects only name/description pairs, no full text.
- `set_tools(names)` injects only a list of strings, no JSON.
- `deep_source_mode=True` → budget multipliers applied, visible in `usage()`.
- `debug_print()` produces output without side effects.

**`RetrievalLayer` / Qdrant tests**
- Exact token query ("IndexError: list index out of range") retrieves the chunk containing that exact string in top-3.
- Semantic query ("explain matrix multiplication") retrieves conceptually relevant chunks.
- Hybrid mode outperforms either alone on a mixed query set (verified with a golden test set of 20 query/expected-chunk pairs).
- Filter by `domain="robotics"` returns no chunks from `domain="python_basics"`.
- Empty collection returns empty list, not error.
- Chunk > 800 tokens writes temp file; tool result contains path and first 200 tokens.

**`MemoryStore` pre-seed tests**
- Session start writes `mastery.md`, `blind_spots.md`, `active_sources.md`, `position.md` to `/memories/`.
- Each file is valid markdown with expected top-level structure.
- `memory_write(file, content)` persists immediately (readable before session end).
- After process restart, `/memories/` files survive and are re-readable.

**`CompactionConfig` tests**
- `ToolClearConfig` defaults serialize to expected dict.
- `CompactConfig.preserve_instruction` contains "blind spots" and "mastery".
- `raw_history_db` path is written on every `push()` and readable as SQLite.

**`ToolRegistry` tests**
- `tool_lookup("sandbox_run")` returns valid JSON schema dict.
- `tool_lookup("nonexistent")` raises `ToolNotFoundError`.
- System block produced by `set_tools(names)` contains only strings, no JSON.

**Integration test (hint pipeline)**
- Given: one ingested PDF chunk, one mastery state, one problem.
- When: hint pipeline runs end-to-end.
- Then: `HintResponse` is a valid Pydantic model, contains no solution, ends with a question, references student code, cites a source chunk ID.
- Token count of seed context < 6 000 tokens.

Prior art: existing ingestion pipeline tests for stage-isolation pattern; existing `ContextBuilder` `debug_print()` for token counting smoke tests.

## Out of Scope

- DSPy prompt optimization (requires 20+ labeled eval examples, deferred to month 2).
- LangGraph multi-step orchestration (deferred to week 2 tracer bullet).
- CGR³ multi-hop graph traversal (deferred to weeks 3–4 when GraphLayer has sufficient edges).
- Hierarchical 4-level compression (1%/10%/30%/100% age-weighted) — deferred to month 2 after compaction config proves stable.
- Hosted compaction service or cross-session token budget accounting.
- Changing the 7 existing `MemoryEvent` types.
- Replacing `problems.json` compatibility export.

## Further Notes

The critical implementation order is: **delete before adding**. Week 1 must delete `HistoryManager` and add the API compaction config before any new features are layered on. Building new memory and retrieval features on top of the old custom compaction logic creates conflicting state management.

The Chroma → Qdrant migration is justified independently of BM25 because Qdrant is already the PRD's stated retrieval backend (ADR-0002). The BM25 addition is a free benefit of doing the migration correctly rather than a separate feature decision.

The `/memories` pre-seed pattern and the tool-name-only injection are the two changes with the highest token-efficiency return per implementation hour. Both are < 50 lines of new code each and do not require any schema migrations.
