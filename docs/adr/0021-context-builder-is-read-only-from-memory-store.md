# ContextBuilder Is Read-Only with Respect to MemoryStore

The Context Gate reads from MemoryStore via `get_learner_context()` and from GraphLayer via
`get_concept_context()`. It never calls `record_event()` or any write method on either store.
Context assembly is a pure function of its inputs: reading learner state does not produce
learner state.

## Consequences

The write path to the SQLite event log runs exclusively through the Event Emitter, which is
called by the practice surface and workflow orchestrator after observable loop actions — never
as a side effect of context assembly. The `memory_write()` tool in the Tool Registry writes
only to the `/memories/` pre-seed files (the Memory Seed Protocol markdown files), not to
the event log.

This separation means the Context Gate is independently testable: pass it a mock MemoryStore
with no write surface and assert on the assembled messages list. It also prevents a feedback
loop in which what the model sees during a hint call changes the learner's mastery record —
a failure mode that would compound across sessions since each context assembly call would
emit events that alter the state the next assembly call reads.
