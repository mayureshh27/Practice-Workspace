# Qdrant Is for Source-Chunk Retrieval Only — Memory Events Use SQL Joins, Never Vector Search

The RetrievalLayer (Qdrant) stores and searches source chunks exclusively. All seven typed
memory events are stored in SQLite and retrieved via SQL joins over causal foreign keys
(session_id, concept_id, source_id, artifact_id, attempt_id). No context assembly path
routes memory event retrieval through Qdrant. The two retrieval mechanisms are never mixed.

## Considered Options

- **Unified vector store for all memory and source content** (Mem0, Zep, LangMem pattern):
  embed every memory event as a string factoid alongside source chunks and retrieve both by
  cosine similarity. Rejected because source chunks and memory events are categorically
  different retrieval problems. Source chunks are text-similarity problems — proximity to a
  query string tells you which paragraphs are relevant. Memory events are entity-relationship
  problems — "which attempts caused which mastery change, on which concept, in which session"
  is a causal join query, not a similarity query. Cosine similarity over memory events returns
  semantically similar but causally unrelated events (e.g. a Kalman filter Blind Spot surfaces
  during a PID controller query because both involve control theory). This is a category error,
  not a precision problem fixable with better embeddings.

## Consequences

Cross-store queries — "which concepts have active Blind Spots AND which source chunks contain
remediation material for those concepts?" — require the GraphLayer to traverse from BlindSpot
nodes to Concept nodes, then from Concept nodes to Chunk IDs, before issuing a Qdrant fetch.
This is the correct and intended architecture: the graph is the index that spans all stores.
The one thing this prevents is using a single vector DB as a drop-in memory backend. That is
not a goal of this platform.
