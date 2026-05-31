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
