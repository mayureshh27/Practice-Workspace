"""Graph Layer — Layer Contract for Learning Graph, Source Graph, and Memory Graph.

Five product-owned methods (graph-layer-spike.md §1). Graphiti and Kuzu are
**never imported outside this module** (CONTEXT.md, ADR-0001, ADR-0028).

Backend-to-subgraph assignment (ADR-0028):
  Kuzu → Learning Graph + Source Graph (structural Cypher queries)
  Graphiti → Memory Graph (temporal mastery edges via add_entity_edge)

The gap threshold is a constructor parameter (ADR-0029, default 0.5).
Adding a sixth method requires updating ADR-0025.

Implementation gaps documented in graph-layer-spike.md §5:
  Gap 1 — Fuzzy alias matching (RapidFuzz in wrapper)
  Gap 2 — Point-in-time mastery queries (Python filter on Graphiti edges)
  Gap 3 — Cross-graph joins (Kuzu + Graphiti joined in wrapper)
  Gap 4 — concept_id consistency (wrapper enforces at write time)
  Gap 5 — Episode API bypass (use add_entity_edge, never add_episode)
  Gap 6 — Alias array mutation (read-modify-write in Kuzu)
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol, runtime_checkable

from app.domain.graph import ConceptCandidate, ConceptContext, ConceptNode


@runtime_checkable
class GraphLayer(Protocol):
    """Product-owned graph interface.

    Five methods only — the deliberate boundary per ADR-0025.
    """

    def extract_and_link_concepts(
        self,
        source_id: str,
        concept_candidates: list[ConceptCandidate],
    ) -> list[ConceptNode]:
        """Resolve candidates via fuzzy alias match (ADR-0027), create new
        nodes where no match, write PREREQUISITE_OF edges, link to source.

        Graphs touched: Learning Graph (Kuzu), Source Graph (Kuzu).
        """
        ...

    def update_mastery(
        self,
        concept_id: str,
        new_score: float,
        trigger_event_id: str,
        timestamp: datetime,
    ) -> None:
        """Append a new timestamped mastery edge — never overwrite prior edges.

        Uses add_entity_edge() directly, never add_episode() (ADR-0026, Gap 5).
        Score must be in [0.0, 1.0]. trigger_event_id is the FK to the
        ConceptMasteryUpdated SQLite row.

        Graph touched: Memory Graph (Graphiti temporal edge).
        """
        ...

    def get_concept_context(
        self,
        concept_ids: list[str],
    ) -> ConceptContext:
        """Return concept definitions, full transitive prerequisite chain
        (depth-capped at 8), current mastery scores, and gap concepts.

        Graphs touched: Learning Graph (Kuzu prerequisite traversal),
        Memory Graph (Graphiti mastery lookup per concept).
        """
        ...

    def link_exercise_to_concepts(
        self,
        exercise_id: str,
        concept_ids: list[str],
    ) -> None:
        """Write TARGETS_CONCEPT edges from an Exercise node to Concept nodes.

        Graph touched: Source Graph (Kuzu).
        """
        ...

    def detect_prerequisite_gaps(
        self,
        concept_ids: list[str],
    ) -> list[ConceptNode]:
        """Traverse PREREQUISITE_OF edges and return prerequisites below the
        configured gap threshold (ADR-0029, default 0.5).

        Graphs touched: Learning Graph (Kuzu traversal),
        Memory Graph (Graphiti mastery lookup per prerequisite).
        """
        ...
