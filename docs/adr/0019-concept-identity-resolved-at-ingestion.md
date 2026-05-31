# Concept Identity Resolved at Ingestion, Not at Query Time

When a new concept name is extracted from a Learning Source, the GraphLayer checks existing
Concept nodes for canonical-name or alias overlap using a configurable fuzzy-match threshold
before creating a new node. A match reuses the existing node and appends the new alias. No
match creates a new node with the extracted name as canonical. This check happens once,
durably, at ingestion time and is never repeated at query or retrieval time.

## Considered Options

- **Resolve at query time via graph traversal**: when two names appear related during a
  `get_concept_context()` call, merge them on the fly. Rejected because mastery scores
  accumulate on whichever node receives the `ConceptMasteryUpdated` events first. By the time
  a query-time merge runs, mastery history is already split across two nodes. Point-in-time
  mastery queries and Blind Spot detection would return incorrect results for the merged
  concept.
- **Always create a new node and merge later in a compaction pass**: deferred merge can run
  after the corpus is fully ingested. Rejected because mastery events from early sessions
  would already carry the pre-merge concept IDs. Any compaction pass would need to rewrite
  those events — violating the append-only event log invariant.

## Consequences

Concept identity is the earliest irreversible decision in the platform. If this check is
skipped and two nodes are created for what is logically one concept, every downstream
system — mastery scoring, Blind Spot detection, prerequisite traversal, remediation
retrieval — sees a fractured concept. The fuzzy-match threshold is the one configurable
parameter here; it should be locked before the first source is ingested and treated as a
schema migration if it ever changes.
