# Harness Writes Memory — Model Never Does

All seven typed memory events (SourceIngested, ArtifactGenerated, PracticeAttempted, HintRequested, BlindSpotDetected, ConceptMasteryUpdated, SessionSummaryCreated) are written by the harness as deterministic consequences of observable practice-loop actions. No model output directly triggers a memory write. The model has no tool or API surface through which it can call `record_event()`. The mastery update rule and blind spot detection rule are pure Python functions in `rules.py`, not LLM calls.

## Consequences

Memory events are auditable and reproducible: replaying the practice event sequence always produces the same mastery scores and blind spot detections. This eliminates an entire category of hallucination risk — the model believing the learner has mastered something and recording it when they have not. It also closes the adversarial path by which a learner could phrase a message to convince the tutor to record false mastery. The one exception is `SessionSummaryCreated`, which is LLM-assisted — but the `SessionSummaryAgent` returns a Pydantic model that the harness validates and writes; the agent never calls `record_event()` directly. `memory_write()` is exposed as a tool only for the Memory Seed Protocol files (`/memories/*.md`), not for the SQLite event log.

## Considered Options

- Model-decided memory writes via tool: non-deterministic, non-auditable, exploitable.
- Off-the-shelf memory providers (Mem0, Zep Cloud, LangMem): all let the model decide what to store, flatten events to embedding-retrievable strings, and have no concept of typed domain events. Rejected.
- Hybrid (harness writes events; model writes preference annotations): preference memory deferred to a later version when the event log is mature enough to derive preferences from behaviour.
