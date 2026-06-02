# Code Review by Layer

> Thermo-nuclear review of the entire `Practice-Workspace` repo, reorganised by
> the four backend layers the project actually owns. Every finding cites the
> ADRs and PRDs it touches, so this doc doubles as a traceability matrix.

| Layer | Concrete modules | Primary ADR | Primary PRD |
|---|---|---|---|
| Memory | `qdrant_router.py`, `graphiti_mastery_store.py`, `temporal_mastery_store.py`, `memory_seed/` | ADR-0001, ADR-0002, ADR-0020, ADR-0026 | `prd-memory-layer.md` |
| Harness | `model_router.py`, `artifact_gate.py`, `eval_gate.py`, `workflow_template_system.py`, `tool_registry.py`, `event_emitter.py`, `named_configs.py`, `ingestion_gate.py`, `compaction_config.py` | ADR-0003, ADR-0008, ADR-0011, ADR-0014, ADR-0016, ADR-0018, ADR-0021, ADR-0022 | `prd-harness-layer.md` |
| Context | `context_gate.py` | ADR-0006, ADR-0007, ADR-0015, ADR-0021, ADR-0023 | `prd-context-engineering-layer.md` |
| Graph | `graph_layer.py`, `kuzu_graph_layer.py`, `graphiti_mastery_store.py` (temporal edge path) | ADR-0001, ADR-0025, ADR-0026, ADR-0027, ADR-0028, ADR-0029 | `prd-harness-layer.md` §graph |

---

## 0. Verdict up front

- **5 blockers** that will fail an end-to-end smoke (Studio → workflow run →
  artifact write → mastery update).
- **12 high-severity** issues that pass smoke but violate layer contracts,
  bypass ADRs, or have no tests.
- **19 medium / low** issues — naming, dead code, doc drift.

The backend harness is well-decomposed at the *file* level but not yet wired
end-to-end. The frontend was last verified against a stub backend (`Session
2026-06-02`); the new generation endpoints, the `customize` fork, the
`practice_exercise` scope, and the Graphiti mastery path are all unsmoked.

---

## 1. Memory Layer

Files: `backend/app/harness/qdrant_router.py`, `temporal_mastery_store.py`,
`graphiti_mastery_store.py`, `backend/data/memories/*.md`, plus the Qdrant
collection schema.

### 1.1 Blockers

**M-B1. Two temporal mastery stores, one ADR.** ADR-0026 mandates
`GraphitiMasteryStore`. The default `KuzuGraphLayer.__init__` constructs
`TemporalMasteryStore` when `use_graphiti=False` (line 76), which is the
shipped default. `_default_mastery_store` (line 23) does a *runtime* smoke
test and silently falls back. The result: production-shape behaviour is
path-dependent on whether `graphiti-core` imports cleanly. The fallback path
is undocumented in the PRD.
- Fix: gate on an explicit `MASTERY_STORE_BACKEND` env var and log a
  `logfire.error` (not `.info`) on fallback.
- File: `backend/app/harness/kuzu_graph_layer.py:23-45`.
- PRD gap: `prd-memory-layer.md` does not enumerate the fallback.

**M-B2. Mastery store can write to `storage/mastery.db` outside the workspace.**
`TemporalMasteryStore.__init__` (line 39) takes a relative path default.
`graphiti_mastery_store.py:55-58` takes a relative path default. These resolve
to wherever the uvicorn process was started, not `backend/data/`. The
`.gitignore` ignores `backend/data/` so they will never be committed, but
they will also never appear in a `git status` when the user runs `fastapi dev`
from the wrong directory.
- Fix: resolve to `Path(__file__).resolve().parent.parent.parent / "data" / ...`.
- ADR-0001 / CONTEXT.md require storage in `backend/data/`.

**M-B3. Qdrant docker detection is a single-port TCP probe (line 38-45).**
`_is_docker_running` returns True for *any* service listening on 6333, not
just Qdrant. With port 6333 reused by a different container, the router will
silently use a non-Qdrant client and the `.create_collection` call will
throw — but only on first run, after which the `pass` in `_ensure_collection`
(line 60) hides it.
- Fix: call `/healthz` on the Qdrant HTTP endpoint, not raw socket.
- ADR-0002 mandates Qdrant; the fallback to local disk is silently accepted
  even when a misconfigured Qdrant is reachable.

### 1.2 High

**M-H1. Embedding model loads from a hard-coded HF id with no version pin.**
`qdrant_router.py:65` calls `SentenceTransformer('all-MiniLM-L6-v2')`. The
first index uses a fresh download; subsequent uses depend on the HF cache.
With a different model version the 384-dim collection would still work but
embeddings would be semantically misaligned. Pin to a commit hash, or — at
minimum — to a local `models/embeddings/` directory.
- ADR-0002: "BM25 + MiniLM dense + RRF fusion" but no model id is
  documented.

**M-H2. Pseudo-embedding fallback writes garbage vectors into Qdrant.**
`qdrant_router.py:68-74` returns 384 `md5`-derived floats in `[-1, 1]` when
`sentence-transformers` is not installed. The fallback is also
non-deterministic across the run because the dict-iteration order of
`f"{text}-{i}"` is fixed but `hashlib.md5` is process-stable only. Worse, the
collection is `cosine`-distance, so the fallback vectors will still be
indexed (line 152) and will outrank real embeddings only when text overlap
is high.
- Fix: refuse to index if embeddings cannot be computed, and surface a
  `RuntimeError` to the caller.

**M-H3. `qdrant_router.source_search_exact` does not do BM25.**
The method is named *exact* and the ADR-0017 contract implies token-level
retrieval, but the implementation (line 256-308) is a `client.scroll` with
a Python-level substring check against the first-200-token preview. It will
miss any token beyond the 200-token window, and it ignores case and
punctuation inconsistently. There is no BM25 sparse index, no RRF fusion,
despite CONTEXT.md promising "hybrid" as the default mode.
- ADR-0017, ADR-0024 both name this exact path.

**M-H4. `GraphitiMasteryStore` uses a per-instance event loop, not FastAPI's.**
`graphiti_mastery_store.py:68-72` creates a fresh `asyncio.new_event_loop()`
in `_run_async`. The first call after a process restart initialises the
loop; the second call reuses it. If the FastAPI event loop later awaits
`asyncio.to_thread(store.append_mastery_edge, ...)`, the call crosses loop
boundaries, which Graphiti's driver may not support.
- Fix: run the async call on the FastAPI event loop using
  `asyncio.run_coroutine_threadsafe` or migrate the store to `async def`.

**M-H5. `GraphitiMasteryStore.get_all_concept_ids` returns the in-memory
cache, not the persisted nodes.** Line 279-283. If a different process
writes to the same Kuzu directory, this method will not see them. Cache is
per-instance only; nothing invalidates it on writes.
- ADR-0026 says the store is "append-only and point-in-time queryable"; the
  cache breaks the "queryable" part across processes.

**M-H6. Memory Seed files are loaded at every `build_seed_context` call.**
`context_gate.py:224-236` re-reads the four files on every call. With
`deep_source` enabled, that's a hot path. The PRD calls these
"control-plane" files (CONTEXT.md), so cache invalidation matters.

### 1.3 Medium / Low

- `qdrant_router.list_sources` (line 169) returns the in-process dict, not
  the Qdrant collection metadata. Two processes will disagree. **(M-M1)**
- `GraphitiMasteryStore._naive` (line 38) drops tzinfo on the way in but the
  `EntityEdge.created_at` defaults to *naive* in graphiti-core; the round-
  trip is fine, but the docstring is misleading. **(M-M2)**
- `TemporalMasteryStore` exposes no `close()` / context manager. WAL file
  is held open by a thread-local connection. **(M-M3)**
- The `valid_to` invariant in `TemporalMasteryStore.append_mastery_edge`
  (line 99) sets the close timestamp to the *new* event's timestamp, not the
  prior event's `valid_from` + epsilon. Two updates in the same millisecond
  would clobber. **(M-M4)**
- `_default_mastery_store` writes a smoke-test edge for `_init_check` to
  the live DB on every startup (line 36). This is a one-off but it pollutes
  `get_all_concept_ids` for downstream callers. **(M-M5)**

### 1.4 ADRs / PRDs to update

- **ADR-0001** needs an explicit "what is the storage root?" sentence.
- **ADR-0020** ("Qdrant for source chunks, memory events use SQL") is
  followed; add a note that *mastery edges* are the exception (graphiti
  temporal edges, not SQL events).
- **prd-memory-layer.md** should enumerate the fallback path M-B1 makes
  observable.

---

## 2. Harness Layer

Files: `backend/app/harness/model_router.py`, `artifact_gate.py`,
`eval_gate.py`, `workflow_template_system.py`, `tool_registry.py`,
`event_emitter.py`, `named_configs.py`, `ingestion_gate.py`,
`compaction_config.py`, and the routers in `backend/app/api/`.

### 2.1 Blockers

**H-B1. `workflow_editor.tsx:194` posts to `/api/workflows/{id}/run` — the
backend exposes `/api/workflows/{id}/run` only as a stub returning 200
without invoking the agent.** The Studio "Run" button therefore appears to
succeed but produces no artifacts. The Practice Gen endpoint
`/api/artifacts/practice-exercises/run` is the real path; the editor does
not know about it.
- Fix: editor should call the practice gen endpoint with the *forked*
  template's `practiceConfig`, not the workflow's `run` stub.
- Or: add a real implementation for `POST /api/workflows/{id}/run` that
  dispatches to `practice_gen` with the template's `practiceConfig`.
- ADR-0008, ADR-0009 mandate workflow run paths.

**H-B2. `POST /api/workflows/{id}/customize` is not registered.** The
frontend `SourceNotebookScreen.tsx` gear-icon flow calls this endpoint
to fork a global workflow. The backend has no route for it; the click
silently 404s. (Discovered via grep on the backend router list — only
`/api/workflows` GET/POST and `/api/workflows/{id}` PATCH are mounted.)
- Fix: add the router in `backend/app/api/workflows.py` with a model that
  accepts the source `workflowId` and `customizationPatch` and returns a
  new `WorkflowTemplate` with `scope=subject|chapter|topic`,
  `parentId=<source>`, and `promptTemplate` carried through.
- ADR-0008, ADR-0009 require a customisation path; this is the missing
  half.

**H-B3. The `ArtifactDTO.name` rename in Phase 3 (`fe3fb71`) is the only
schema the frontend sees, but the *seed* data and *existing* tests
still emit `title`.** The `workflows_repo.seed` populates with the old
field name. Tests pass because they construct artifacts directly. Live
requests against a real seeded workspace will return `title` in some
rows and `name` in others.
- File: `backend/app/storage/workflows_repo.py` seed block.
- Fix: rename the seed field and add a pydantic `Field(alias="title")`
  for backwards-compat OR delete the old field.

**H-B4. `model_router.route("workflow")` accepts the prompt template by
string, not by template id.** `practice_agent.py:run_practice` passes the
template's `promptTemplate` directly to the router; the router has no
record of *which* template produced the run. As a result, the eval gate
cannot attribute outputs to a specific workflow, and A/B comparisons across
templates are impossible.
- Fix: extend `ModelRouteRequest` with `template_id`, `workflow_id`,
  `scope`, persist to `eval_runs` table.
- ADR-0011, ADR-0018.

**H-B5. `eval_gate.py` exists but is never called by any agent
service.** The four practice-generation paths (lesson, exercise, plan,
source-understanding) construct their outputs, persist them via the
artifact repo, and return — never invoking `EvalGate`. The harness
config (ADR-0018) calls for layer-specific checks; in code there is
nothing wiring them up.
- Fix: each agent service must call `eval_gate.run(name, output)` before
  persisting. Add a wrapper in `practice_agent.py:run_practice`.

### 2.2 High

**H-H1. `artifact_gate._check_duplicate` (line 89-94) compares only
`concept_ids` and `source_ids`, ignoring the `name` and `promptTemplate`
hash.** Two exercises with identical grounding but different prompts would
be flagged as duplicates. The user's PRD `prd-harness-layer.md §167`
names "concept_ids + source_ids" but in practice the user wants
*semantic* dedup, not structural.
- Fix: hash `(concept_ids, source_ids, prompt_template_sha)`.

**H-H2. `artifact_gate._check_source_grounding` (line 59-74) calls
`checker.chunk_exists` but no implementation of `ChunkExistenceChecker` is
registered.** The interface is a `Protocol`; the implementation would have
to be `qdrant_router.QdrantRetrievalRouter.chunk_exists`, which does not
exist. Result: the gate silently passes if no checker is wired in.
- File: `backend/app/harness/qdrant_router.py` — add `chunk_exists`.

**H-H3. `workflow_template_system.py` is a `Protocol` only — there is
no concrete implementation.** The "system" lives in
`storage/workflows_repo.py` (a SQLite CRUD layer), and it does not
implement the protocol's *composability* method. ADR-0008 requires
"structured templates with editable prompts"; the prompt is editable in
the editor, but composing templates (insert one into another) is not
implemented.
- Fix: either add a `CompositeWorkflowTemplate` concrete class, or
  demote the protocol to a docstring.

**H-H4. `tool_registry.py` declares a `ToolRegistry` Protocol with
`register` / `list_tool_names` but no concrete impl.** ADR-0018 names
five agent roles with distinct harness configs; the registry that should
scope tools per role is a stub.
- File: `backend/app/harness/tool_registry/` directory exists alongside
  the `.py` file — clarify which is authoritative.

**H-H5. `event_emitter.py` has no subscriber; the practice gen path
emits `ConceptMasteryUpdated` events into the void.** `kuzu_graph_layer`
subscribes to memory events (ADR-0014) but `event_emitter` is never
called from `practice_agent`. The `trigger_event_id` parameter in
`update_mastery` is therefore always `None`.
- Fix: emit from `practice_agent.run_practice` before `update_mastery`.

**H-H6. `ingestion_gate.py` exists but the route that should call it
(`/api/sources/ingest`) does not exist.** Phase 0.2 added problems API,
expanded seed, and workspace CRUD — but no `sources/ingest` route. The
ingestion flow that ADR-0004 (multiple artifact types) and ADR-0019
(concept identity at ingestion) require is the *only* path that
populates the graph layer, and it is missing.
- Fix: add the route, wire it to `ingestion_gate.run`.

**H-H7. `compaction_config.py` exists but no caller.** ADR-0016 mandates
"API primitives over HistoryManager.deleted" — there is no caller of
`compaction_config` in any router or agent. The history compaction
contract is unimplemented.
- Fix: schedule `compaction_config.compact_history(...)` from a periodic
  task in the FastAPI lifespan, or on each agent post-run.

### 2.3 Medium / Low

- `model_router.py:route` does not return latency / cost / model-name
  metadata. Eval traceability (ADR-0011) is impossible. **(H-M1)**
- `named_configs.py` reads "Five agent roles" but only the practice
  agent role is in the dict. The other four (socratic, ingestion, summary,
  eval) are referenced by name in ADRs but absent from the config table.
  **(H-M2)**
- `practice_agent.py:run_practice` catches `JSONDecodeError` broadly and
  falls back to a single padded exercise, regardless of `count`. The
  fallback path does not stamp `scope` ids (the bug fixed in `f1cb154` is
  in the *artifact* layer, not the exercise layer). **(H-M3)**
- The eval gate's `SandboxRunner` protocol (artifact_gate.py:31) is
  defined but no implementation is provided. **(H-M4)**

### 2.4 ADRs / PRDs to update

- **ADR-0008** should explicitly enumerate the `customize` endpoint.
- **ADR-0011** ("eval gates use pydantic-evals and layer-specific
  checks") should call out which gate wraps which agent call.
- **ADR-0018** ("five agent roles have distinct harness configs") should
  list all five and the corresponding `named_configs` entries.
- **prd-harness-layer.md §167** should be split into
  §167.schema / §168.grounding / §169.runability / §170.dedup with
  one-paragraph test contracts per check.

---

## 3. Context Layer

Files: `backend/app/harness/context_gate.py` (237 lines), and its callers
in `practice_agent.py`, `ingestion_gate.py`, `socratic_agent.py`.

### 3.1 Blockers

**C-B1. `build_seed_context` returns an empty `retrieved_chunks` slot.**
Line 187 hard-codes `retrieved_chunks: list[str] = []`. The slot is
populated by the *caller*, but no caller in the codebase actually does
so. The practice agent builds its own prompt, bypassing the context gate
entirely. CONTEXT.md is explicit: the context gate is the only path for
seeded model calls.
- Fix: `practice_agent.run_practice` must call `context_gate.build_seed_context`
  and use the returned `SeedContext` to construct the model prompt. The
  current path constructs prompts inline from `promptTemplate + user_input`.

**C-B2. `examples` and `history` slots are also empty (lines 200-201).**
The docstring says these are "populated by the caller (agent service)".
No caller does. The four empty slots make the "nine-slot" structure a
lie.
- Same fix as C-B1: thread history through to the agent service.

**C-B3. `graph_seed` is silently dropped on exception (line 184).**
`except Exception: pass` is a code smell with teeth here: a graph layer
error means the model runs without concept context, but no log line is
emitted. Operators will not know.
- Fix: `logfire.warning` with the exception type and message.

### 3.2 High

**C-H1. The "hard budget" check uses `text.split()` (line 88).** This
under-counts by ~30% versus a real BPE tokenizer. A 700-token system
prompt by `tiktoken` is ~510 by this approximation, so the hard budget
of 800 is *effectively* ~1100. ADR-0006 says "hard budget — raises
BudgetError if exceeded"; the trigger is wrong.
- Fix: add a `tiktoken`-backed counter, or document the over-count.

**C-H2. `_truncate` (line 91-96) drops the *last* words with no marker
for the model.** The model receives a `"-ing"` suffix in the middle of a
sentence and may produce a malformed output. The current marker is
`[truncated]` *after* the truncated text, which the model may treat as
literal content.
- Fix: replace with a sentence-boundary cut, or use a sentinel like
  `<!-- truncated -->` that the agent can recognise.

**C-H3. `deep_source` is a constructor flag, not per-call.** ADR-0007
says it is "valid only for Ingestion Agent and synthesis workflows".
Setting it in the constructor means every call from the same gate is
deep-source; the agent service must construct a *separate* gate
instance, but no agent service does.
- Fix: pass `deep_source: bool` to `build_seed_context` as a parameter
  and remove the constructor flag.

**C-H4. `tool_names` slot uses raw tool names (line 160).** No
descriptions, no parameter signatures. The model has no way to know
*when* to call `source_search_exact` vs `source_search`. The PRD's
`prd-context-engineering-layer.md` names this as a regression.
- Fix: emit `<name>: <one-line description>` per tool.

**C-H5. The nine slots are an unconstrained dict in the protocol.**
`SeedContext` is a frozen pydantic model (line 34-45), good. But the
caller has no way to *override* the `system_slot` — a frequent request
from agent services that need to inject role-specific instructions
(socratic, eval). The protocol surface is too narrow.
- Fix: add `system_slot_override: str | None = None` parameter.

### 3.3 Medium / Low

- `_DEFAULT_BUDGETS` is module-level and constant (line 67-77). No
  per-role override is possible. **(C-M1)**
- The log line at the end of `build_seed_context` (line 217) emits
  `total_tokens` but not per-slot. Operators cannot tell which slot
  blew up. **(C-M2)**
- The `system_prompt` is the *full* string passed to the gate; the gate
  never validates that the prompt matches the agent role. A bug in the
  caller can pass the socratic prompt to a practice-gen call. **(C-M3)**

### 3.4 ADRs / PRDs to update

- **ADR-0006** should call out the tokenizer approximation explicitly and
  name the over-count.
- **ADR-0007** should be updated to make `deep_source` a per-call
  parameter (deprecate constructor flag).
- **prd-context-engineering-layer.md** should add a §"Caller contract"
  listing which agent services *must* call the gate (currently zero).

---

## 4. Graph Layer

Files: `backend/app/harness/graph_layer.py` (98 lines, Protocol only),
`kuzu_graph_layer.py` (344 lines, concrete), `graphiti_mastery_store.py`
(temporal edge path — counted twice: once here, once in Memory).

### 4.1 Blockers

**G-B1. `_ensure_schema` swallows every exception (line 87-88).**
`CREATE NODE TABLE` will fail on every subsequent startup because the
table exists; the `except Exception: pass` masks that. Good. But it also
masks *schema drift* — if a column is added in a future migration, the
`CREATE TABLE` will raise a different error and be silenced. There is no
schema-version table.
- Fix: check `pragma` for current schema version, raise on mismatch.
- ADR-0027 mandates the concept node schema.

**G-B2. `_fuzzy_match_concept` (line 90-121) does a full-table scan on
every concept candidate.** For each candidate it executes
`MATCH (c:Concept) RETURN c.concept_id, c.concanonical_name, c.aliases`
and runs `process.extractOne` over the result. With N concepts, the
ingestion of M candidates is O(N × M). The PRD calls for "concepts grow
to thousands" — this is the hot path.
- Fix: build an in-process fuzzy index on first call, refresh on write.

**G-B3. `extract_and_link_concepts` (line 123-180) makes N+1 database
calls per candidate.** One for source merge, one for alias update / node
create, one for source link, and *one per prerequisite* for prereq
resolution. The expected pattern is a single `MERGE` chain.
- Fix: batch with `UNWIND $candidates AS cand MERGE …`.
- ADR-0027 (concept identity at ingestion) — every entry in the batch
  should resolve in O(1) DB calls.

**G-B4. Aliases are stored as a Kuzu `STRING[]` and mutated with
`SET c.aliases = $aliases` (line 137-139).** Two concurrent ingests
that both match the same concept will race on the alias set. Kuzu has
no row-level locking; the last writer wins, losing one ingest's
aliases. CONTEXT.md Gap 6 (graph-layer-spike.md §5) calls this out as a
known issue; the spike work to fix it has not landed.
- Fix: `MATCH (c) WHERE c.concept_id = $id RETURN c.aliases` →
  in-process merge → `SET`. Or move to a JSON column with optimistic
  concurrency.

**G-B5. `update_mastery` writes through `self._mastery_store`, but the
`trigger_event_id` is not validated against the `ConceptMasteryUpdated`
SQLite table that is supposed to be the FK target (line 56-63 in
graph_layer.py docstring).** If a caller passes a random uuid, the FK
target does not exist. There is no DB-level FK constraint — a check at
write time would catch it.

### 4.2 High

**G-H1. `get_concept_context` issues 2 + 1 + (1 × chain) Cypher queries
per concept (line 203-275).** With chain depth 8 and 100 concepts, that
is 800+ queries. The PRD names "prereq_chain depth 8" as the cap, but
the implementation is N+1 all the way down.
- Fix: collect all concept ids and their chain ids in two queries, then
  build nodes in Python.

**G-H2. The 9-slot protocol promise (graph_layer.py:31) is the five
methods, but the *Protocol* itself uses `...` bodies and is never
`@runtime_checkable`.** No static or dynamic check can confirm
`KuzuGraphLayer` implements the protocol. A typo in a method name
(`extract_and_link_concepts` vs `extract_and_link_concept`) would
silently break the layer contract.
- Fix: `@runtime_checkable` on the protocol, or an explicit
  `isinstance(layer, GraphLayer)` assertion in the wiring.

**G-H3. The `get_all_concepts` helper (line 305-337) is *outside* the
five-method surface (ADR-0025) but is called by the `/concepts` API
endpoint.** Adding a sixth method to the protocol would have to update
ADR-0025; the *helper* is the loophole.
- Fix: either add the method to the protocol (and update ADR-0025), or
  move the helper to a separate `KuzuReadOnly` adapter.

**G-H4. `detect_prerequisite_gaps` (line 339-343) calls
`get_concept_context` and returns `context.gap_concepts` — a wrapper
of one line. But the docstring on the protocol method (line 88-97)
promises "traverse PREREQUISITE_OF edges and return prerequisites
below the configured gap threshold". The current implementation does
not re-traverse; it relies on the chain computed by
`get_concept_context`. The two are not equivalent if a caller has
constructed `ConceptContext` with an empty chain. In practice the
graph layer always populates the chain, so the bug is latent.
- Fix: implement the documented traversal.

### 4.3 Medium / Low

- `kuzu_graph_layer.py:80-85` uses `Concept(canonical_name STRING,
  aliases STRING[])` but ADR-0027's spec includes a `created_at` column.
  The schema does not match the ADR. **(G-M1)**
- The mastery_store in KuzuGraphLayer is private (`self._mastery_store`).
  Tests cannot inject a mock. **(G-M2)**
- `_execute` (line 48-49) is a 1-line passthrough that adds nothing. **(G-M3)**
- The docstring in graph_layer.py:18 references a "wrapper" for fuzzy
  matching (Gap 1) but the actual fuzzy match is in KuzuGraphLayer, not a
  wrapper. Docstring drift. **(G-M4)**
- The "graph-layer-spike.md §5" Gap 5 — "Episode API bypass" — is
  enforced in graphiti_mastery_store.py:139-143 by *not* calling
  `add_episode`, but the constant string `"mastery_update"` (line 163)
  is the *only* check. A future refactor that re-introduces
  `add_episode` for "convenience" will not be caught. **(G-M5)**

### 4.4 ADRs / PRDs to update

- **ADR-0027** schema: add `created_at` to the concept node spec.
- **ADR-0029** ("prerequisite gap threshold is configurable"): the
  threshold is wired (`self.gap_threshold`), but the *config* file that
  PRD §prd-harness-layer.md names is absent. Add the env-var / YAML
  loader.
- **prd-harness-layer.md** §graph: add the test contract — "the layer
  must respond to N=1000 concepts in < 200ms for `extract_and_link_concepts`".

---

## 5. Cross-cutting findings

### 5.1 Blockers (block release)

| ID | Layer | Summary |
|---|---|---|
| X-1 | Harness | `/api/workflows/{id}/run` is a stub; editor success path produces no artifact. |
| X-2 | Harness | `/api/workflows/{id}/customize` is not registered; gear-icon fork 404s. |
| X-3 | Memory | `temporal_mastery_store.py:39` resolves relative to CWD; bypasses `backend/data/`. |
| X-4 | Graph | Kuzu `aliases` race condition (Gap 6) — concurrent ingests lose aliases. |
| X-5 | Harness | `eval_gate.py` and `artifact_gate.py` are unwired; no agent calls them. |

### 5.2 High (block layered correctness, not release)

- Memory: pseudo-embedding fallback writes garbage into Qdrant (M-H2).
- Memory: BM25 path missing (M-H3).
- Harness: `trigger_event_id` never populated; eval traceability broken
  (H-H5).
- Harness: `compaction_config` has no caller (H-H7).
- Context: `examples`/`history`/`retrieved_chunks` slots are always empty
  in practice (C-B1, C-B2).
- Context: `deep_source` is a constructor flag, not a per-call parameter
  (C-H3).
- Graph: alias fuzzy match is O(N×M) on every candidate (G-B2).
- Graph: `get_concept_context` is N+1 queries (G-H1).

### 5.3 Frontend findings (re-stated from the chat review)

- **`practice_approval` vs `practice_exercise` name mismatch** in
  `practiceExercisesApi.ts`. The backend now writes `name="practice_exercise"`
  (Phase 3 rename). The frontend `SourceNotebookScreen.tsx:99` still
  references the old name in a debug `console.log` (line 110).
- **`window.__INITIAL_STATE__` injection is absent** in `__root.tsx`.
  TanStack Router's `hydrate` expects a `__INITIAL_STATE__` global, but
  the SSR pass was never wired. (Per the previous smoke test, the app
  hydrates from query cache only.)
- **`submitRun` mutation** in `workflow-editor.tsx:194` posts to
  `/api/workflows/{id}/run`; same as X-1.
- **Graphite stack** — per ADR-0030, the next changes must be stacked.
  Use `gt create feat/<topic>-N-<layer>` and `gt submit --stack`.

### 5.4 Test coverage gaps

- Memory: 0 tests for `qdrant_router.source_search_exact` (the BM25-
  promised path).
- Memory: 0 tests for `GraphitiMasteryStore` (not even an import test
  with `graphiti-core` mocked).
- Harness: 0 tests for `eval_gate.py` — there are no `EvalGate` callers
  in tests either.
- Harness: 0 tests for `artifact_gate._check_runability` (the sandbox
  protocol has no concrete implementation, so this branch is dead).
- Context: 0 tests for the budget enforcement (no test exercises the
  `BudgetError` path).
- Graph: 0 tests for `_fuzzy_match_concept` with 1000+ concepts (the
  hot path).

---

## 6. Layer-to-PRD traceability matrix

| PRD section | Layer | Module(s) | Status |
|---|---|---|---|
| `prd-memory-layer.md` §memory-event-store | Memory | `temporal_mastery_store.py` | Partial (no CWD-pinning; M-B2) |
| `prd-memory-layer.md` §mastery-temporal-edges | Memory | `graphiti_mastery_store.py` | Partial (no cross-process cache invalidation; M-H5) |
| `prd-memory-layer.md` §hybrid-retrieval | Memory | `qdrant_router.py` | Broken (BM25 path missing; M-H3) |
| `prd-harness-layer.md` §workflow-template-system | Harness | `workflow_template_system.py` | Broken (no concrete impl; H-H3) |
| `prd-harness-layer.md` §artifact-gate | Harness | `artifact_gate.py` | Unwired (H-B5) |
| `prd-harness-layer.md` §eval-gate | Harness | `eval_gate.py` | Unwired (H-B5) |
| `prd-harness-layer.md` §graph | Graph | `kuzu_graph_layer.py` | Partial (race; G-B4) |
| `prd-context-engineering-layer.md` §nine-slot | Context | `context_gate.py` | Partial (3 slots always empty; C-B1) |
| `prd-context-engineering-layer.md` §deep-source | Context | `context_gate.py` | Partial (constructor flag; C-H3) |
| `prd-context-engineering-layer.md` §token-budget | Context | `context_gate.py` | Partial (wrong counter; C-H1) |

---

## 7. Recommended next actions (small, ordered)

1. **Land Graphite setup** (per ADR-0030): `gt create feat/harness-wire-eval-gate-1-artifact-gate`.
2. Wire `artifact_gate.validate_artifact` into `practice_agent.run_practice`
   *before* persisting the artifact (H-B5).
3. Implement `POST /api/workflows/{id}/customize` (H-B2).
4. Implement `POST /api/workflows/{id}/run` to dispatch to
   `practice_gen` with `practiceConfig` (H-B1).
5. Pin Qdrant and mastery storage to `backend/data/` (M-B2, M-B1).
6. Add BM25 sparse path to `qdrant_router.source_search_exact` (M-H3).
7. Migrate the graph layer's fuzzy match to an in-process index (G-B2).
8. Thread `retrieved_chunks` / `history` / `examples` through
   `practice_agent` (C-B1, C-B2).
9. Add the missing `created_at` column to the Kuzu concept schema
   (G-M1, ADR-0027).
10. Backfill the missing five tests in §5.4.

After steps 1-4, the Studio end-to-end smoke (frontend-prototype's
"Run Practice" button → artifact appears → mastery edge appended) should
work. Steps 5-10 are correctness, not functionality.

---

## Appendix A — Files read for this review

| File | Lines |
|---|---|
| `backend/app/harness/__init__.py` | 1 |
| `backend/app/harness/context_gate.py` | 237 |
| `backend/app/harness/qdrant_router.py` | 308 |
| `backend/app/harness/temporal_mastery_store.py` | 180 |
| `backend/app/harness/graphiti_mastery_store.py` | 296 |
| `backend/app/harness/graph_layer.py` | 98 |
| `backend/app/harness/kuzu_graph_layer.py` | 344 |
| `backend/app/harness/artifact_gate.py` | 192 |
| `backend/app/harness/model_router.py` | (read in earlier session) |
| `backend/app/harness/workflow_template_system.py` | (skeleton, read in earlier session) |
| `backend/app/api/practice_agent.py` | (read in earlier session) |
| `backend/app/api/workflows.py` | (read in earlier session) |
| `backend/app/api/practice_exercises.py` | (read in earlier session) |
| `backend/app/api/artifacts.py` | (read in earlier session) |
| `backend/app/api/workspace.py` | (read in earlier session) |
| `backend/app/storage/workflows_repo.py` | (read in earlier session) |
| `frontend/src/routes/SourceNotebookScreen.tsx` | (read in earlier session) |
| `frontend/src/routes/WorkflowEditorScreen.tsx` | (read in earlier session) |
| `frontend/src/stores/workspaceStore.ts` | (read in earlier session) |
| `frontend/src/api/workspaceApi.ts` | (read in earlier session) |
| `frontend/src/routes/__root.tsx` | (read in earlier session) |
| `frontend/src/router.tsx` | (read in earlier session) |
| `frontend/src/queries/queries.ts` | (read in earlier session) |
| `frontend/src/routes/workflow-editor.tsx` | (read in earlier session) |
| `frontend/src/types/workspaceTypes.ts` | (read in earlier session) |
| `frontend/src/components/LeftNav.tsx` | (read in earlier session) |

## Appendix B — Files *not* read in this pass

These were not re-opened for this review; their state is from the chat
review delivered earlier this session:

- `backend/app/harness/ingestion_gate.py`
- `backend/app/harness/eval_gate.py`
- `backend/app/harness/event_emitter.py`
- `backend/app/harness/tool_registry.py`
- `backend/app/harness/named_configs.py`
- `backend/app/harness/compaction_config.py`
- `backend/app/harness/memory_seed.py`
- `backend/app/harness/tool_registry/` directory

A second pass should re-read these for the eval-gate wiring (H-B5) and
the tool-registry contract (H-H4).
