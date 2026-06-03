"""Graphiti-backed temporal mastery store.

Uses graphiti-core's low-level EntityEdge API (not add_episode()) to store
mastery updates as temporal edges between Entity nodes. Each concept is
represented as an Entity node; each mastery update appends an EntityEdge
with valid_at/invalid_at timestamps and mastery_score in the attributes dict.

Per ADR-0028 and graph-layer-spike.md Gap 5:
  - Never uses add_episode() (narrative extraction path)
  - Uses EntityEdge.save() directly
  - Operates on a separate Kuzu database from the structural graph

Provides a synchronous interface compatible with KuzuGraphLayer by running
Graphiti's async calls on an internal event loop.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.storage import data_path

logger = logging.getLogger(__name__)

_HAS_GRAPHITI = False
try:
    from graphiti_core.edges import EntityEdge
    from graphiti_core.nodes import EntityNode

    _HAS_GRAPHITI = True
except ImportError:
    EntityEdge: Any = None  # type: ignore[no-redef]
    EntityNode: Any = None  # type: ignore[no-redef]


def _naive(dt: datetime | None) -> datetime | None:
    """Normalize to naive UTC for comparison with Graphiti stored timestamps."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(UTC).replace(tzinfo=None)
    return dt


class GraphitiMasteryStore:
    """Synchronous mastery store backed by graphiti-core's entity edge API.

    Runs async graphiti_core calls on a dedicated event loop thread,
    keeping the public interface synchronous so KuzuGraphLayer doesn't
    need to become async.
    """

    def __init__(
        self,
        db_path: str | Path | None = None,
        group_id: str = "practice-tool-mastery",
    ) -> None:
        # Default to backend/data/kuzu_graphiti.db (R-2.1) — see
        # TemporalMasteryStore for the rationale on CWD-invariance.
        self._db_path = Path(db_path) if db_path is not None else data_path("kuzu_graphiti.db")
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._group_id = group_id
        self._driver: Any = None
        self._initialised = False
        self._concept_nodes: dict[str, str] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def _run_async(self, coro) -> Any:  # type: ignore
        """Run an async coroutine synchronously."""
        if self._loop is None or self._loop.is_closed():
            self._loop = asyncio.new_event_loop()
        return self._loop.run_until_complete(coro)

    def _ensure_init(self) -> None:
        if self._initialised:
            return
        if not _HAS_GRAPHITI:
            raise RuntimeError(
                "graphiti-core is not installed. Install with: uv add graphiti-core[kuzu]"
            )
        self._run_async(self._async_init())

    async def _async_init(self) -> None:
        from graphiti_core.driver.kuzu_driver import KuzuDriver

        self._driver = KuzuDriver(db=str(self._db_path))

        # Load existing entity nodes into cache
        nodes = await EntityNode.get_by_group_ids(self._driver, [self._group_id])
        for node in nodes:
            self._concept_nodes[node.name] = node.uuid

        self._initialised = True

    def _ensure_concept_node(self, concept_id: str) -> str:
        """Get or create an Entity node for a concept."""
        if concept_id in self._concept_nodes:
            return self._concept_nodes[concept_id]

        uuid = self._run_async(self._async_ensure_concept_node(concept_id))
        self._concept_nodes[concept_id] = uuid
        return uuid  # type: ignore

    async def _async_get_node_uuid(self, concept_id: str) -> str | None:
        if concept_id in self._concept_nodes:
            return self._concept_nodes[concept_id]
        nodes = await EntityNode.get_by_group_ids(self._driver, [self._group_id])
        for node in nodes:
            self._concept_nodes[node.name] = node.uuid
        return self._concept_nodes.get(concept_id)

    async def _async_ensure_concept_node(self, concept_id: str) -> str:
        # Check if node already exists
        uuid = await self._async_get_node_uuid(concept_id)
        if uuid is not None:
            return uuid

        entity = EntityNode(
            name=concept_id,
            group_id=self._group_id,
            labels=["concept"],
            created_at=datetime.now(UTC),
        )
        await entity.save(self._driver)
        self._concept_nodes[concept_id] = entity.uuid
        return entity.uuid

    def append_mastery_edge(
        self,
        concept_id: str,
        mastery_score: float,
        trigger_event_id: str,
        timestamp: datetime,
    ) -> None:
        """Append a temporal mastery edge via Graphiti EntityEdge."""
        if not (0.0 <= mastery_score <= 1.0):
            raise ValueError(f"Mastery score must be in [0.0, 1.0], got {mastery_score}")
        self._ensure_init()
        self._run_async(
            self._async_append_mastery_edge(
                concept_id,
                mastery_score,
                trigger_event_id,
                timestamp,
            )
        )

    async def _async_append_mastery_edge(
        self,
        concept_id: str,
        mastery_score: float,
        trigger_event_id: str,
        timestamp: datetime,
    ) -> None:
        source_uuid = await self._async_ensure_concept_node(concept_id)

        # Invalidate prior active edges
        prior_edges = await EntityEdge.get_by_node_uuid(self._driver, source_uuid)
        for edge in prior_edges:
            if edge.invalid_at is None:
                edge.invalid_at = _naive(timestamp)
                await edge.save(self._driver)

        # Create the new edge
        edge = EntityEdge(
            name="mastery_update",
            fact=f"Mastery score for {concept_id} updated to {mastery_score}",
            source_node_uuid=source_uuid,
            target_node_uuid=source_uuid,
            group_id=self._group_id,
            created_at=timestamp,
            valid_at=timestamp,
            invalid_at=None,
            attributes={
                "mastery_score": mastery_score,
                "trigger_event_id": trigger_event_id,
            },
        )
        await edge.save(self._driver)
        # Cache invalidation hook for cross-process visibility
        self._concept_nodes.clear()

        logger.info(
            "Graphiti mastery edge appended for %s: %s",
            concept_id,
            mastery_score,
        )

    def get_current_score(self, concept_id: str) -> float | None:
        """Return the most recent mastery score for a concept."""
        if not self._initialised:
            return None
        return self._run_async(self._async_get_current_score(concept_id))  # type: ignore

    async def _async_get_current_score(self, concept_id: str) -> float | None:
        uuid = await self._async_get_node_uuid(concept_id)
        if uuid is None:
            return None
        edges = await EntityEdge.get_by_node_uuid(self._driver, uuid)
        for edge in edges:
            if edge.invalid_at is None:
                score = edge.attributes.get("mastery_score")
                if score is not None:
                    return float(score)
        return None

    def get_score_at_time(
        self,
        concept_id: str,
        target_timestamp: datetime,
    ) -> float | None:
        """Return the mastery score at a specific point in time."""
        if not self._initialised:
            return None
        return self._run_async(self._async_get_score_at_time(concept_id, target_timestamp))  # type: ignore

    async def _async_get_score_at_time(
        self,
        concept_id: str,
        target_timestamp: datetime,
    ) -> float | None:
        uuid = await self._async_get_node_uuid(concept_id)
        if uuid is None:
            return None
        edges = await EntityEdge.get_by_node_uuid(self._driver, uuid)
        target = _naive(target_timestamp)
        valid = [
            e
            for e in edges
            if e.valid_at
            and e.valid_at <= target
            and (e.invalid_at is None or e.invalid_at > target)
        ]
        if not valid:
            return None
        best = max(valid, key=lambda e: e.valid_at or datetime.min)
        score = best.attributes.get("mastery_score")
        return float(score) if score is not None else None

    def get_last_updated(self, concept_id: str) -> datetime | None:
        """Return the timestamp of the most recent mastery edge."""
        if not self._initialised:
            return None
        return self._run_async(self._async_get_last_updated(concept_id))  # type: ignore

    async def _async_get_last_updated(self, concept_id: str) -> datetime | None:
        uuid = await self._async_get_node_uuid(concept_id)
        if uuid is None:
            return None
        edges = await EntityEdge.get_by_node_uuid(self._driver, uuid)
        if not edges:
            return None
        best = max(edges, key=lambda e: e.created_at or datetime.min)
        return best.created_at  # type: ignore

    def get_all_edges(self, concept_id: str) -> list[dict[str, Any]]:
        """Return all mastery edges for a concept."""
        if not self._initialised:
            return []
        return self._run_async(self._async_get_all_edges(concept_id))  # type: ignore

    async def _async_get_all_edges(self, concept_id: str) -> list[dict[str, Any]]:
        uuid = await self._async_get_node_uuid(concept_id)
        if uuid is None:
            return []
        edges = await EntityEdge.get_by_node_uuid(self._driver, uuid)
        return [
            {
                "mastery_score": e.attributes.get("mastery_score"),
                "trigger_event_id": e.attributes.get("trigger_event_id"),
                "recorded_at": e.valid_at.isoformat() if e.valid_at else None,
                "valid_from": e.valid_at.isoformat() if e.valid_at else None,
                "valid_to": e.invalid_at.isoformat() if e.invalid_at else None,
            }
            for e in edges
        ]

    def __del__(self) -> None:
        with contextlib.suppress(Exception):
            self.close()

    def get_all_concept_ids(self) -> list[str]:
        """Return all concept IDs with mastery edges."""
        if not self._initialised:
            return []
        return self._run_async(self._async_get_all_concept_ids())  # type: ignore

    async def _async_get_all_concept_ids(self) -> list[str]:
        # Read from Kuzu via direct matching to avoid cross-process staleness
        try:
            import kuzu

            # Try to get the underlying connection from the KuzuDriver
            if hasattr(self._driver, "db"):
                conn = kuzu.Connection(self._driver.db)
                res = conn.execute(
                    f"MATCH (n:Entity) WHERE n.group_id = '{self._group_id}' RETURN n.name"
                )
                names = []
                while res.has_next():  # type: ignore[union-attr]
                    names.append(res.get_next()[0])  # type: ignore[union-attr,index]
                return names
        except Exception:
            pass

        # Fallback to Graphiti-core API
        nodes = await EntityNode.get_by_group_ids(self._driver, [self._group_id])
        return [node.name for node in nodes]

    def close(self) -> None:
        """Close the Graphiti driver and event loop."""
        if self._driver is not None and self._loop is not None:
            with contextlib.suppress(Exception):
                self._run_async(self._driver.close())
        if self._loop and not self._loop.is_closed():
            self._loop.close()
        self._driver = None
        self._initialised = False
        self._concept_nodes.clear()
