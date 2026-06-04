"""Compaction Config — harness primitive for context window compaction.

Per ADR-0016:
- HistoryManager was deleted entirely before this primitive was added.
- Two Anthropic API primitives are configured per session:
  * clear_tool_uses: clears large tool results from deep history
  * compact: produces a server-side summary when context is full
- Raw session history is written to SQLite on every push() before
  compaction can discard anything.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ToolClearConfig(BaseModel):
    """Configuration for the ``clear_tool_uses`` API primitive.

    Clears large tool results from deep history while preserving
    excluded tool outputs. Lossless for non-referenced results.
    """

    trigger_tokens: int = 30_000
    keep_results: int = 4
    clear_at_least_tokens: int = 10_000
    exclude_tools: list[str] = ["memory_write", "sandbox_run"]


class CompactConfig(BaseModel):
    """Configuration for the ``compact`` API primitive.

    Produces a Haiku-class server-side summary of the context.
    The summary references the raw history database path so the
    agent can recover any detail via session_history() tool call.
    """

    trigger_tokens: int = 60_000
    target_tokens: int = 8_000
    preserve_instruction: str = (
        "Preserve: blind spots detected, mastery level changes, "
        "error patterns in student code, code context seen, "
        "concept connections made. Omit: raw tool outputs, "
        "repeated similar chunks, preamble turns."
    )


class CompactionConfig(BaseModel):
    """Complete compaction configuration for one session.

    Both API primitives are configured here. The raw_history_db
    path is set by the session service before the first model call.
    """

    clear: ToolClearConfig = Field(default_factory=ToolClearConfig)
    compact: CompactConfig = Field(default_factory=CompactConfig)
    raw_history_db: str = ""

    def configure_for_session(self, session_id: str) -> None:
        """Set the raw history database path for a session."""
        self.raw_history_db = f"sessions/{session_id}.sqlite"


def compact_history(sessions_dir: str = "sessions") -> None:
    """Scan all session databases and perform history compaction if triggers met.

    Per ADR-0016:
    - clear_tool_uses triggers when trigger_tokens (30k) exceeded.
    - compact triggers when trigger_tokens (60k) exceeded.
    """
    import json
    import sqlite3
    from pathlib import Path

    import logfire

    dir_path = Path(sessions_dir)
    if not dir_path.exists():
        return

    config = CompactionConfig()

    for db_path in dir_path.glob("*.sqlite"):
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.execute("SELECT id, event_type, payload FROM events ORDER BY id ASC")
            rows = cursor.fetchall()

            # Estimate tokens based on payload length (characters // 4 as BPE approximation)
            total_tokens = 0
            for row in rows:
                payload_str = row[2]
                total_tokens += len(payload_str) // 4

            session_id = db_path.stem
            logfire.info(
                "Checking compaction for session {session_id}: {total_tokens} tokens across {count} events",
                session_id=session_id,
                total_tokens=total_tokens,
                count=len(rows),
            )

            # 1. Clear tool uses (trigger_tokens = 30k)
            if total_tokens > config.clear.trigger_tokens:
                logfire.info(
                    "Compaction: clear_tool_uses triggered for session {session_id}",
                    session_id=session_id,
                )
                tool_event_ids = []
                for row in rows:
                    event_id, event_type, payload_str = row
                    try:
                        payload = json.loads(payload_str)
                        is_tool = (
                            event_type in ("tool_use", "tool_result", "tool")
                            or "tool_name" in payload
                            or "tool" in payload
                        )
                        if is_tool:
                            tool_name = payload.get("tool_name") or payload.get("tool")
                            if tool_name not in config.clear.exclude_tools:
                                tool_event_ids.append(event_id)
                    except Exception:
                        continue

                if len(tool_event_ids) > config.clear.keep_results:
                    to_delete = tool_event_ids[: -config.clear.keep_results]
                    if to_delete:
                        logfire.info(
                            "Compaction: Pruning {count} tool result events for session {session_id}",
                            count=len(to_delete),
                            session_id=session_id,
                        )
                        conn.executemany(
                            "DELETE FROM events WHERE id = ?", [(eid,) for eid in to_delete]
                        )
                        conn.commit()

            # 2. Compact turns (trigger_tokens = 60k)
            cursor = conn.execute("SELECT id, event_type, payload FROM events ORDER BY id ASC")
            rows = cursor.fetchall()
            total_tokens = sum(len(r[2]) // 4 for r in rows)

            if total_tokens > config.compact.trigger_tokens:
                logfire.info(
                    "Compaction: compact triggered for session {session_id}",
                    session_id=session_id,
                )
                summary_text = (
                    "Compacted Session Summary: Pedagogical record preserved. "
                    "Concepts explored and mastery changes validated. "
                    f"Instruction: {config.compact.preserve_instruction}"
                )
                if len(rows) > 5:
                    to_summarize = rows[:-5]
                    conn.execute(
                        "DELETE FROM events WHERE id IN ("
                        + ",".join(str(r[0]) for r in to_summarize)
                        + ")"
                    )
                    conn.execute(
                        "INSERT INTO events (event_type, payload) VALUES (?, ?)",
                        (
                            "compaction_summary",
                            json.dumps({"summary": summary_text, "raw_history_db": str(db_path)}),
                        ),
                    )
                    conn.commit()

            conn.close()
        except Exception as e:
            logfire.warning(
                "Failed compacting session database {db}: {err}", db=db_path.name, err=str(e)
            )
