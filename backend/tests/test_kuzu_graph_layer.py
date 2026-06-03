import threading
from datetime import UTC, datetime

import pytest

from app.domain.graph import ConceptCandidate
from app.harness.graph_layer import GraphLayer
from app.harness.kuzu_graph_layer import KuzuGraphLayer


@pytest.fixture
def graph_layer(tmp_path):
    db_path = tmp_path / "kuzu_test.db"
    mastery_path = tmp_path / "mastery_test.db"
    layer = KuzuGraphLayer(
        db_path=db_path,
        mastery_db_path=mastery_path,
        use_graphiti=False,
        fuzzy_threshold=85.0,
    )
    return layer


def test_graph_layer_protocol_runtime_checkable(graph_layer):
    """Verify that KuzuGraphLayer checks out as isinstance(GraphLayer)."""
    assert isinstance(graph_layer, GraphLayer)


def test_schema_version_and_created_at(graph_layer):
    """Verify schema version is written and read correctly, and created_at is non-null."""
    candidates = [
        ConceptCandidate(name="Concurrency", aliases=["concurrent"]),
    ]
    nodes = graph_layer.extract_and_link_concepts("source-1", candidates)
    assert len(nodes) == 1
    concept_id = nodes[0].concept_id

    # Check directly via Cypher
    res = graph_layer.conn.execute(
        "MATCH (c:Concept) WHERE c.concept_id = $id RETURN c.schema_version, c.created_at",
        {"id": concept_id},
    )
    assert res.has_next()
    row = res.get_next()
    assert row[0] == 1  # schema_version
    assert row[1] is not None  # created_at


def test_fuzzy_index_hit_and_miss(graph_layer):
    """Verify in-process fuzzy index hit and miss."""
    candidates = [
        ConceptCandidate(name="Recursion", aliases=["recursive"]),
    ]
    graph_layer.extract_and_link_concepts("source-1", candidates)

    # Hit: recursion resolves to the same node
    res_hit = graph_layer._fuzzy_match_concept("recursive function")
    assert res_hit is not None

    # Miss: different concept below threshold
    res_miss = graph_layer._fuzzy_match_concept("Something completely different")
    assert res_miss is None


def test_batched_cypher_fetch_helper(graph_layer):
    """Verify that _fetch_concepts_by_ids runs a single batch query."""
    candidates = [
        ConceptCandidate(name="Node A"),
        ConceptCandidate(name="Node B"),
    ]
    nodes = graph_layer.extract_and_link_concepts("source-1", candidates)
    ids = [n.concept_id for n in nodes]

    fetched = graph_layer._fetch_concepts_by_ids(ids)
    assert len(fetched) == 2
    fetched_names = {f.canonical_name for f in fetched}
    assert fetched_names == {"Node A", "Node B"}


def test_alias_concurrency_serialization(graph_layer):
    """Verify alias concurrent append serialization via threading."""
    candidates = [
        ConceptCandidate(name="Locking", aliases=["locks"]),
    ]
    nodes = graph_layer.extract_and_link_concepts("source-1", candidates)
    concept_id = nodes[0].concept_id

    def worker(alias_name):
        cand = ConceptCandidate(name="Locking", aliases=[alias_name])
        graph_layer.extract_and_link_concepts("source-worker", [cand])

    threads = []
    for i in range(5):
        t = threading.Thread(target=worker, args=(f"alias-{i}",))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    # Verify all aliases are present
    res = graph_layer.conn.execute(
        "MATCH (c:Concept) WHERE c.concept_id = $id RETURN c.aliases",
        {"id": concept_id},
    )
    assert res.has_next()
    aliases = res.get_next()[0]
    for i in range(5):
        assert f"alias-{i}" in aliases


def test_fk_validation_update_mastery(graph_layer):
    """Verify FK validation rejects non-existent concept IDs."""
    with pytest.raises(ValueError) as excinfo:
        graph_layer.update_mastery("non-existent-id", 0.8, "event-123", datetime.now(UTC))
    assert "does not exist in Concept table" in str(excinfo.value)


def test_two_query_context_traversal(graph_layer):
    """Verify that get_concept_context correctly retrieves concept contexts."""
    # Use distinct names to avoid false fuzzy match merging
    graph_layer.extract_and_link_concepts("source-1", [ConceptCandidate(name="Algebra")])
    graph_layer.extract_and_link_concepts(
        "source-1", [ConceptCandidate(name="Calculus", prerequisite_names=["Algebra"])]
    )
    graph_layer.extract_and_link_concepts(
        "source-1", [ConceptCandidate(name="Geometry", prerequisite_names=["Calculus"])]
    )

    # Find concept IDs
    c_res = graph_layer.conn.execute("MATCH (c:Concept) RETURN c.concept_id, c.canonical_name")
    id_map = {}
    while c_res.has_next():
        row = c_res.get_next()
        id_map[row[1]] = row[0]

    context = graph_layer.get_concept_context([id_map["Geometry"]])
    assert len(context.concepts) == 1
    assert context.concepts[0].canonical_name == "Geometry"

    # Transitive prerequisites: Calculus and Algebra
    prereqs = {p.canonical_name for p in context.prereq_chain}
    assert prereqs == {"Calculus", "Algebra"}


def test_depth_cap_traversal(graph_layer):
    """Verify detect_prerequisite_gaps / get_concept_context is depth-capped at 8."""
    # Use distinct names to avoid false fuzzy match merging
    names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa"]
    graph_layer.extract_and_link_concepts("source-1", [ConceptCandidate(name=names[0])])
    for i in range(1, 10):
        graph_layer.extract_and_link_concepts(
            "source-1",
            [ConceptCandidate(name=names[i], prerequisite_names=[names[i - 1]])],
        )

    # Find concept IDs
    c_res = graph_layer.conn.execute("MATCH (c:Concept) RETURN c.concept_id, c.canonical_name")
    id_map = {}
    while c_res.has_next():
        row = c_res.get_next()
        id_map[row[1]] = row[0]

    context = graph_layer.get_concept_context([id_map["Kappa"]])
    prereq_names = {p.canonical_name for p in context.prereq_chain}
    # Kappa (10th) -> Iota (9th) -> Theta (8th) -> Eta (7th) -> Zeta (6th) -> Epsilon (5th) -> Delta (4th) -> Gamma (3rd) -> Beta (2nd) -> Alpha (1st)
    # Traversal depth is 8. Hop count:
    # 1: Iota
    # 2: Theta
    # 3: Eta
    # 4: Zeta
    # 5: Epsilon
    # 6: Delta
    # 7: Gamma
    # 8: Beta
    # Alpha is 9 hops away, so it should not be in prereq_names.
    assert "Beta" in prereq_names
    assert "Alpha" not in prereq_names
