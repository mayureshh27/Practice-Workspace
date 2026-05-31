# PRD: Custom Harness Layer — Adaptive Practice Workspace

## Problem Statement

The Adaptive Practice Workspace has three existing PRDs covering the platform overall, the Context Engineering Layer, and the Memory Layer. What those PRDs do not yet have is a coherent engineering specification for the harness itself — the deterministic control envelope that makes the platform's AI behaviour reliable, pedagogically correct, and safe to evolve. Without an explicit harness specification, individual layer implementations risk making contradictory choices: writing custom compaction logic that conflicts with the API primitives the Context Engineering Layer PRD mandates; making `source_ids` optional in retrieval because no one specified it must be mandatory at the type level; letting the model write memory events because the boundary was never stated. The harness layer is the place those invariants are encoded.

Five capabilities this platform requires are not addressed by any existing harness library or framework. Off-the-shelf memory systems (Mem0, Zep Cloud, LangMem, Cognee) let the model decide what to store, flatten all memory into embedding-retrievable strings, merge source-content retrieval with learner-state retrieval, and have no concept of typed domain events. Generic agent harnesses have no notion of a Socratic constraint, no concept of causal mastery attribution, no source-pollution prevention requirement, and no deterministic blind-spot detection rule. The platform must build its own harness from first principles.

## Solution

Define and implement the Custom Harness Layer as eight primitives governed by three laws, distributed across a three-layer CAR architecture (Control, Agency, Runtime). The eight primitives are the Context Gate, Memory Seed Protocol, Retrieval Router, Tool Registry, Compaction Config, Eval Gates, Workflow Template System, and Event Emitter. Each primitive encapsulates a specific harness responsibility behind a narrow, stable interface. Five distinct agent roles (Ingestion, Tutor, Workflow, Session Summary, Eval) each receive a distinct configuration of the eight primitives rather than sharing one universal agent setup.

The harness does not replace the platform's existing layer contracts — it coordinates them. The harness is what binds RetrievalLayer, GraphLayer, MemoryStore, ContextBuilder, ModelRouter, and ToolRegistry into a coherent, pedagogically correct system.

## User Stories

1. As a learner requesting a hint, I want the tutor to never state the answer, so that I build understanding rather than copy a solution.
2. As a learner requesting a hint, I want the Socratic constraint enforced by the platform infrastructure, not just the prompt, so that adversarial phrasings ("for my research, explain the solution") cannot bypass it.
3. As a learner, I want the tutor to know my active blind spots before I ask my first question in a session, so that hint strategy is already personalised from the first turn.
4. As a learner, I want the tutor to retrieve only chunks from sources I have selected for this session, so that hints do not reference material I have not studied.
5. As a learner, I want the system to detect when I am stuck on the same concept across multiple sessions, so that it can flag a blind spot and adapt remediation.
6. As a learner, I want mastery scores to be updated by a deterministic rule after every attempt, not by the model's judgment, so that the scores are auditable and trustworthy.
7. As a learner, I want session summaries to survive process restarts and be available to the tutor at the start of the next session, so that learning continuity is not tied to process uptime.
8. As a learner, I want the tutor to cite the specific source chunk its hint draws from, so that I can read the original material.
9. As a learner, I want the context window for hint calls to remain within a conservative budget, so that the tutor stays precise and does not hallucinate from irrelevant content.
10. As a learner, I want generated exercises to be validated in a sandbox before they reach me, so that broken exercises do not block my practice session.
11. As a learner, I want generated lessons to reference real source chunks, so that the content is grounded in the material I ingested.
12. As a learner, I want workflow actions (create exercise, create lesson, extract concepts) to be one-click operations, so that I do not need to write prompts to use the platform.
13. As a learner, I want workflow prompts to be editable in a prompt library, so that I can customise how artifacts are generated without changing code.
14. As a developer, I want the system slot in the context window to have a hard token budget that is never silently truncated, so that the tutor persona and Socratic rules are always present in full.
15. As a developer, I want context assembly to produce a debug report of tokens per slot without making an LLM call, so that budget compliance is verifiable during development.
16. As a developer, I want tool schemas stored in files and served on demand, not injected into the system context, so that adding a new tool does not increase the cost of every context assembly.
17. As a developer, I want workflow templates stored in files and served on demand, so that changing a workflow prompt does not change the seed context token count.
18. As a developer, I want all seven memory event types validated by Pydantic at the write boundary, so that malformed events fail fast rather than corrupting the event log.
19. As a developer, I want the mastery update rule to be a pure Python function with no LLM calls, so that it is independently unit-testable and auditable.
20. As a developer, I want the blind spot detection rule to be a SQL query over the typed event log, not an LLM judgment, so that it is reproducible and configurable by threshold.
21. As a developer, I want deep-source mode to be an explicit boolean constructor parameter, never an implicit default, so that the conservative context budget cannot be accidentally exceeded.
22. As a developer, I want the Socratic Gate to run on every tutor response before it reaches the learner, logging leakage events when it fires, so that prompt regressions are caught in the eval suite.
23. As a developer, I want the Artifact Gate to run sandbox execution on every generated exercise before it is stored, so that broken practice code never reaches the learner.
24. As a developer, I want the Ingestion Gate to validate citation metadata on every chunk, so that source grounding is enforced from ingestion rather than at query time.
25. As a developer, I want HistoryManager deleted before CompactionConfig is added, so that two conflicting compaction paths never coexist.
26. As a developer, I want `source_ids` to be a mandatory parameter at the type level in all retrieval calls, not an optional filter, so that source pollution cannot occur through accidental omission.
27. As a developer, I want BM25 sparse search alongside dense vector search in the Retrieval Router, so that exact token queries (error messages, function names) are served correctly.
28. As a developer, I want chunks larger than 800 tokens stored as temp files with only a preview returned in the tool result, so that a single large chunk cannot consume the entire retrieved-source-chunks budget.
29. As a developer, I want the five agent roles (Ingestion, Tutor, Workflow, Session Summary, Eval) to have distinct harness configurations rather than one shared setup, so that each role uses only the primitives it needs.
30. As a developer, I want raw session history written to SQLite on every push, so that the compaction summary is recoverable in full via tool call after the context has been compacted.
31. As a developer, I want JSONL result logs written for every eval run and every Socratic Gate decision, so that prompt and harness changes can be compared against a baseline.
32. As a developer, I want the SessionSummaryAgent to receive a serialised event list and return a Pydantic model that the harness writes, so that the agent is stateless, testable, and cannot write to the event log directly.
33. As an agent working on the repo, I want the eight harness primitives to be independently instantiable and testable with mock dependencies, so that tracer bullets and layer expansion tasks can proceed without building the entire system first.
34. As an agent working on the repo, I want the three harness laws stated explicitly in the codebase, so that any implementation choice that violates them is immediately identifiable.

## Implementation Decisions

### The Three Harness Laws

These are not conventions — they are the design invariants from which every implementation decision below follows.

1. **The harness controls what enters the context window. The model never does.**
2. **The harness writes memory. The model never does.**
3. **The harness enforces pedagogical constraints post-generation. Prompts alone never do.**

### The Eight Primitives

**Primitive 1: Context Gate**

The Context Gate implements nine fixed named slots with hard and soft budget types.

Default slot allocations:

| Position | Slot | Budget | Type |
|---|---|---|---|
| Primacy | system | 2 000 tok | HARD — raises BudgetError, never truncated |
| Primacy | workflow_template | 1 000 tok | soft |
| Primacy | skills_index | 500 tok | soft |
| Primacy | graph_seed | 1 500 tok | soft |
| Primacy | memory_seed_path | 200 tok | soft |
| Primacy | tools_names | 200 tok | soft |
| Middle | history_tail | API-managed | CompactionConfig |
| Recency | examples | 2 000 tok | soft |
| Recency | user_request | 2 000 tok | soft |
| **Total seed** | | **~9 400** | |

The seed context is approximately 9,400 tokens. The agent discovers additional context at runtime via tool calls. The remaining budget (up to ~30–40k in default mode) is consumed by tool-fetched content.

`deep_source_mode=False` is the constructor default. Setting `True` multiplies history and retrieved-chunk budgets by 4×. This parameter is only valid for the Ingestion Agent and synthesis workflows. It must never be set on any tutor-path agent.

`debug_print()` reports actual tokens per slot without making any LLM call. This is a required diagnostic method, not optional.

`set_system()` raises `BudgetError` if the system text exceeds 2,000 tokens — no exceptions, no fallback behaviour.

`set_tools(names: list[str])` injects only the list of tool names, not schemas.

`set_skills(index: dict[str, str])` injects only name→one-sentence description pairs, not full skill content.

`set_workflow_template(name: str)` injects only the template name and two-line description.

`set_memory_seed(path: str)` injects only the filesystem path to the `/memories/` directory.

**Primitive 2: Memory Seed Protocol**

Before each tutor or practice session, the harness materialises four structured markdown files to `/memories/`:

- `mastery.md` — concept_id → canonical_name → current_mastery_score → last_updated table.
- `blind_spots.md` — list of unresolved blind spots with evidence: concept name, failed attempt count, session count, mastery trajectory.
- `active_sources.md` — source_ids and human-readable titles for the session's selected sources.
- `position.md` — last practiced exercise, chapter, topic, session timestamp.

The agent's system prompt specifies that its first tool call must be `memory_read("blind_spots.md")`. This is not a convention; it is a required harness initialisation step that changes what context the agent builds for the rest of the session.

Files are written by the harness at session start and are writable by the agent via `memory_write(file, content)` tool call. They persist across process restarts. They are the durable state bridge between sessions.

**Primitive 3: Retrieval Router**

The Retrieval Router is the implementation of `RetrievalLayer` for the practice loop. It wraps Qdrant hybrid retrieval and exposes three named modes.

`source_ids` is a mandatory parameter at the Python type level in all three modes — not an optional keyword argument with a default. Retrieval without source scoping is a type error, not a runtime warning.

`source_search_semantic(query, source_ids, top_k, filters)` — MiniLM dense vectors. For conceptual questions.

`source_search_exact(query, source_ids, top_k)` — BM25 sparse only. For error messages, function names, quoted text, variable names from student code.

`source_search(query, source_ids, top_k, mode="hybrid")` — RRF fusion: `score = 1/(k + rank_dense) + 1/(k + rank_sparse)` with k=60. Default for all tutor hint calls.

Large chunk protocol: any chunk exceeding 800 tokens is written to `tmp/chunks/{chunk_id}.md`. The tool result returns the chunk_id, the first 200 tokens as preview, and the temp file path. The agent calls `file_read(path, start_line, end_line)` for the sections it needs.

Qdrant collections are indexed at ingestion time with both BM25 sparse vectors and MiniLM dense vectors per chunk. This is a one-time migration decision: enabling sparse vectors on existing collections requires re-indexing all chunks. Do not enable dense-only and plan to add sparse later — add both at initial collection creation.

**Primitive 4: Tool Registry**

Each tool is represented by a name, a one-sentence description stored in the registry index, and a JSON schema file at `tool_registry/{name}.json`.

`tool_lookup(name: str) -> dict` is the only path by which a tool's full schema enters the context window. It reads the schema file and returns the parsed dict. If the tool does not exist, it raises `ToolNotFoundError` — never returns `None`.

The mandatory v1 tool set for the Tutor Agent: `source_search`, `source_search_exact`, `skill_lookup`, `tool_lookup`, `memory_read`, `memory_write`, `graph_lookup`, `session_history`, `file_read`, `sandbox_run`, `workflow_lookup`.

The mandatory v1 tool set for the Workflow Agent adds: `artifact_lookup`, `dedup_check`.

The mandatory v1 tool set for the Ingestion Agent: extractors, `chunker`, `concept_extractor`, `graph_linker`, `validator`, `dedup_checker`.

**Primitive 5: Compaction Config**

`HistoryManager` is deleted entirely before this primitive is implemented. The two systems must never coexist.

Two Anthropic API primitives configured per session:

`clear_tool_uses`: trigger_tokens=30,000, keep_results=4, clear_at_least_tokens=10,000, exclude_tools=["memory_write","sandbox_run"]. Clears large tool results from deep history. Excluded tools are never cleared.

`compact`: trigger_tokens=60,000, target_tokens=8,000, custom_instruction="Preserve: blind spots detected, mastery level changes, error patterns in student code, code context seen, concept connections made. Omit: raw tool outputs, repeated similar chunks, preamble turns."

Raw session history is written to `sessions/{session_id}.sqlite` on every `push()` call before compaction can discard anything. The compact summary references this path. The agent can recover any historical detail via `session_history(session_id)` tool call.

**Primitive 6: Eval Gates**

Three gate categories, each running at a different pipeline stage:

**Socratic Gate** — runs on every tutor response before delivery to the learner. Three binary checks:
- (a) Does the response contain code that would pass the exercise tests if submitted?
- (b) Does the response state the answer directly?
- (c) Does the last sentence end with a question mark?

If (a) or (b) fails: block the response, log a `HintLeakage` event (includes blocked response text, gate failure type, model version, prompt version), sharpen the prompt, regenerate.

If (c) fails alone: inject a trailing question (lower severity — the content is Socratic but the question protocol was not followed).

The gate runs on a separate, faster model call. Its logic is tested independently with a fixture set of known-leaking and known-safe responses.

**Artifact Gate** — runs after exercise or lesson generation, before storage. Four checks:
- Schema validity: Pydantic validation — hard failure, blocks storage.
- Source grounding: do the artifact's cited chunk_ids exist in the active source set? Failure → review queue.
- Exercise runability: does the starter code compile? Do the generated tests pass against the generated solution in the sandbox? Failure → blocks storage.
- Duplicate detection: does an artifact with the same concept_ids and source_ids combination already exist? Match → review queue.

**Ingestion Gate** — runs after each ingestion stage. Checks: chunks carry citation metadata (source_id, chunk_index, page_or_timestamp); concept candidates meet minimum alias resolution requirements; graph facts are well-formed Pydantic models. Failure → blocks source record from being promoted to active status.

**Primitive 7: Workflow Template System**

Templates live at `.platform/workflows/{name}.md`. File format: a header block containing `name`, `description` (2 lines max), `input_source_types`, `context_slots_needed`, `output_schema`, `eval_checks`, `artifact_type`. Below the header: the full prompt text and output schema specification.

The v1 mandatory workflows: `create_exercise`, `create_lesson`, `generate_hint`, `summarise_chapter`, `extract_concepts`, `generate_quiz`, `create_session_summary`.

`workflow_lookup(name: str) -> str` returns the full template content. Injecting the full prompt into every context assembly is not permitted.

Template prompt text is human-editable. The header block (output_schema, eval_checks) is machine-read by the Artifact Gate and must be preserved. Editing the prompt text below the header does not require a code change — it is a configuration change.

**Primitive 8: Event Emitter**

The Event Emitter is the only write path to the SQLite event log. It is called by the practice surface and workflow orchestrator — never by agent tool calls.

Sequence after a learner submits an attempt:
1. Practice surface calls `emitter.emit(PracticeAttempted(...))`.
2. Emitter validates against Pydantic model (hard failure if invalid).
3. Emitter writes to SQLite with full foreign-key attribution.
4. Mastery update rule runs synchronously (pure Python, `rules.py`, no LLM).
5. If mastery changed: `emitter.emit(ConceptMasteryUpdated(...))`.
6. Blind spot detection rule runs asynchronously over event log (SQL, not LLM).
7. If threshold met: `emitter.emit(BlindSpotDetected(...))`.
8. Memory Seed files for the affected concept are updated.

Mastery rule (pure Python, `rules.py`):
```
pass  →  new_score = min(old_score + 0.10, 1.0)
fail  →  new_score = max(old_score - 0.05, 0.0)
```

Blind spot detection rule (SQL over event log):
- Condition: ≥ 3 attempts on the concept across ≥ 3 distinct sessions, most recent attempt did not pass, hint count per attempt is not decreasing.
- Clear (set resolved_at) when ConceptMasteryUpdated sets score ≥ 0.70 for that concept.

`SessionSummaryCreated` is the only event written with LLM assistance. The `SessionSummaryAgent` receives a serialised event list for the session, has no access to MemoryStore or GraphLayer, returns a `SessionSummaryCreated` Pydantic model, and the harness writes it. The agent never writes to the event log directly.

### Five Agent Roles and Their Harness Configurations

| Primitive | Ingestion | Tutor | Workflow | Session Summary | Eval |
|---|---|---|---|---|---|
| Context Gate | deep_source=True, no memory/graph slots | default conservative, no deep_source | default + expanded source_chunks | minimal seed, event list as input | adversarial config |
| Memory Seed | not applicable | full (4 files), blind_spots.md first | reads mastery.md + active_sources.md | not applicable | not applicable |
| Retrieval Router | not applicable | hybrid default, exact for errors, source-scoped | semantic, higher top_k | not applicable | not applicable |
| Tool Registry | extractor tools | tutor tool set | workflow tool set | empty | not applicable |
| Compaction Config | minimal | full (both primitives) | light | not applicable | not applicable |
| Eval Gates | Ingestion Gate + Artifact Gate | Socratic Gate | Artifact Gate | Pydantic validation only | JSONL logs |
| Workflow Templates | ingest_* templates | generate_hint | create_exercise, create_lesson, etc. | create_session_summary | N/A |
| Event Emitter | SourceIngested, ArtifactGenerated | HintRequested | ArtifactGenerated | SessionSummaryCreated (via harness) | read-only |

### Critical Build Ordering

1. Delete `HistoryManager` entirely.
2. Remove Chroma dependency entirely.
3. Define Pydantic models for all 7 event types, all artifact types, `Chunk`, `SourceRecord` before writing any events.
4. Implement Context Gate with 9 slots, hard system budget, and `debug_print()`.
5. Implement Tool Registry with name-only injection.
6. Implement Retrieval Router with mandatory `source_ids` type parameter and BM25+dense at Qdrant collection creation.
7. Implement Event Emitter with mastery rule and blind spot detection rule.
8. Implement Memory Seed Protocol.
9. Implement Compaction Config.
10. Implement Socratic Gate.
11. Implement Artifact Gate.
12. Implement Ingestion Gate.
13. Implement Workflow Template System.

### Relationship to Existing PRDs

This PRD does not supersede the existing three PRDs. It is additive and cross-cutting:

- `prd-adaptive-practice-workspace.md` defines the product shape and layer contracts. The harness implements the coordination of those contracts.
- `prd-context-engineering-layer.md` defines the Context Gate slot table, seed-and-discover pattern, and CompactionConfig schema. This PRD endorses those decisions, generalises them to the five agent roles, and adds the Socratic Gate, Memory Seed Protocol, and Tool Registry as dependencies of ContextBuilder.
- `prd-memory-layer.md` defines the 7 typed events, MemoryStore interface, deterministic mastery rule, and blind spot detection rule. This PRD endorses those decisions and specifies the Event Emitter as the harness write path that enforces Law 2.

### No-issue-tracker Note

The to-prd skill specifies publishing to the project issue tracker with a `ready-for-agent` label. No issue tracker connection is available in this session. Save the PRD file to `docs/prd-harness-layer.md` in the repo and create the GitHub issue manually, or run the skill with issue tracker access in the next session.

## Testing Decisions

Good tests verify external behaviour through the public interface of a module. They do not assert on private method calls, internal token counting math, or implementation-specific SQL queries. If a test breaks because a storage backend changed but the observable behaviour did not, the test is wrong.

**Context Gate tests:**
- `set_system()` at budget → no error; one token over → `BudgetError` with token count in message.
- `build()` before `set_user()` → `ValueError`.
- Slot ordering: system always first, user always last, examples immediately precede user.
- `set_tools(names)` injects only strings, not JSON.
- `set_skills(index)` injects only name/description pairs, no full skill content.
- `deep_source_mode=True` → budget multipliers visible in `usage()`.
- `debug_print()` produces token-per-slot output without any LLM call or side effect.

**Retrieval Router tests:**
- Exact token query ("IndexError: list index out of range") retrieves the chunk containing that string in top-3.
- Semantic query retrieves conceptually relevant chunks.
- Hybrid outperforms either mode alone on a 20-query golden set.
- Filter by `source_ids=["s1"]` returns no chunks from other sources (verified by chunk metadata, not just absence).
- Empty collection → empty list, not error.
- Chunk >800 tokens → temp file written; tool result contains path and first 200 tokens.
- Calling any retrieval function without `source_ids` → `TypeError` at call time.

**Event Emitter tests:**
- Each of the 7 event types validates and is stored; querying by event_type and session_id returns the correct record.
- `PracticeAttempted(passed=True)` → mastery score increases by 0.10, `ConceptMasteryUpdated` emitted.
- `PracticeAttempted(passed=False)` → mastery decreases by 0.05, floor at 0.0.
- 3 failed attempts on same concept across 3 distinct sessions → `BlindSpotDetected` emitted.
- 3 failed attempts in same session → no `BlindSpotDetected`.
- `ConceptMasteryUpdated` crossing 0.70 → matching `BlindSpot.resolved_at` set.
- Model cannot call `record_event()` directly (not exposed via Tool Registry).

**Mastery rule unit tests (pure Python, no LLM):**
- Pass from 0 → 0.10. Pass from 0.95 → 1.0 (floor clamp). Fail from 0.05 → 0.0 (ceiling clamp).

**Socratic Gate tests:**
- Fixture set of 20 known-leaking responses → all blocked.
- Fixture set of 20 known-safe Socratic responses → none blocked.
- Blocked response → `HintLeakage` event written with correct gate_failure_type.
- Response missing final question → question injected, not blocked.

**Artifact Gate tests:**
- Generated exercise with invalid Pydantic model → blocked, not stored.
- Generated exercise with sandbox test failure → blocked, not stored.
- Generated exercise with unresolvable chunk citation → review queue, warning event.
- Duplicate concept_ids + source_ids combination → review queue, duplicate event.

**Tool Registry tests:**
- `tool_lookup("sandbox_run")` → returns valid JSON schema dict.
- `tool_lookup("nonexistent")` → `ToolNotFoundError`.
- System block from `set_tools(names)` contains only strings, no JSON.

**Memory Seed Protocol tests:**
- Session start → all 4 files written to `/memories/`, each valid markdown with expected structure.
- `memory_write(file, content)` → persists immediately, readable before session end.
- After process restart → files survive and are re-readable.

**Integration (hint pipeline):**
- Given: one ingested PDF chunk, one mastery state, one active blind spot, one practice exercise.
- When: hint pipeline runs end-to-end.
- Then: `HintResponse` is a valid Pydantic model, contains no solution code, ends with a question, cites a source chunk_id.
- Seed context token count < 10,000 tokens.
- `HintRequested` event written with correct foreign keys.

Pydantic Evals is the preferred v1 eval runner. JSONL result logs must be written for every eval run. Minimum 5 golden cases per workflow before agents may modify its prompts or contracts.

## Out of Scope

- Hosting, auth, billing, multi-user.
- Building new harness features on top of `HistoryManager` — deletion is a prerequisite.
- Using Chroma alongside Qdrant during migration — parallel operation is not permitted.
- LLM-decided memory writes.
- Deep-source mode for tutor or practice workflows — only valid for Ingestion and synthesis agents.
- LangGraph durable orchestration — deferred until workflow steps need checkpoint/resume.
- DSPy prompt optimisation — deferred until 20+ labelled eval examples exist per workflow.
- Custom workflow builder UI before starter workflows are useful.
- Promptfoo and Langfuse integration — deferred, additive when eval suite is mature.
- Any Socratic Gate relaxation based on the argument that "the model is good at following instructions" — the gate is a permanent pedagogical requirement, not a temporary workaround.

## Further Notes

**The deletion principle is the hardest rule to follow.** Every developer instinct says "keep the old thing working while the new thing is being built." For the harness, this is wrong. `HistoryManager` and the API compaction primitives manage the same state through different mechanisms. Running them simultaneously creates split state, divergent histories, and bugs that are invisible until a session is compacted. Delete first, add second.

**Source pollution is not a retrieval quality problem.** It cannot be fixed by better embeddings or higher top-k. It is a scoping failure: the retrieval call was allowed to search across all sources when it should only have searched across the active source set. Making `source_ids` optional "for convenience during development" is how source pollution enters a codebase permanently. The type system must enforce the constraint.

**The Socratic Gate is a product invariant, not a temporary safety net.** As model instruction-following improves, the gate will fire less often. It will never fire zero times if the platform is used by real learners over time. The gate remains because the pedagogical requirement — the learner must not receive the answer — does not have an expiry date.

**The product asset is the harness.** Models will improve, be replaced, or be swapped behind the ModelRouter. Vector stores and graph backends will be upgraded. The harness — the layer contracts, the eval suite, the workflow templates, the event taxonomy, the context slot architecture — is the durable investment. Every implementation decision should be evaluated by whether it strengthens or weakens the harness's independence from any specific underlying component.
