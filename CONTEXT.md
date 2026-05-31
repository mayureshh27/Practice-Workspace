# Practice Tool

This context defines the product language for a local-first adaptive practice workspace for technical learning. It keeps future design and implementation work centered on the learning loop rather than drifting into a generic AI workspace.

## Language

**Adaptive Practice Workspace**:
The primary product spine: a place where a learner studies structured material, solves exercises, receives feedback, and builds mastery over time. Ingestion, chat, memory, graphs, and tools exist to support this practice loop.
_Avoid_: Learning OS, generic agent workspace, chatbot

**Ingestion Harness**:
A supporting subsystem that turns books, videos, repositories, and web sources into structured learning content for the Adaptive Practice Workspace. It remains independently runnable so ingestion can be tested, improved, and reused without the full UI.
_Avoid_: Scraper, import script

**Learning Source**:
Any learner-selected input that can be transformed into study material, including PDFs, books, slide decks, Word documents, uploaded video or playlist transcripts, GitHub repositories, documentation sites, and manual notes. The domain model must allow multiple source types from the start.
_Avoid_: Book, document, upload

**Ingestion Artifact**:
Any structured output produced from a Learning Source, such as normalized text, chunks, source citations, concept candidates, graph facts, exercises, lessons, quizzes, flashcards, diagrams, or practice projects. Exercises are one important artifact, not the only ingestion output.
_Avoid_: Problem, generated content

**Chunk**:
A contiguous unit of source text produced at ingestion, carrying mandatory citation metadata: `source_id`, `chunk_index`, and `page_or_timestamp`. The atomic unit served by the Retrieval Router. Chunks exceeding 800 tokens are written to `tmp/chunks/{chunk_id}.md` at ingestion time; the Retrieval Router tool result returns only the first 200 tokens as a plain-text preview plus the file path. The agent calls `file_read(path, start_line, end_line)` to load specific sections.
_Avoid_: Document fragment, passage, text block, RAG chunk

**Context Engineering Layer**:
The system boundary that decides what source material, memory, skill rules, tool descriptions, examples, and recent session history are assembled for an AI call. It is a first-class product foundation, not incidental prompt text inside endpoints.
_Avoid_: Prompt, system prompt, RAG prompt

**Layer Contract**:
A stable interface between major subsystems such as ingestion, storage, retrieval, memory, graph, model routing, context building, tools, and UI. Implementations may start simple, but the workspace should depend on contracts so better tools can replace early choices without rewriting the product.
_Avoid_: Wrapper, abstraction for abstraction's sake

**Evolution Path**:
The planned progression from thin but real foundations to a richer agentic system. The first build should make the path to orchestration, branching, richer memory, and stronger evals short, but should not pretend those advanced behaviors already exist.
_Avoid_: Roadmap, future work

**Model Router Contract**:
The system boundary that maps task types, budgets, context length, privacy constraints, and provider availability to model calls. The harness must stay model-agnostic; model-specific prompts and adapters may improve performance, but core product behavior should not depend on any single provider or require a gateway service in local BYOK mode.
_Avoid_: Claude integration, OpenAI integration, LLM client

**Harness**:
The engineered system of eight primitives — Context Gate, Memory Seed Protocol, Retrieval Router, Tool Registry, Compaction Config, Eval Gates, Workflow Template System, and Event Emitter — that makes learning behavior repeatable, inspectable, and model-agnostic. The harness is the durable product asset; individual model providers, vector stores, and graph backends are replaceable implementations behind it.
_Avoid_: Prompt stack, agent magic, LLM wrapper

**Context Gate**:
The nine-slot fixed-budget system that governs every token entering a model call. The system slot has a hard budget and raises a BudgetError if exceeded; all other slots are soft. The seed context produced by the Context Gate is approximately 9,400 tokens; the agent discovers additional context at runtime via tool calls. Deep-source mode is the only path to expanding slot budgets and must be an explicit constructor parameter, never a default.
_Avoid_: Context window, prompt assembly, ContextBuilder config

**Memory Seed Protocol**:
The pre-session initialisation routine that materialises learner state as four structured markdown files (`mastery.md`, `blind_spots.md`, `active_sources.md`, `position.md`) in `/memories/` before a tutor or practice session begins. The agent reads these files via tool call as its first action; they are never injected into the seed context. Files survive process restarts.
_Avoid_: Memory injection, context pre-population, session init

**Mastery Score**:
A float in [0.0, 1.0] representing a learner's current proficiency on a Concept Node. Updated by a deterministic rule after every PracticeAttempted event: pass → +0.10 (capped at 1.0), fail → −0.05 (floored at 0.0). Stored as a Temporal Mastery Edge in the Memory Graph so score history is queryable at any point in time. The score on the edge is always derived from raw events in the SQLite event log — raw events are the source of truth, scores are recomputable.
_Avoid_: Score, level, proficiency, competency

**Retrieval Router**:
The Layer Contract for source-chunk retrieval, exposing two tools: `source_search(query, mode, filters)` where `mode` is `semantic | hybrid` (default hybrid, using BM25 sparse + MiniLM dense + RRF fusion), and `source_search_exact(tokens)`, a dedicated BM25-only tool for exact-token queries such as error messages, function names, and variable names. `source_ids` is a mandatory positional parameter in both tools — omitting it is a TypeError. Used only for source chunks, never for memory events.
_Avoid_: RAG, vector search, Qdrant client, search function

**Socratic Gate**:
A post-generation eval check that runs on every tutor response before it reaches the learner. Enforces three binary conditions: no solution code, no direct answer, response ends with a question. Responses failing the first two are blocked, a HintLeakage event is logged, and the response is regenerated with a sharpened prompt. Failing only the third gets a question appended. A permanent architectural component, not a temporary safety net.
_Avoid_: Content filter, output guard, answer check

**Event Emitter**:
The only write path to the SQLite event log. Called by the practice surface and workflow orchestrator after observable actions; never by agent tool calls. Runs the mastery update rule and blind spot detection rule synchronously after each PracticeAttempted event, then emits ConceptMasteryUpdated and BlindSpotDetected events as deterministic consequences.
_Avoid_: Memory writer, event logger, database write, record_event caller

**MemoryStore**:
The read/write interface to the SQLite typed event log for all seven memory events. Write access is available only to the Event Emitter; the Context Gate and all agents hold a read-only reference that exposes `get_learner_context()`, `get_session_summary()`, and `get_blind_spots()` only.
_Avoid_: Database, memory database, event database, vector store

**Tool Registry**:
The system that stores tool names, one-sentence descriptions, and JSON schema files separately in `tool_registry/{name}.json`. The Context Gate injects only tool names (~200 tokens total); full schemas are served on demand via `tool_lookup(name)`. Changing a tool's schema does not change the seed context token count.
_Avoid_: Tool list, function calling config, tool definitions

**Temporal Mastery Edge**:
A timestamped edge in the Memory Graph, written by `GraphLayer.update_mastery()` via Graphiti's temporal edge primitives, that records one mastery state for a Concept Node. Attributes: `mastery_score`, `trigger_event_id` (FK to the ConceptMasteryUpdated SQLite row), `recorded_at`, `valid_from`, `valid_to`. Edges are append-only — each update adds a new edge; prior edges are never deleted. Point-in-time mastery queries filter by `recorded_at <= target_timestamp` and return the most recent.
_Avoid_: Mastery record, score history, graph edge

**Workflow Template**:
A structured markdown file in `.platform/workflows/{name}.md` defining input source types, context slots, prompt text, output schema, eval checks, and artifact type for a repeatable generation task. The Context Gate injects only the template name and two-line description; full prompt is loaded via `workflow_lookup(name)`. The prompt text is human-editable; the header block is machine-read by the Artifact Gate.
_Avoid_: Prompt template, system message, generation config, workflow config

**Agent Role**:
One of five distinct harness configurations — Ingestion, Tutor, Workflow, Session Summary, Eval — each with its own Context Gate settings, tool set, eval gates, and memory access pattern. Roles are never shared, inherited, or conditionally swapped at runtime.
_Avoid_: Agent type, agent mode, agent variant

**HintLeakage**:
A memory event recorded when the Socratic Gate blocks a tutor response for containing solution code or a direct answer. Carries the blocked response text, gate failure type (`code_leak` or `answer_leak`), model version, and prompt version. The primary regression signal for the eval suite when prompt or model changes are made.
_Avoid_: Safety violation, blocked response, filtered output

**Deep-Source Mode**:
An explicit `bool` constructor parameter on the Context Gate that expands retrieved-source-chunk and history slot budgets by 4×. Valid only for the Ingestion Agent and synthesis workflows. Never valid for the Tutor Agent. It is an architectural boundary, not a performance setting.
_Avoid_: Large context mode, expanded window, long context, big context

**Shared Learning Memory**:
The learner-owned store of progress, attempts, source notes, session summaries, concept links, and recallable context used across practice sessions and study tools. Backed by the SQLite event log; memory events are retrieved via SQL joins over typed foreign keys, never via semantic similarity search. It is common infrastructure for the workspace, not a separate product.
_Avoid_: Chat memory, vector store, database

**Session Summary**:
A compressed pedagogical record of one practice session, stored as a `SessionSummaryCreated` event in the SQLite event log. Produced by the SessionSummaryAgent from a serialised event list at session close; its `mastery_deltas` field is verified against the session's actual `ConceptMasteryUpdated` events before the Event Emitter writes it. Surfaced to the tutor at the start of the next session via the Memory Seed Protocol files.
_Avoid_: Session log, session history, conversation summary

**Knowledge Graph**:
The structured map of concepts, chapters, domains, prerequisites, source references, exercises, and mastery signals. It spans all Learning Sources and subjects so the workspace can recommend practice, show relationships, and preserve continuity across study sessions.
_Avoid_: Visual graph, graph database

**Graph Layer**:
The Layer Contract responsible for storing, querying, and evolving Learning Graph, Source Graph, and Memory Graph data. Exposes five product-owned methods: `extract_and_link_concepts`, `update_mastery`, `get_concept_context`, `link_exercise_to_concepts`, `detect_prerequisite_gaps`. Graphiti and Kuzu are first implementations; neither is imported outside this module. The five method signatures, their Graphiti and Kuzu primitive mappings, and all implementation gaps are documented in `docs/graph-layer-spike.md`.
_Avoid_: Graphiti integration, graph vendor, graph client

**Concept Identity Resolution**:
The ingestion-time check that compares a newly extracted concept name against existing Concept Node canonical names and aliases before creating a new node. A fuzzy match at or above a configurable threshold (default 85, token-set ratio) reuses the existing node and appends the new alias; below threshold, a new node is created. Happens once, durably, at ingestion — never at query time. The threshold is a GraphLayer constructor parameter, locked before the first source is ingested; changing it thereafter is a schema migration, not a configuration change.
_Avoid_: Concept deduplication, entity resolution, alias matching

**Concept Node**:
The graph entity representing a single learning concept, owned by the Graph Layer. Carries `concept_id` (stable UUID shared across Kuzu, Graphiti, and SQLite), `canonical_name`, `aliases: list[str]`, and mastery history stored as Temporal Mastery Edges. The unit of the Knowledge Graph from the learner's perspective — one Concept Node may carry aliases from multiple Learning Sources, resolved at ingestion time via Concept Identity Resolution.
_Avoid_: Concept, topic node, knowledge node, graph node

**Blind Spot**:
A concept, skill, or prerequisite where the learner has made ≥ 3 attempts across ≥ 3 distinct sessions, the most recent attempt did not pass, and hint count per attempt is not decreasing. Detected by a deterministic SQL rule over the event log, not by LLM judgment. Cleared (resolved_at set) when mastery crosses 0.70 for that concept.
_Avoid_: Weak tag, mistake, struggling concept

**Study Tool**:
A focused interface inside the workspace, such as NotebookLM-style source chat, an IDE-like practice view, or a concept graph. A Study Tool must read from or write to Shared Learning Memory instead of becoming an isolated silo.
_Avoid_: App, standalone feature

**Workspace Shell**:
The primary UI frame for the Adaptive Practice Workspace: persistent left navigation, central work area, and dockable side and bottom surfaces for sources, tutor chat, artifacts, graph, terminal, output, and practice tools. It should evolve the existing practice UI rather than replace it with a generic chat app.
_Avoid_: Dashboard, landing page

**Resource Manager**:
The Study Tool for organizing Learning Sources and generated artifacts by domain, subject, chapter, and topic. It should feel closer to NotebookLM projects and Claude projects than to a file browser, but its outputs feed the practice loop.
_Avoid_: File manager, upload panel

**Practice Surface**:
The central Study Tool where lessons, exercises, code, sandbox execution, and generated practice artifacts are used. It may launch an IDE-like editor or custom sandbox when needed, but the default experience remains learning and practice rather than raw coding.
_Avoid_: IDE, code editor

**Prerequisite Gap**:
A prerequisite Concept Node whose Mastery Score is below the configurable gap threshold (default 0.5), as returned by `GraphLayer.detect_prerequisite_gaps()`. Included in the `graph_seed` context slot so the tutor can name the specific missing foundation concept rather than giving a generic hint. Distinct from a Blind Spot: a Blind Spot is detected from attempt-count patterns over sessions; a Prerequisite Gap is detected from the current Mastery Score relative to a threshold at context assembly time.
_Avoid_: Missing prereq, knowledge gap, dependency

## Flagged Ambiguities

**Local**:
Resolved as local-first and Docker-runnable. The product should run on the learner's machine by default while preserving a path to later deployment.

**Memory**:
Resolved as two distinct concepts that must never be conflated. "Shared Learning Memory" is the product concept (the learner's progress store, backed by SQLite typed events, accessed via MemoryStore). "Memory Seed Protocol" is the pre-session initialisation mechanism. "Vector store" and "embedding memory" refer only to source-chunk retrieval via the Retrieval Router (Qdrant), never to learner state.

## Example Dialogue

Developer: Should the NotebookLM-style chat become the main product?

Domain expert: No. It is a Study Tool inside the Adaptive Practice Workspace. It helps interrogate sources and memory, but the main loop is still practice, feedback, and mastery.

Developer: Can the ingestion pipeline be developed separately?

Domain expert: Yes. The Ingestion Harness should stay independently callable, but its output is judged by whether it improves the practice loop.

Developer: Can we defer memory and graph until after the first ingestion demo?

Domain expert: No. The first slice can have simple implementations, but Context Engineering Layer, Shared Learning Memory, and Knowledge Graph must exist as real system boundaries from the start.

Developer: Should we hard-code Chroma, NetworkX, and SQLite directly into the tutor and UI?

Domain expert: No. Those can be first implementations, but the Adaptive Practice Workspace should depend on Layer Contracts so each layer can evolve toward the richer agentic system independently.

Developer: Is the project mainly about integrating one best model?

Domain expert: No. The Harness is the durable product. Models should be swappable through the Model Router Contract, with optional model-specific prompting kept behind adapters.

Developer: Should Graphiti become the product's memory model?

Domain expert: No. Graphiti can be the first Graph Layer implementation, but the product owns Learning Graph, Source Graph, and Memory Graph concepts through its own Layer Contract. Graphiti is never imported outside `graph_layer/`.

Developer: Should the first UI become a plain chat interface?

Domain expert: No. The UI should be a Workspace Shell that preserves the existing practice primitives while adding Resource Manager, dockable tutor/source panels, artifacts, graph, and optional IDE-like practice surfaces.

Developer: Should ingestion write only problems.json?

Domain expert: No. problems.json can remain a compatibility export, but the Ingestion Harness should produce Ingestion Artifacts for retrieval, graph, memory, lessons, practice, and review workflows.

Developer: Can the tutor run in deep-source mode for long sessions?

Domain expert: No. Deep-source mode is for the Ingestion Agent and synthesis workflows only. The Tutor Agent has a hard conservative budget. Giving the tutor a large context window without purpose causes context rot and imprecise hints.

Developer: Can I add a `memory_write` tool so the tutor can update mastery when it thinks the learner understood something?

Domain expert: No. The Event Emitter is the only write path to the event log. The tutor's belief that a learner understood something is probabilistic and subject to hallucination. Mastery updates are deterministic consequences of submitted attempts with verifiable test results.

Developer: Can the Socratic Gate be relaxed once the model gets better at following instructions?

Domain expert: No. The gate is a permanent pedagogical requirement. Learners should be able to rely on the platform never giving them the answer. That guarantee has no expiry date.

Developer: Can I store memory events in Qdrant alongside source chunks to keep things simple?

Domain expert: No. Source chunks and memory events are different retrieval problems. Qdrant is for text-similarity search over source content. Memory events are causal entity records — retrieved by SQL join over typed foreign keys, not by cosine similarity. Conflating them is the canonical failure mode of generic memory systems.

Developer: Who calls MemoryStore.record_event()?

Domain expert: Nobody calls it directly. The Event Emitter is the only write path. The MemoryStore exposes record_event internally but agents, the Context Gate, and the SessionSummaryAgent have no reference to that method.

Developer: Can the SessionSummaryAgent query the MemoryStore to write a richer summary?

Domain expert: No. The SessionSummaryAgent receives a serialised event list and nothing else. Its output is verified against that list before the Event Emitter writes it. Store access would make the summary unverifiable and introduce a hallucination path into the event log.

Developer: When does Concept Identity Resolution run?

Domain expert: At ingestion, once, durably. The GraphLayer checks the new concept name against existing nodes before creating anything. It never runs again at query or retrieval time. Changing the fuzzy-match threshold after sources have been ingested is a schema migration, not a config change.

Developer: Can I return the full source chunk text in the retrieval tool result to save the agent an extra tool call?

Domain expert: No. Chunks exceeding 800 tokens are written to `tmp/chunks/{chunk_id}.md` at ingestion time. The tool result returns the chunk ID, a 200-token plain-text preview, and the file path. The agent calls `file_read(path, start_line, end_line)` for the section it actually needs. A single textbook proof or code listing can be 1,500–4,000 tokens — returning it in full would consume the entire retrieved-source-chunks slot budget on one result.

Developer: Should the Workflow Template specify which retrieval mode to use so each workflow always gets the right retrieval strategy?

Domain expert: No. Retrieval mode is an agent decision made per query, not a workflow configuration. A single hint session involves both conceptual questions that need semantic retrieval and error message lookups that need exact retrieval via `source_search_exact`. Fixing the mode in the template would force the wrong retrieval path on half the queries in every session.

Developer: Can I always use hybrid retrieval and let RRF fusion handle both conceptual and exact-token queries?

Domain expert: No. `source_search_exact` exists as a dedicated BM25-only tool precisely because dense vectors on short error strings return semantically plausible but textually wrong chunks. BM25 alone outperforms hybrid on exact-token queries such as error messages, function names, and variable names. The agent picks `source_search_exact` explicitly for those queries rather than relying on RRF to compensate.

Developer: Can I call graphiti.add_episode() directly to store a mastery update? It's the main Graphiti API and it feels like the natural way to add data.

Domain expert: No. add_episode() is designed for narrative text — it runs entity extraction internally, which is non-deterministic and loses the typed event schema. Mastery updates are structured events with a known trigger_event_id. Use update_mastery() from the GraphLayer surface, which calls the lower-level Graphiti edge API directly. ADR-0025 is the explicit stop sign.

Developer: Can I import the Kuzu client inside the ContextBuilder to fetch prerequisite chains directly? It would save a method call.

Domain expert: No. Kuzu and Graphiti are never imported outside graph_layer/. The ContextBuilder calls get_concept_context() on the GraphLayer contract. That method coordinates the Kuzu traversal and the Graphiti mastery lookup internally. The ContextBuilder must stay read-only and backend-agnostic.

Developer: Can I hardcode the prerequisite gap threshold at 0.5 since that is the default everywhere?

Domain expert: No. The gap threshold is a GraphLayer constructor parameter. Different domains — robotics theory versus code exercises — may need different values. Hardcoding it prevents tuning without a code change. It also conflates three distinct thresholds that must stay separate: the gap threshold at 0.5, the blind spot clearing threshold at 0.70, and the blind spot detection threshold, which operates on attempt counts across sessions, not mastery scores.

Developer: If I need a new graph query for a reporting feature, can I add a sixth method to the GraphLayer?

Domain expert: Yes, but adding a sixth method requires updating ADR-0025, which documents the five-method surface as a deliberate boundary. The ADR exists to prevent surface creep without a conscious decision. If the query can be served by composing existing methods, do that first.

Developer: Should a Concept Node carry mastery_score as a Kuzu node property so I don't need a separate Graphiti lookup?

Domain expert: No. Kuzu stores the structural data — canonical_name, aliases, PREREQUISITE_OF edges. Mastery history is stored as Temporal Mastery Edges in Graphiti because it is temporal: each update appends a new edge, the full score trajectory is queryable at any point in time, and the raw SQLite events remain the source of truth. Storing a computed score on a Kuzu node property would flatten the history and break the recomputability guarantee from ADR-0026.

Developer: Is a Blind Spot the same as a Prerequisite Gap?

Domain expert: No. A Blind Spot is detected from attempt-count patterns across sessions via a deterministic SQL rule — the learner has failed repeatedly over time and hints are not decreasing. A Prerequisite Gap is detected at context assembly time by comparing the current Mastery Score against a threshold — the learner has not yet reached sufficient proficiency on a foundational concept. A concept can be a Prerequisite Gap without being a Blind Spot (not enough attempts yet), and a Blind Spot without being a Prerequisite Gap (mastery score is above the gap threshold despite repeated failures in prior sessions).