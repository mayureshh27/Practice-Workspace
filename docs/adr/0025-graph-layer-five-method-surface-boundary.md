# ADR-0025: GraphLayer Five-Method Surface Boundary

## Status

Accepted

## Context

The GraphLayer is the Layer Contract for all graph operations across the Learning
Graph, Source Graph, and Memory Graph. As the product grows, developers will be
tempted to add convenience methods — `get_concept_by_name`, `get_all_prerequisites`,
`find_related_concepts`, `batch_update_mastery`, etc. — directly to the interface,
turning it into a generic graph query surface.

The spike document (`docs/adr/graph-layer-spike.md`) was written to establish the
minimum viable surface: exactly five methods that cover the product's known graph
operations without leaking Kuzu or Graphiti internals. Every gap analysis in the
spike identifies a wrapper-layer concern, not a missing method on the interface.

Adding a method to the GraphLayer surface has real costs:
- Every implementation (Kuzu, Graphiti) must implement it
- Every consumer (Context Gate, Tutor Agent, Ingestion Harness) can call it
- The test surface grows
- The migration surface for a backend swap grows
- The ADR boundary weakens — "we already have 6, what's one more?"

## Decision

The GraphLayer exposes exactly five methods. This is a deliberate architectural
boundary, not a coincidental count.

The five methods are:

1. `extract_and_link_concepts(source_id, concept_candidates) -> list[ConceptNode]`
2. `update_mastery(concept_id, new_score, trigger_event_id, timestamp) -> None`
3. `get_concept_context(concept_ids) -> ConceptContext`
4. `link_exercise_to_concepts(exercise_id, concept_ids) -> None`
5. `detect_prerequisite_gaps(concept_ids) -> list[ConceptNode]`

Method signatures, backend mappings, gap flags, and Kuzu/Graphiti primitive
mappings are documented in `docs/adr/graph-layer-spike.md` and are authoritative.

Adding a sixth method requires a new ADR that:
1. States why the five existing methods are insufficient
2. Demonstrates that the new method cannot be composed from existing methods
3. Updates the spike document with the new method's signature and backend mappings
4. Updates all concrete implementations

## Consequences

- Developers must compose queries from the five existing methods before proposing
  a new one. Most "missing" queries (point-in-time mastery, transitive prereq
  depth limit, alias search) are wrapper-layer concerns, not interface gaps.
- The `graph_layer.py` Protocol file and `kuzu_graph_layer.py` concrete
  implementation both enforce this boundary at the type level.
- Graphiti is never imported outside the graph layer module — the five methods
  are the only contract between the graph backends and the rest of the product.
- Graphiti's `add_episode()` is never used as a mastery update path. The wrapper
  uses `add_entity_edge()` directly (Gap 5 in the spike document). This is
  non-standard Graphiti usage and any Graphiti upgrade that changes the lower-level
  edge API is a breaking change for this layer.

## Related Documents

- `docs/adr/graph-layer-spike.md` — Spike that established the five-method surface
- `backend/app/harness/graph_layer.py` — Protocol interface enforcing the boundary
- `backend/app/harness/kuzu_graph_layer.py` — Concrete implementation
- `docs/adr/0026-mastery-stored-as-graphiti-temporal-edges.md` — Relies on method 2
- `docs/adr/0028-kuzu-owns-learning-source-graphiti-owns-memory.md` — Backend split
