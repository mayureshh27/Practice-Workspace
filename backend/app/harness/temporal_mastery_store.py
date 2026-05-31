"""Temporal Mastery Store — append-only, point-in-time queryable mastery storage.

Replaces the in-memory dict placeholder in KuzuGraphLayer with a SQLite-backed
persistent store. Every mastery update appends a new edge; prior edges are
never deleted. The full mastery trajectory is preserved and queryable at any
point in time.

This is a GraphLayer-internal abstraction. The product-facing interface is
GraphLayer.update_mastery() and GraphLayer.get_concept_context() — callers
never touch this module directly (ADR-0028, ADR-0026).

Migration path to Zep Graphiti:
  - Implement the same interface (append_mastery_edge, get_current_score,
    get_score_at_time, get_all_edges)
  - Swap the implementation in KuzuGraphLayer.__init__
  - ADR-0025's five-method surface does not change
"""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

import logfire


class TemporalMasteryStore:
    """SQLite-backed append-only temporal mastery edge storage.

    Each edge has: concept_id, mastery_score, trigger_event_id,
    recorded_at, valid_from, valid_to. Edges are append-only.
    Point-in-time queries filter by recorded_at <= target_timestamp
    and return the most recent edge.
    """

    def __init__(self, db_path: str | Path = "storage/mastery.db") -> None:
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        self._init_db()
        logfire.info(
            "TemporalMasteryStore initialised at {path}",
            path=str(self._db_path),
        )

    def _get_conn(self) -> sqlite3.Connection:
        """Get a thread-local connection."""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(str(self._db_path))
            self._local.conn.row_factory = sqlite3.Row
            self._local.conn.execute("PRAGMA journal_mode=WAL")
        return self._local.conn

    def _init_db(self) -> None:
        conn = self._get_conn()
        conn.execute(
            "CREATE TABLE IF NOT EXISTS mastery_edges ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  concept_id TEXT NOT NULL,"
            "  mastery_score REAL NOT NULL,"
            "  trigger_event_id TEXT,"
            "  recorded_at TEXT NOT NULL,"
            "  valid_from TEXT NOT NULL,"
            "  valid_to TEXT"
            ")"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mastery_concept "
            "ON mastery_edges(concept_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mastery_recorded_at "
            "ON mastery_edges(concept_id, recorded_at)"
        )
        conn.commit()

    def append_mastery_edge(
        self,
        concept_id: str,
        mastery_score: float,
        trigger_event_id: str,
        timestamp: datetime,
    ) -> None:
        """Append a new temporal mastery edge.

        Sets valid_to on the prior edge (if any) to the current timestamp.
        """
        if not (0.0 <= mastery_score <= 1.0):
            raise ValueError(f"Mastery score must be in [0.0, 1.0], got {mastery_score}")

        conn = self._get_conn()
        ts_iso = timestamp.isoformat()

        # Close the prior edge
        conn.execute(
            "UPDATE mastery_edges SET valid_to = ? "
            "WHERE concept_id = ? AND valid_to IS NULL",
            (ts_iso, concept_id),
        )

        # Insert the new edge
        conn.execute(
            "INSERT INTO mastery_edges "
            "(concept_id, mastery_score, trigger_event_id, recorded_at, valid_from) "
            "VALUES (?, ?, ?, ?, ?)",
            (concept_id, mastery_score, trigger_event_id, ts_iso, ts_iso),
        )
        conn.commit()

    def get_current_score(self, concept_id: str) -> float | None:
        """Return the most recent mastery score for a concept.

        Returns None if the concept has no mastery edges.
        """
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT mastery_score FROM mastery_edges "
            "WHERE concept_id = ? AND valid_to IS NULL "
            "ORDER BY recorded_at DESC LIMIT 1",
            (concept_id,),
        )
        row = cursor.fetchone()
        return row[0] if row else None

    def get_score_at_time(
        self,
        concept_id: str,
        target_timestamp: datetime,
    ) -> float | None:
        """Return the mastery score at a specific point in time.

        Finds the most recent edge where recorded_at <= target_timestamp.
        Returns None if no edge exists before that time.
        """
        conn = self._get_conn()
        ts_iso = target_timestamp.isoformat()
        cursor = conn.execute(
            "SELECT mastery_score FROM mastery_edges "
            "WHERE concept_id = ? AND recorded_at <= ? "
            "ORDER BY recorded_at DESC LIMIT 1",
            (concept_id, ts_iso),
        )
        row = cursor.fetchone()
        return row[0] if row else None

    def get_last_updated(self, concept_id: str) -> datetime | None:
        """Return the timestamp of the most recent mastery edge."""
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT recorded_at FROM mastery_edges "
            "WHERE concept_id = ? AND valid_to IS NULL "
            "ORDER BY recorded_at DESC LIMIT 1",
            (concept_id,),
        )
        row = cursor.fetchone()
        if row:
            return datetime.fromisoformat(row[0])
        return None

    def get_all_edges(self, concept_id: str) -> list[dict[str, Any]]:
        """Return all mastery edges for a concept, ordered by recorded_at."""
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT mastery_score, trigger_event_id, recorded_at, "
            "valid_from, valid_to FROM mastery_edges "
            "WHERE concept_id = ? ORDER BY recorded_at ASC",
            (concept_id,),
        )
        return [dict(row) for row in cursor.fetchall()]

    def get_all_concept_ids(self) -> list[str]:
        """Return all concept IDs that have at least one mastery edge."""
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT DISTINCT concept_id FROM mastery_edges ORDER BY concept_id"
        )
        return [row[0] for row in cursor.fetchall()]
