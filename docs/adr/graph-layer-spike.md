# Graph Layer Spike — Method Signatures, Backend Mappings, and Gap Analysis

Product: Adaptive Practice Workspace
Spike scope: GraphLayer public method surface, Graphiti/Kuzu primitive mapping,
ConceptNode data shape, implementation gaps.
Session: targeted spike prior to writing ADRs 0025–0029.

---

## 1. Method Signatures

All five methods are product-facing. No Graphiti or Kuzu type leaks into these
signatures. `ConceptNode`, `ConceptContext`, and `ConceptCandidate` are
product-owned Pydantic models — not Graphiti or Kuzu native types.

```python
from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel


class ConceptCandidate(BaseModel):
    name: str
    definition: str | None = None
    aliases: list[str] = []
    prerequisite_names: list[str] = []  # resolved to concept_ids by the wrapper


class ConceptNode(BaseModel):
    concept_id: str                    # UUID; stable across all backends
    canonical_name: str
    aliases: list[str]
    mastery_score: float | None        # None if concept has never been practiced
    last_updated_at: datetime | None   # timestamp of most recent mastery edge
    prerequisite_ids: list[str]        # direct prerequisites only


class ConceptContext(BaseModel):
    concepts: list[ConceptNode]
    prerequisite_chain: list[ConceptNode]   # full transitive chain
    gap_concepts: list[ConceptNode]         # prerequisites below gap threshold
```

---

### extract_and_link_concepts

```python
def extract_and_link_concepts(
    source_id: str,
    concept_candidates: list[ConceptCandidate],
) -> list[ConceptNode]:
    """Resolve candidates against existing nodes via fuzzy alias match,
    create new nodes where no match is found, write PREREQUISITE_OF edges,
    and link all nodes to the source."""
```

**Graph(s) touched:** Learning Graph (concept nodes, PREREQUISITE_OF edges),
Source Graph (APPEARS_IN edges from Concept → Source)

---

### update_mastery

```python
def update_mastery(
    concept_id: str,
    new_score: float,
    trigger_event_id: str,
    timestamp: datetime,
) -> None:
    """Append a new timestamped mastery edge on the Concept node in the
    Memory Graph; never overwrites prior edges; score must be in [0.0, 1.0]."""
```

**Graph(s) touched:** Memory Graph (Graphiti temporal edge)

---

### get_concept_context

```python
def get_concept_context(
    concept_ids: list[str],
) -> ConceptContext:
    """Return concept definitions, full transitive prerequisite chain, current
    mastery scores, and gap concepts for the given concept IDs."""
```

**Graph(s) touched:** Learning Graph (prerequisite chain traversal),
Memory Graph (current mastery score per concept node)

---

### link_exercise_to_concepts

```python
def link_exercise_to_concepts(
    exercise_id: str,
    concept_ids: list[str],
) -> None:
    """Write TARGETS_CONCEPT edges from an Exercise node to each Concept node
    in the Source Graph."""
```

**Graph(s) touched:** Source Graph (TARGETS_CONCEPT edges)

---

### detect_prerequisite_gaps

```python
def detect_prerequisite_gaps(
    concept_ids: list[str],
) -> list[ConceptNode]:
    """Traverse PREREQUISITE_OF edges from the given concepts and return all
    prerequisite nodes whose current mastery score is below the configured gap
    threshold (default 0.5). Gap threshold is a GraphLayer constructor
    parameter, not a hardcoded constant."""
```

**Graph(s) touched:** Learning Graph (PREREQUISITE_OF traversal),
Memory Graph (mastery score lookup per prerequisite)

---

## 2. Graphiti API Mapping

Graphiti's primary design is episode-based: `add_episode()` ingests narrative
text and extracts entities and relationships automatically. This does not fit
the Memory Graph use case — mastery updates are structured typed events, not
narrative text. The wrapper uses lower-level Graphiti edge primitives directly,
bypassing episode ingestion. This is non-standard Graphiti usage and is
documented as Gap 5 below.

### update_mastery → Graphiti primitive

Primitive: `graphiti.add_entity_edge()` (direct edge write, not `add_episode`)

Each call writes a new directed edge. Edge attributes:

| Attribute | Value |
|---|---|
| `mastery_score` | float, [0.0, 1.0] |
| `trigger_event_id` | FK to SQLite ConceptMasteryUpdated row |
| `recorded_at` | `timestamp` parameter |
| `valid_from` | same as `recorded_at` |
| `valid_to` | None on creation; set to `recorded_at` of the next edge when a newer one is written |

**Temporal semantics:** Each `update_mastery()` call adds a new edge and sets
`valid_to` on the prior edge to the current `timestamp`. The edge chain is
append-only — no edge is deleted. The full mastery trajectory is preserved.

**Point-in-time query:** Filter edges where `recorded_at <= target_timestamp`,
then take `argmax(recorded_at)`. If Graphiti's native `get_node_edges()` does
not expose a `valid_at` filter, the wrapper fetches all edges for the concept
and applies the filter in Python (see Gap 2).

**Current score:** Most recent edge — the one where `valid_to IS NULL`
(or `valid_to > now`).

### extract_and_link_concepts → Graphiti primitive

**Graphiti not used.** Learning Graph and Source Graph writes go directly to
Kuzu. Graphiti entities for concept nodes are created lazily on the first
`update_mastery()` call, not at ingestion time.

### get_concept_context → Graphiti primitive

Primitive: `graphiti.get_node_edges(entity_id=concept_id)` per concept in the
list. The wrapper reads the `valid_to IS NULL` edge for the current score.

### link_exercise_to_concepts → Graphiti primitive

**Graphiti not used.** Source Graph only — Kuzu direct write.

### detect_prerequisite_gaps → Graphiti primitive

Same mastery lookup as `get_concept_context`: `get_node_edges()` per
prerequisite node returned by the Kuzu traversal, filtered to current score.

---

## 3. Kuzu Query Mapping

### extract_and_link_concepts — Learning Graph

**Create or reuse Concept node:**
```cypher
MERGE (c:Concept {concept_id: $concept_id})
ON CREATE SET
    c.canonical_name = $canonical_name,
    c.aliases        = $aliases
ON MATCH SET
    c.aliases = list_distinct(list_concat(c.aliases, $new_aliases))
```

**Write PREREQUISITE_OF edges:**
```cypher
MATCH (target:Concept {concept_id: $target_id})
MATCH (prereq:Concept  {concept_id: $prereq_id})
MERGE (target)-[:PREREQUISITE_OF]->(prereq)
```

### extract_and_link_concepts — Source Graph

**Link Concept → Source:**
```cypher
MERGE (s:Source  {source_id:  $source_id})
MERGE (c:Concept {concept_id: $concept_id})
MERGE (c)-[:APPEARS_IN]->(s)
```

### get_concept_context — Learning Graph prerequisite chain

```cypher
MATCH (root:Concept)
WHERE root.concept_id IN $concept_ids
MATCH path = (root)-[:PREREQUISITE_OF*1..8]->(prereq:Concept)
RETURN DISTINCT
    prereq.concept_id    AS concept_id,
    prereq.canonical_name AS canonical_name,
    prereq.aliases        AS aliases
```

Depth cap of 8 prevents runaway traversal on malformed ingestion graphs.
The wrapper enforces the cap at the query level, not as a runtime guard.

### detect_prerequisite_gaps — Learning Graph traversal

```cypher
MATCH (root:Concept)
WHERE root.concept_id IN $concept_ids
MATCH (root)-[:PREREQUISITE_OF*1..]->(prereq:Concept)
RETURN DISTINCT
    prereq.concept_id    AS concept_id,
    prereq.canonical_name AS canonical_name,
    prereq.aliases        AS aliases
```

After retrieval, the wrapper calls Graphiti for current mastery per
`concept_id` and filters to those below the configured gap threshold.

### link_exercise_to_concepts — Source Graph

```cypher
MERGE (e:Exercise {exercise_id: $exercise_id})
WITH e
UNWIND $concept_ids AS cid
MATCH (c:Concept {concept_id: cid})
MERGE (e)-[:TARGETS_CONCEPT]->(c)
```

---

## 4. ConceptNode Data Shape

| Field | Stored in | Notes |
|---|---|---|
| `concept_id` | Kuzu node property | UUID, stable. Shared identifier across Kuzu, Graphiti, and SQLite |
| `canonical_name` | Kuzu node property | Preferred term from primary source |
| `aliases` | Kuzu node array property | All other names seen across sources; includes merged aliases |
| `mastery_score` | Derived — Graphiti edges | `None` if no mastery edge exists (never practiced) |
| `last_updated_at` | Derived — Graphiti edges | Timestamp of most recent mastery edge |
| `prerequisite_ids` | Derived — Kuzu PREREQUISITE_OF edges | Direct prerequisites only; transitive chain built by query |

**Kuzu stores:** `concept_id`, `canonical_name`, `aliases`, structural edges
(PREREQUISITE_OF, APPEARS_IN, TARGETS_CONCEPT).

**Graphiti stores:** temporal mastery edges with `mastery_score`,
`trigger_event_id`, `recorded_at`, `valid_from`, `valid_to`.

**GraphLayer wrapper derives:** `mastery_score` and `last_updated_at` from
Graphiti edges; `prerequisite_ids` from Kuzu PREREQUISITE_OF edges.

---

## 5. Gap Flags

### Gap 1 — Fuzzy alias matching

**Owner:** GraphLayer wrapper (Learning Graph path)

Neither Graphiti nor Kuzu provides native fuzzy string matching. Before
creating a new Concept node the wrapper must:
1. Fetch all existing canonical names and alias arrays from Kuzu.
2. Run token-set-ratio comparison in Python (RapidFuzz or equivalent) against
   the new candidate name and all of its aliases.
3. If score ≥ threshold: reuse existing node, append alias.
4. If score < threshold: create new node.

At large corpus sizes (>10,000 concepts) the candidate-list fetch may require
a pre-indexed alias map maintained in the wrapper, or a lightweight SQLite FTS
fallback, to remain sub-second.

### Gap 2 — Point-in-time mastery queries

**Owner:** GraphLayer wrapper (Memory Graph path)

Graphiti's `get_node_edges()` may not expose a `valid_at` filter parameter
directly. Where the native API is insufficient the wrapper fetches all mastery
edges for a concept and filters `recorded_at <= target_timestamp` in Python,
then returns `argmax(recorded_at)`. For high-frequency learners with many edges
per concept, a time-window bound on the fetch may be needed.

### Gap 3 — Cross-graph joins (Learning + Memory)

**Owner:** GraphLayer wrapper

Queries that combine prerequisite topology (Kuzu, Learning Graph) with mastery
scores (Graphiti, Memory Graph) require two sequential queries joined in Python.
`detect_prerequisite_gaps()` and `get_concept_context()` both have this
pattern. No native cross-graph join exists between Kuzu and Graphiti.

### Gap 4 — concept_id consistency across backends

**Owner:** GraphLayer wrapper

The same `concept_id` UUID must identify the same entity in Kuzu and Graphiti.
No native referential integrity exists between them. The wrapper enforces this
at write time: a `concept_id` is generated once by `extract_and_link_concepts`
and stored in Kuzu. Subsequent `update_mastery()` calls use that ID for Graphiti
edge writes. The wrapper must never generate a new `concept_id` for an already-
known concept.

### Gap 5 — Episode API bypass

**Owner:** GraphLayer wrapper (Memory Graph path)

Graphiti's primary ingestion path is `add_episode()`, which expects narrative
text and runs entity extraction internally. Mastery updates are structured typed
events — not narrative text. The wrapper uses `add_entity_edge()` directly to
bypass episode ingestion. This is non-standard Graphiti usage. Any Graphiti
upgrade that changes the lower-level edge API is a breaking change for this
layer. ADR-0025 is the explicit stop sign preventing developers from
"simplifying" to `add_episode()` in future.

### Gap 6 — Alias array mutation in Kuzu

**Owner:** GraphLayer wrapper (Learning Graph path)

Kuzu stores `aliases` as an array property. Appending a new alias to an
existing array requires a read-modify-write:

```cypher
SET c.aliases = list_distinct(list_concat(c.aliases, $new_aliases))
```

There is no native append-to-array operation. The wrapper must ensure this is
effectively atomic at the application level (single writer for concept
mutations during ingestion).
