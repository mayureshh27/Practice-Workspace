"""Concrete Kuzu Graph Layer implementation.

Utilises embedded local Kuzu database for Concept/Prerequisite structural schema
and Graphiti/Memgraph temporal logs for mastery progression.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import kuzu
import logfire
from rapidfuzz import fuzz, process

from app.domain.graph import ConceptCandidate, ConceptContext, ConceptNode
from app.harness.graph_layer import GraphLayer
from app.harness.temporal_mastery_store import TemporalMasteryStore
from app.storage import data_path


def _default_mastery_store(mastery_db_path: str) -> TemporalMasteryStore:
    """Return the default mastery store.

    If graphiti-core is available, creates a GraphitiMasteryStore.
    Otherwise falls back to TemporalMasteryStore (SQLite).
    """
    try:
        from app.harness.graphiti_mastery_store import GraphitiMasteryStore

        store = GraphitiMasteryStore(db_path=mastery_db_path)
        # Quick smoke test: append and read
        from datetime import datetime

        store.append_mastery_edge("_init_check", 0.0, "_init", datetime.now(UTC))
        store.get_current_score("_init_check")
        logfire.info("GraphitiMasteryStore initialised (graphiti-core Kuzu backend)")
        return store
    except Exception as exc:
        logfire.info(
            "GraphitiMasteryStore not available, falling back to TemporalMasteryStore: {error}",
            error=str(exc),
        )
        return TemporalMasteryStore(db_path=mastery_db_path)


def _execute(
    c: kuzu.Connection, query: str, params: dict[str, Any] | None = None
) -> kuzu.QueryResult:
    return c.execute(query, params)


class KuzuGraphLayer(GraphLayer):
    """Concrete GraphLayer using local Kuzu DB and local Memgraph/Graphiti stubs."""

    def __init__(
        self,
        db_path: str | Path | None = None,
        gap_threshold: float = 0.5,
        mastery_db_path: str | Path | None = None,
        use_graphiti: bool = False,
    ) -> None:
        # Both paths default to backend/data/ (R-2.1) — see
        # TemporalMasteryStore for the rationale on CWD-invariance.
        self.db_path = str(db_path) if db_path is not None else str(data_path("kuzu.db"))
        self.mastery_db_path = (
            str(mastery_db_path) if mastery_db_path is not None else str(data_path("mastery.db"))
        )
        self.gap_threshold = gap_threshold

        parent_dir = os.path.dirname(self.db_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        self.db = kuzu.Database(self.db_path)
        self.conn = kuzu.Connection(self.db)

        self._ensure_schema()

        if use_graphiti:
            self._mastery_store = _default_mastery_store(self.mastery_db_path)
        else:
            self._mastery_store = TemporalMasteryStore(self.mastery_db_path)

    def _ensure_schema(self) -> None:
        try:
            self.conn.execute(
                "CREATE NODE TABLE Concept(concept_id STRING, canonical_name STRING, aliases STRING[], PRIMARY KEY (concept_id))"
            )
            self.conn.execute("CREATE NODE TABLE Source(source_id STRING, PRIMARY KEY (source_id))")
            self.conn.execute(
                "CREATE NODE TABLE Exercise(exercise_id STRING, PRIMARY KEY (exercise_id))"
            )
            self.conn.execute("CREATE REL TABLE PREREQUISITE_OF(FROM Concept TO Concept)")
            self.conn.execute("CREATE REL TABLE APPEARS_IN(FROM Concept TO Source)")
            self.conn.execute("CREATE REL TABLE TARGETS_CONCEPT(FROM Exercise TO Concept)")
            logfire.info("Kuzu graph schema initialized successfully.")
        except Exception:
            pass

    def _fuzzy_match_concept(self, name: str) -> str | None:
        try:
            results = self.conn.execute(
                "MATCH (c:Concept) RETURN c.concept_id, c.canonical_name, c.aliases"
            )
            candidates: list[tuple[str, str]] = []
            id_map: dict[str, str] = {}

            while results.has_next():
                row = results.get_next()
                cid: str = row[0]
                canonical_name: str = row[1]
                aliases: Sequence[str] = row[2]

                candidates.append((canonical_name, cid))
                id_map[canonical_name] = cid

                for alias in aliases:
                    candidates.append((alias, cid))
                    id_map[alias] = cid

            if not candidates:
                return None

            choices = [c[0] for c in candidates]
            match = process.extractOne(name, choices, scorer=fuzz.token_set_ratio)
            if match is not None and match[1] >= 85.0:
                matched_text = match[0]
                matched_id = id_map[matched_text]
                logfire.info(
                    "Fuzzy match resolved '{name}' to Concept '{matched_text}' ({id})",
                    name=name,
                    matched_text=matched_text,
                    id=matched_id,
                )
                return matched_id
        except Exception as exc:
            logfire.warning("Fuzzy alias resolution failed: {error}", error=str(exc))
        return None

    def extract_and_link_concepts(
        self,
        source_id: str,
        concept_candidates: list[ConceptCandidate],
    ) -> list[ConceptNode]:
        _execute(self.conn, "MERGE (s:Source {source_id: $source_id})", {"source_id": source_id})

        nodes: list[ConceptNode] = []
        for candidate in concept_candidates:
            concept_id = self._fuzzy_match_concept(candidate.name)

            if concept_id:
                new_aliases = list(set(candidate.aliases + [candidate.name]))
                _execute(
                    self.conn,
                    "MATCH (c:Concept WHERE c.concept_id = $id) SET c.aliases = $aliases",
                    {"id": concept_id, "aliases": new_aliases},
                )
            else:
                concept_id = str(uuid.uuid4())
                all_aliases = list(set(candidate.aliases + [candidate.name]))
                _execute(
                    self.conn,
                    "CREATE (c:Concept {concept_id: $id, canonical_name: $name, aliases: $aliases})",
                    {"id": concept_id, "name": candidate.name, "aliases": all_aliases},
                )
                logfire.info(
                    "Created new Concept node: {name} ({id})", name=candidate.name, id=concept_id
                )

            _execute(
                self.conn,
                "MATCH (c:Concept WHERE c.concept_id = $cid), (s:Source WHERE s.source_id = $sid) MERGE (c)-[:APPEARS_IN]->(s)",
                {"cid": concept_id, "sid": source_id},
            )

            for prereq_name in candidate.prerequisite_names:
                prereq_id = self._fuzzy_match_concept(prereq_name)
                if prereq_id:
                    _execute(
                        self.conn,
                        "MATCH (target:Concept WHERE target.concept_id = $tid), (prereq:Concept WHERE prereq.concept_id = $pid) MERGE (target)-[:PREREQUISITE_OF]->(prereq)",
                        {"tid": concept_id, "pid": prereq_id},
                    )

            prereq_res = _execute(
                self.conn,
                "MATCH (c:Concept WHERE c.concept_id = $id)-[:PREREQUISITE_OF]->(p:Concept) RETURN p.concept_id",
                {"id": concept_id},
            )
            prereq_ids: list[str] = []
            while prereq_res.has_next():
                prereq_ids.append(str(prereq_res.get_next()[0]))

            nodes.append(
                ConceptNode(
                    concept_id=concept_id,
                    canonical_name=candidate.name,
                    aliases=candidate.aliases,
                    mastery_score=self._get_current_mastery(concept_id),
                    last_updated_at=self._get_last_updated(concept_id),
                    prerequisite_ids=prereq_ids,
                )
            )
        return nodes

    def _get_current_mastery(self, concept_id: str) -> float | None:
        return self._mastery_store.get_current_score(concept_id)

    def _get_last_updated(self, concept_id: str) -> datetime | None:
        return self._mastery_store.get_last_updated(concept_id)

    def update_mastery(
        self,
        concept_id: str,
        new_score: float,
        trigger_event_id: str,
        timestamp: datetime,
    ) -> None:
        self._mastery_store.append_mastery_edge(
            concept_id=concept_id,
            mastery_score=new_score,
            trigger_event_id=trigger_event_id,
            timestamp=timestamp,
        )
        logfire.info(
            "Temporal mastery edge appended for concept {concept_id}: {score}",
            concept_id=concept_id,
            score=new_score,
        )

    def get_concept_context(
        self,
        concept_ids: list[str],
    ) -> ConceptContext:
        concepts: list[ConceptNode] = []
        prereq_chain: list[ConceptNode] = []
        gap_concepts: list[ConceptNode] = []

        for cid in concept_ids:
            c_res = _execute(
                self.conn,
                "MATCH (c:Concept WHERE c.concept_id = $id) RETURN c.canonical_name, c.aliases",
                {"id": cid},
            )
            if c_res.has_next():
                row = c_res.get_next()
                c_name: str = row[0]
                c_aliases: Sequence[str] = row[1]

                p_res = _execute(
                    self.conn,
                    "MATCH (c:Concept WHERE c.concept_id = $id)-[:PREREQUISITE_OF]->(p:Concept) RETURN p.concept_id",
                    {"id": cid},
                )
                prereq_ids: list[str] = []
                while p_res.has_next():
                    prereq_ids.append(str(p_res.get_next()[0]))

                node = ConceptNode(
                    concept_id=cid,
                    canonical_name=c_name,
                    aliases=c_aliases,
                    mastery_score=self._get_current_mastery(cid),
                    last_updated_at=self._get_last_updated(cid),
                    prerequisite_ids=prereq_ids,
                )
                concepts.append(node)

                chain_res = _execute(
                    self.conn,
                    "MATCH (root:Concept WHERE root.concept_id = $id)-[:PREREQUISITE_OF*1..8]->(p:Concept) RETURN p.concept_id, p.canonical_name, p.aliases",
                    {"id": cid},
                )
                while chain_res.has_next():
                    prow = chain_res.get_next()
                    pid: str = str(prow[0])
                    pname: str = prow[1]
                    paliases: Sequence[str] = prow[2]

                    pp_res = _execute(
                        self.conn,
                        "MATCH (c:Concept WHERE c.concept_id = $id)-[:PREREQUISITE_OF]->(p:Concept) RETURN p.concept_id",
                        {"id": pid},
                    )
                    pp_ids: list[str] = []
                    while pp_res.has_next():
                        pp_ids.append(str(pp_res.get_next()[0]))

                    pnode = ConceptNode(
                        concept_id=pid,
                        canonical_name=pname,
                        aliases=paliases,
                        mastery_score=self._get_current_mastery(pid),
                        last_updated_at=self._get_last_updated(pid),
                        prerequisite_ids=pp_ids,
                    )
                    if pnode not in prereq_chain:
                        prereq_chain.append(pnode)
                        score = pnode.mastery_score or 0.0
                        if score < self.gap_threshold:
                            gap_concepts.append(pnode)

        return ConceptContext(
            concepts=concepts,
            prereq_chain=prereq_chain,
            gap_concepts=gap_concepts,
        )

    def link_exercise_to_concepts(
        self,
        exercise_id: str,
        concept_ids: list[str],
    ) -> None:
        _execute(
            self.conn,
            "MERGE (e:Exercise {exercise_id: $id})",
            {"id": exercise_id},
        )
        for cid in concept_ids:
            _execute(
                self.conn,
                "MATCH (e:Exercise WHERE e.exercise_id = $eid), (c:Concept WHERE c.concept_id = $cid) MERGE (e)-[:TARGETS_CONCEPT]->(c)",
                {"eid": exercise_id, "cid": cid},
            )

    def get_mastery_at_time(
        self,
        concept_id: str,
        target_timestamp: datetime,
    ) -> float | None:
        """Return the mastery score for a concept at a specific point in time.

        Per graph-layer-spike.md §154-157: filters edges where
        recorded_at <= target_timestamp and returns the most recent.
        This enables reconstructing mastery state at any prior session boundary.
        """
        return self._mastery_store.get_score_at_time(concept_id, target_timestamp)

    def get_all_concepts(self) -> list[dict[str, Any]]:
        """Return all concept nodes with mastery and prerequisite IDs.

        Used by the concepts/graph API endpoint for the frontend graph panel.
        Not part of the five-method GraphLayer surface (ADR-0025); it is
        an internal helper on the concrete implementation.
        """
        results: list[dict[str, Any]] = []
        c_res = _execute(
            self.conn,
            "MATCH (c:Concept) RETURN c.concept_id, c.canonical_name",
        )
        while c_res.has_next():
            row = c_res.get_next()
            cid: str = row[0]
            cname: str = row[1]

            p_res = _execute(
                self.conn,
                "MATCH (c:Concept WHERE c.concept_id = $id)-[:PREREQUISITE_OF]->(p:Concept) RETURN p.concept_id",
                {"id": cid},
            )
            prereq_ids: list[str] = []
            while p_res.has_next():
                prereq_ids.append(str(p_res.get_next()[0]))

            results.append(
                {
                    "concept_id": cid,
                    "canonical_name": cname,
                    "mastery_score": self._get_current_mastery(cid),
                    "prerequisite_ids": prereq_ids,
                }
            )
        return results

    def detect_prerequisite_gaps(
        self,
        concept_ids: list[str],
    ) -> list[ConceptNode]:
        context = self.get_concept_context(concept_ids)
        return context.gap_concepts
