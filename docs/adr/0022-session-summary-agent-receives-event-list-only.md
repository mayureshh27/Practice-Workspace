# SessionSummaryAgent Receives Serialised Event List Only — No Direct Store Access

At session close, the SessionSummaryAgent receives a serialised list of that session's typed
events as its entire input. It has no injected MemoryStore, no GraphLayer, no RetrievalLayer.
It returns a `SessionSummaryCreated` Pydantic model. The harness validates the model against
the session's actual `ConceptMasteryUpdated` events before passing it to the Event Emitter.
The agent never calls `record_event()` directly.

## Considered Options

- **Give the agent store access so it can query richer history**: the agent could look up
  prior summaries, cross-session mastery trends, and source metadata to write a richer
  summary. Rejected because it makes the agent stateful and untestable in isolation. A
  hallucinated `mastery_deltas` field that contradicts the session's actual
  `ConceptMasteryUpdated` events would be written to the event log and silently corrupt future
  context assembly. With event-list-only input, the harness can verify the summary's
  `mastery_deltas` against the input list before storage — a check that is impossible if
  the agent assembled its own view of the session.

## Consequences

The SessionSummaryAgent is the one place in the platform where an LLM call writes to the
event log (indirectly, via the Event Emitter). Making the agent stateless and its output
verifiable against a fixed input is the minimum viable defence against summary hallucination.
The cost decision is also encoded here: one Haiku call at session close, not one per tutor
turn. Any agent that routes the SessionSummaryAgent into the interactive hint loop is
violating this ADR.
