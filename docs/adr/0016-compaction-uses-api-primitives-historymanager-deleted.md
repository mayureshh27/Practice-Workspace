# Compaction Uses API Primitives — HistoryManager Deleted First

Session history compaction is handled entirely by two Anthropic API primitives — `clear_tool_uses_20250919` and `compact_20260112` — configured via a `CompactionConfig` Pydantic model. The existing `HistoryManager` module is deleted entirely before `CompactionConfig` is added. The two systems must never coexist in the same codebase.

`clear_tool_uses` configuration: trigger_tokens=30,000, keep_results=4, clear_at_least_tokens=10,000, exclude_tools=["memory_write","sandbox_run"].

`compact` configuration: trigger_tokens=60,000, target_tokens=8,000, custom_instruction="Preserve: blind spots detected, mastery level changes, error patterns in student code, code context seen, concept connections made. Omit: raw tool outputs, repeated similar chunks, preamble turns."

Raw session history is written to `sessions/{session_id}.sqlite` on every `push()` call before any compaction can occur. The compact summary references this path so any detail can be recovered via `session_history(session_id)` tool call.

## Consequences

Custom compaction logic and API compaction primitives manage the same session state through different mechanisms. Running both simultaneously produces split state: the raw history SQLite and the compaction summary disagree about what was seen. Bugs from this conflict are invisible until a session is long enough to trigger compaction. Deletion is therefore a prerequisite, not a refactoring step. The deletion-first rule supersedes the normal preference for incremental migration. The pedagogical preservation instruction in `compact` is the machine-readable specification of what the platform considers learning-critical — it should be treated as a product decision, not a configuration detail.

## Considered Options

- Keep HistoryManager and add API primitives alongside: explicitly rejected — produces conflicting state management.
- Custom compression only: HistoryManager is ~120 lines of custom code that duplicates API primitives. Maintenance burden, no server-side efficiency.
- API primitives only: chosen. Server-side Haiku compaction is cheaper and faster than a local summarisation call. The custom_instruction preserves the pedagogical signal.
