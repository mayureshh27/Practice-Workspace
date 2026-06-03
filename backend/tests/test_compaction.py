"""Tests for the Compaction Config and history compaction (Phase 8)."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
import pytest

from app.harness.compaction_config import CompactionConfig, compact_history


@pytest.fixture
def temp_sessions_dir(tmp_path) -> Path:
    """Fixture returning a temp path for sessions sqlite databases."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()
    return sessions_dir


def test_compact_history_clears_tool_uses(temp_sessions_dir):
    """Verify that compact_history prunes tool result events if clear_tool_uses trigger is met."""
    session_id = "session-test-clear"
    db_path = temp_sessions_dir / f"{session_id}.sqlite"

    # Initialize SQLite database
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, payload TEXT)"
    )

    # Insert events that exceed 30,000 tokens (characters // 4 approximation)
    # 30,000 tokens ≈ 120,000 characters
    large_payload = "x" * 25000
    
    # Excluded tools should not be cleared
    conn.execute(
        "INSERT INTO events (event_type, payload) VALUES (?, ?)",
        ("tool_use", json.dumps({"tool_name": "memory_write", "data": large_payload})),
    )
    # Clearable tools
    for i in range(10):
        conn.execute(
            "INSERT INTO events (event_type, payload) VALUES (?, ?)",
            ("tool_use", json.dumps({"tool_name": "file_read", "index": i, "data": large_payload})),
        )
    conn.commit()
    conn.close()

    # Run compaction
    compact_history(sessions_dir=str(temp_sessions_dir))

    # Check database status
    conn = sqlite3.connect(str(db_path))
    cursor = conn.execute("SELECT id, event_type, payload FROM events ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()

    # The file_read outputs should be pruned, leaving only keep_results (4) plus the excluded memory_write
    assert len(rows) == 5


def test_compact_history_compacts_turns(temp_sessions_dir):
    """Verify that compact_history creates a summary event if compact trigger is met (>60k)."""
    session_id = "session-test-compact"
    db_path = temp_sessions_dir / f"{session_id}.sqlite"

    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, payload TEXT)"
    )

    # Exceed 60,000 tokens (240k characters)
    large_payload = "x" * 50000
    for i in range(6):
        conn.execute(
            "INSERT INTO events (event_type, payload) VALUES (?, ?)",
            ("chat_message", json.dumps({"role": "user", "text": large_payload})),
        )
    conn.commit()
    conn.close()

    # Run compaction
    compact_history(sessions_dir=str(temp_sessions_dir))

    conn = sqlite3.connect(str(db_path))
    cursor = conn.execute("SELECT event_type, payload FROM events")
    rows = cursor.fetchall()
    conn.close()

    # Should have compaction_summary event
    event_types = [r[0] for r in rows]
    assert "compaction_summary" in event_types
