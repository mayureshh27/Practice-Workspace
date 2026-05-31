"""Product-owned graph domain models.

These types are the interface between the GraphLayer and the rest of the
application. No Graphiti or Kuzu types leak into these models — they are
plain Pydantic models owned by the product (graph-layer-spike.md §1).

Storage backend mapping (ADR-0028):
  - Kuzu stores: concept_id, canonical_name, aliases, structural edges
    (PREREQUISITE_OF, APPEARS_IN, TARGETS_CONCEPT)
  - Graphiti stores: temporal mastery edges with mastery_score,
    trigger_event_id, recorded_at, valid_from, valid_to (ADR-0026)
  - GraphLayer wrapper derives: mastery_score and last_updated_at from
    Graphiti edges; prerequisite_ids from Kuzu PREREQUISITE_OF edges
"""

from datetime import datetime

from pydantic import BaseModel


class ConceptCandidate(BaseModel):
    """A concept extracted from a Learning Source, before identity resolution.

    The GraphLayer resolves candidates against existing Concept Nodes via
    fuzzy alias matching (ADR-0027, token-set-ratio, configurable threshold)
    before creating new nodes.
    """

    name: str
    definition: str | None = None
    aliases: list[str] = []
    prerequisite_names: list[str] = []  # resolved to concept_ids by wrapper


class ConceptNode(BaseModel):
    """A resolved concept in the Knowledge Graph.

    Per ADR-0027: carries canonical_name (preferred term from primary source)
    plus aliases (all other names seen across sources). The concept_id is a
    stable UUID shared across Kuzu, Graphiti, and SQLite.

    Per ADR-0026: mastery_score is derived from Graphiti temporal edges,
    not stored as a flat property on the Kuzu node.
    """

    concept_id: str  # UUID; stable across all backends
    canonical_name: str
    aliases: list[str] = []
    mastery_score: float | None = None  # None if concept has never been practiced
    last_updated_at: datetime | None = None  # timestamp of most recent mastery edge
    prerequisite_ids: list[str] = []  # direct prerequisites only


class ConceptContext(BaseModel):
    """Assembled context for a set of concepts — returned by GraphLayer.get_concept_context().

    Includes the concepts themselves, the full transitive prerequisite chain
    (depth-capped at 8 per graph-layer-spike §3), and Prerequisite Gap concepts
    whose mastery falls below the configurable gap threshold (ADR-0029, default 0.5).
    """

    concepts: list[ConceptNode] = []
    prerequisite_chain: list[ConceptNode] = []  # full transitive chain
    gap_concepts: list[ConceptNode] = []  # prerequisites below gap threshold
