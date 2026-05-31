# Kuzu owns Learning Graph and Source Graph; Graphiti owns Memory Graph

ADR-0001 establishes that the Graph Layer starts with Graphiti and Kuzu but
does not specify which backend is responsible for which subgraph. The spike
revealed that the backend-to-subgraph assignment is a concrete architectural
decision with consequences that are not implied by the general technology choice.
This ADR specifies the split.

**Kuzu** is the backend for Learning Graph and Source Graph. Both graphs are
predominantly static after ingestion: concepts, prerequisites, domain hierarchy,
chunk-to-source provenance, and exercise-to-concept links are written once and
read frequently. Kuzu's embedded Cypher query engine is well-suited to this
pattern — it provides structural graph queries (multi-hop PREREQUISITE_OF
traversals, APPEARS_IN joins) without operational overhead.

**Graphiti**, layered on top of Kuzu, owns the Memory Graph. Mastery edges are
temporal — each `update_mastery()` call appends a new timestamped edge. Graphiti
provides the temporal edge primitives (`valid_from`, `valid_to`, edge history)
that make point-in-time mastery queries possible. Learning Graph and Source Graph
do not require temporal semantics, so they query Kuzu directly without the
Graphiti layer.

The consequence of this split is that the GraphLayer module must coordinate two
different write paths: structural Cypher writes via the Kuzu client, and temporal
edge writes via Graphiti primitives. Every method that touches both Learning Graph
and Memory Graph (specifically `get_concept_context` and `detect_prerequisite_gaps`)
must execute two sequential queries from different backends and join the results
in the wrapper layer. This coordination is the price of using the right tool for
each subgraph's data shape.

## Considered Options

**Use Graphiti for all three subgraphs.**
Graphiti can use Kuzu as its storage engine, so this is technically possible.
Rejected because Graphiti's episode-based API is designed for temporal narrative
data. Forcing static concept topology and source provenance through the episode
ingestion pipeline would introduce unnecessary LLM extraction steps, add latency
to ingestion writes, and obscure the structural graph queries with Graphiti's
entity abstraction layer.

**Use Kuzu directly for all three subgraphs; implement temporal edges manually.**
Maximum control over schema. Rejected because building temporal edge semantics
(`valid_from`, `valid_to`, point-in-time query support) on top of raw Kuzu
arrays is significant custom work that Graphiti already provides. Graphiti's
value is precisely the temporal layer it adds to Kuzu for Memory Graph data.
