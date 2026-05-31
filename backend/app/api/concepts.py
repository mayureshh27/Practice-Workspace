"""Concepts API — knowledge graph nodes, edges, and mastery.

GET /api/concepts/graph — all concept nodes with prerequisite edges and mastery scores
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from pydantic import BaseModel

router = APIRouter(prefix="/api/concepts", tags=["concepts"])


class ConceptNodeDTO(BaseModel):
    id: str
    label: str
    mastery: str  # 'mastered' | 'practiced' | 'unseen'


class ConceptEdgeDTO(BaseModel):
    from_id: str
    to_id: str


class ConceptGraphDTO(BaseModel):
    nodes: list[ConceptNodeDTO]
    edges: list[ConceptEdgeDTO]


@router.get("/graph")
def get_concept_graph(request: Request) -> ConceptGraphDTO:
    """Return the full concept knowledge graph with mastery state.

    Queries the graph_layer for all concept nodes and their prerequisite
    edges. Mastery scores are mapped to the three-tier UI badge:
      >= 0.7 → mastered
      >= 0.3 → practiced
      < 0.3  → unseen

    When graph_layer is not wired, returns an empty graph.
    """
    graph_layer = getattr(request.app.state, "graph_layer", None)
    if graph_layer is None:
        return ConceptGraphDTO(nodes=[], edges=[])

    nodes = graph_layer.get_all_concepts()
    result_nodes: list[ConceptNodeDTO] = []
    result_edges: list[ConceptEdgeDTO] = []

    for node in nodes:
        mastery = node.get("mastery_score")
        if mastery is None:
            label = "unseen"
        elif mastery >= 0.7:
            label = "mastered"
        elif mastery >= 0.3:
            label = "practiced"
        else:
            label = "unseen"

        result_nodes.append(
            ConceptNodeDTO(id=node["concept_id"], label=node["canonical_name"], mastery=label)
        )

        for prereq_id in node.get("prerequisite_ids", []):
            result_edges.append(
                ConceptEdgeDTO(from_id=prereq_id, to_id=node["concept_id"])
            )

    return ConceptGraphDTO(nodes=result_nodes, edges=result_edges)
