# Mastery history stored as Graphiti temporal edges; raw events are the source of truth; scores are derived

Concept mastery scores are stored as timestamped edges on Concept nodes in the
Memory Graph using Graphiti temporal edge primitives. Each `update_mastery()`
call appends a new edge with attributes `mastery_score`, `trigger_event_id`,
`recorded_at`, `valid_from`, and `valid_to` — it never overwrites a prior edge.
Point-in-time mastery queries filter edges where `recorded_at <= target_timestamp`
and return the most recent. Current score is the edge where `valid_to` is null.

Raw events — `PracticeAttempted` and `ConceptMasteryUpdated` in the SQLite event
log — are the source of truth. The score on a Graphiti edge is derived from the
deterministic update rule (pass → +0.10 capped at 1.0, fail → −0.05 floored at
0.0) and the `trigger_event_id` links each edge back to its source event. If the
scoring algorithm changes — switching from the pass/fail delta rule to SM-2 or
Bayesian Knowledge Tracing — mastery edges are recomputed from raw events and
rebuilt without loss of learning history. Computed scores are never the canonical
record; they are always derivable from events.

The spike found that Graphiti's native `get_node_edges()` may not expose a
`valid_at` filter parameter directly. Where the native API is insufficient the
GraphLayer wrapper fetches all edges for a concept and applies the timestamp
filter in Python. This is documented as Gap 2 in `docs/graph-layer-spike.md`.
The Graphiti edge write uses `add_entity_edge()` directly — not `add_episode()`,
whose narrative text ingestion pipeline is inappropriate for structured mastery
events. See ADR-0025 and Gap 5 in the spike document.

## Considered Options

**Store mastery scores only in SQLite; use the graph only for structure.**
Simpler — avoids the dual-store join. Rejected because point-in-time mastery
queries ("what did the learner know when they started Chapter 4?") are required
for session resume and adaptive prerequisite recommendations. Reconstructing the
score trajectory from the full event log per concept per query is expensive;
the temporal edge gives the answer in a single lookup.

**Store computed scores on the edge; discard raw event references.**
Simpler Graphiti model — no `trigger_event_id` attribute needed. Rejected
because it forecloses algorithm improvement without history loss. The
`trigger_event_id` is the foreign key that makes recomputation from raw events
possible. Without it, a score on an edge is an orphaned number with no audit
trail and no path to retrospective correction.
