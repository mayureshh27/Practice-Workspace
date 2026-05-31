"""Concrete Kuzu Graph Layer implementation.

Utilises embedded local Kuzu database for Concept/Prerequisite structural schema
and Graphiti/Memgraph temporal logs for mastery progression.
"""

from __future__ import annotations
import os
import uuid
from datetime import datetime
import logfire
import kuzu
from rapidfuzz import process, fuzz

from app.domain.graph import ConceptCandidate, ConceptContext, ConceptNode
from app.harness.graph_layer import GraphLayer

class KuzuGraphLayer:
    """Concrete GraphLayer using local Kuzu DB and local Memgraph/Graphiti stubs."""

    def __init__(self, db_path: str = "storage/kuzu.db", gap_threshold: float = 0.5):
        self.db_path = db_path
        self.gap_threshold = gap_threshold
        
        # Initialise local embedded Kuzu DB (ensure parent dir exists)
        parent_dir = os.path.dirname(db_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        self.db = kuzu.Database(db_path)
        self.conn = kuzu.Connection(self.db)
        
        self._ensure_schema()
        
        # Temporal mastery store backing Graphiti/Memgraph temporal mastery edges locally
        # Keys: concept_id -> list of mastery dictionaries (temporal mastery edges)
        self._temporal_mastery: dict[str, list[dict]] = {}

    def _ensure_schema(self):
        try:
            # Create Node Tables
            self.conn.execute("CREATE NODE TABLE Concept(concept_id STRING, canonical_name STRING, aliases STRING[], PRIMARY KEY (concept_id))")
            self.conn.execute("CREATE NODE TABLE Source(source_id STRING, PRIMARY KEY (source_id))")
            self.conn.execute("CREATE NODE TABLE Exercise(exercise_id STRING, PRIMARY KEY (exercise_id))")
            
            # Create Relationship Tables
            self.conn.execute("CREATE REL TABLE PREREQUISITE_OF(FROM Concept TO Concept)")
            self.conn.execute("CREATE REL TABLE APPEARS_IN(FROM Concept TO Source)")
            self.conn.execute("CREATE REL TABLE TARGETS_CONCEPT(FROM Exercise TO Concept)")
            logfire.info("Kuzu graph schema initialized successfully.")
        except Exception:
            # Schema already exists, ignore
            pass

    def _fuzzy_match_concept(self, name: str) -> str | None:
        """Gap 1: Fuzzy alias resolution using RapidFuzz."""
        try:
            results = self.conn.execute("MATCH (c:Concept) RETURN c.concept_id, c.canonical_name, c.aliases")
            candidates = []
            id_map = {}
            
            while results.has_next():
                row = results.get_next()
                cid, canonical_name, aliases = row[0], row[1], row[2]
                
                # Check canonical name
                candidates.append((canonical_name, cid))
                id_map[canonical_name] = cid
                
                # Check aliases
                for alias in aliases:
                    candidates.append((alias, cid))
                    id_map[alias] = cid
            
            if not candidates:
                return None
                
            choices = [c[0] for c in candidates]
            match = process.extractOne(name, choices, scorer=fuzz.token_set_ratio)
            if match and match[1] >= 85.0:
                matched_text = match[0]
                matched_id = id_map[matched_text]
                logfire.info("Fuzzy match resolved '{name}' to Concept '{matched_text}' ({id})", name=name, matched_text=matched_text, id=matched_id)
                return matched_id
        except Exception as exc:
            logfire.warn("Fuzzy alias resolution failed: {error}", error=str(exc))
        return None

    def extract_and_link_concepts(
        self,
        source_id: str,
        concept_candidates: list[ConceptCandidate],
    ) -> list[ConceptNode]:
        """Fuzzy match, create new Concept nodes in Kuzu, and link to Source."""
        # Ensure Source exists
        self.conn.execute(f"MERGE (s:Source {{source_id: '{source_id}'}})")
        
        nodes = []
        for candidate in concept_candidates:
            # 1. Fuzzy match
            concept_id = self._fuzzy_match_concept(candidate.name)
            
            if concept_id:
                # Update existing aliases
                new_aliases = list(set(candidate.aliases + [candidate.name]))
                escaped_aliases = str(new_aliases).replace("'", '"')
                self.conn.execute(
                    f"MATCH (c:Concept {{concept_id: '{concept_id}'}}) "
                    f"SET c.aliases = {escaped_aliases}"
                )
            else:
                # Create brand new Concept
                concept_id = str(uuid.uuid4())
                all_aliases = list(set(candidate.aliases + [candidate.name]))
                escaped_aliases = str(all_aliases).replace("'", '"')
                self.conn.execute(
                    f"CREATE (c:Concept {{concept_id: '{concept_id}', "
                    f"canonical_name: '{candidate.name}', aliases: {escaped_aliases}}})"
                )
                logfire.info("Created new Concept node: {name} ({id})", name=candidate.name, id=concept_id)

            # Link Concept -> Source
            self.conn.execute(
                f"MATCH (c:Concept {{concept_id: '{concept_id}'}}), (s:Source {{source_id: '{source_id}'}}) "
                f"MERGE (c)-[:APPEARS_IN]->(s)"
            )
            
            # Resolve prerequisites in structural Cypher
            for prereq_name in candidate.prerequisite_names:
                prereq_id = self._fuzzy_match_concept(prereq_name)
                if prereq_id:
                    self.conn.execute(
                        f"MATCH (target:Concept {{concept_id: '{concept_id}'}}), "
                        f"(prereq:Concept {{concept_id: '{prereq_id}'}}) "
                        f"MERGE (target)-[:PREREQUISITE_OF]->(prereq)"
                    )
            
            # Pull direct prerequisites
            prereq_res = self.conn.execute(
                f"MATCH (c:Concept {{concept_id: '{concept_id}'}})-[:PREREQUISITE_OF]->(p:Concept) "
                f"RETURN p.concept_id"
            )
            prereq_ids = []
            while prereq_res.has_next():
                prereq_ids.append(prereq_res.get_next()[0])

            nodes.append(
                ConceptNode(
                    concept_id=concept_id,
                    canonical_name=candidate.name,
                    aliases=candidate.aliases,
                    mastery_score=self._get_current_mastery(concept_id),
                    last_updated_at=self._get_last_updated(concept_id),
                    prerequisite_ids=prereq_ids
                )
            )
        return nodes

    def _get_current_mastery(self, concept_id: str) -> float | None:
        edges = self._temporal_mastery.get(concept_id, [])
        if not edges:
            return None
        # ARGMAX recorded_at
        sorted_edges = sorted(edges, key=lambda e: e["recorded_at"])
        return sorted_edges[-1]["mastery_score"]

    def _get_last_updated(self, concept_id: str) -> datetime | None:
        edges = self._temporal_mastery.get(concept_id, [])
        if not edges:
            return None
        sorted_edges = sorted(edges, key=lambda e: e["recorded_at"])
        return sorted_edges[-1]["recorded_at"]

    def update_mastery(
        self,
        concept_id: str,
        new_score: float,
        trigger_event_id: str,
        timestamp: datetime,
    ) -> None:
        """Gap 5: Direct edge writing. Append temporal mastery edge."""
        if not (0.0 <= new_score <= 1.0):
            raise ValueError("Score must be in [0.0, 1.0]")
            
        edge = {
            "mastery_score": new_score,
            "trigger_event_id": trigger_event_id,
            "recorded_at": timestamp,
            "valid_from": timestamp,
            "valid_to": None
        }
        
        if concept_id not in self._temporal_mastery:
            self._temporal_mastery[concept_id] = []
            
        # Update valid_to on prior edge
        if self._temporal_mastery[concept_id]:
            self._temporal_mastery[concept_id][-1]["valid_to"] = timestamp
            
        self._temporal_mastery[concept_id].append(edge)
        logfire.info("Temporal mastery edge appended for concept {concept_id}: {score}", concept_id=concept_id, score=new_score)

    def get_concept_context(
        self,
        concept_ids: list[str],
    ) -> ConceptContext:
        """Structural prerequisite chain retrieval + mastery joins."""
        concepts = []
        prereq_chain = []
        gap_concepts = []
        
        for cid in concept_ids:
            # Query concept node details
            c_res = self.conn.execute(f"MATCH (c:Concept {{concept_id: '{cid}'}}) RETURN c.canonical_name, c.aliases")
            if c_res.has_next():
                row = c_res.get_next()
                c_name, c_aliases = row[0], row[1]
                
                # Fetch direct prereqs
                p_res = self.conn.execute(
                    f"MATCH (c:Concept {{concept_id: '{cid}'}})-[:PREREQUISITE_OF]->(p:Concept) "
                    f"RETURN p.concept_id"
                )
                prereq_ids = []
                while p_res.has_next():
                    prereq_ids.append(p_res.get_next()[0])
                    
                node = ConceptNode(
                    concept_id=cid,
                    canonical_name=c_name,
                    aliases=c_aliases,
                    mastery_score=self._get_current_mastery(cid),
                    last_updated_at=self._get_last_updated(cid),
                    prerequisite_ids=prereq_ids
                )
                concepts.append(node)
                
                # Prerequisite transitive chain (depth 8)
                chain_res = self.conn.execute(
                    f"MATCH (root:Concept {{concept_id: '{cid}'}})-[:PREREQUISITE_OF*1..8]->(p:Concept) "
                    f"RETURN p.concept_id, p.canonical_name, p.aliases"
                )
                while chain_res.has_next():
                    prow = chain_res.get_next()
                    pid, pname, paliases = prow[0], prow[1], prow[2]
                    
                    pp_res = self.conn.execute(
                        f"MATCH (c:Concept {{concept_id: '{pid}'}})-[:PREREQUISITE_OF]->(p:Concept) "
                        f"RETURN p.concept_id"
                    )
                    pp_ids = []
                    while pp_res.has_next():
                        pp_ids.append(pp_res.get_next()[0])
                        
                    pnode = ConceptNode(
                        concept_id=pid,
                        canonical_name=pname,
                        aliases=paliases,
                        mastery_score=self._get_current_mastery(pid),
                        last_updated_at=self._get_last_updated(pid),
                        prerequisite_ids=pp_ids
                    )
                    if pnode not in prereq_chain:
                        prereq_chain.append(pnode)
                        
                        # Check gap threshold
                        score = pnode.mastery_score or 0.0
                        if score < self.gap_threshold:
                            gap_concepts.append(pnode)
                            
        return ConceptContext(
            concepts=concepts,
            prereq_chain=prereq_chain,
            gap_concepts=gap_concepts
        )

    def link_exercise_to_concepts(
        self,
        exercise_id: str,
        concept_ids: list[str],
    ) -> None:
        self.conn.execute(f"MERGE (e:Exercise {{exercise_id: '{exercise_id}'}})")
        for cid in concept_ids:
            self.conn.execute(
                f"MATCH (e:Exercise {{exercise_id: '{exercise_id}'}}), (c:Concept {{concept_id: '{cid}'}}) "
                f"MERGE (e)-[:TARGETS_CONCEPT]->(c)"
            )

    def detect_prerequisite_gaps(
        self,
        concept_ids: list[str],
    ) -> list[ConceptNode]:
        context = self.get_concept_context(concept_ids)
        return context.gap_concepts
