"""Session Summary Agent stub — produces compressed pedagogical summaries.

Per ADR-0022: the SessionSummaryAgent receives a serialised event list and
nothing else. Its output is verified against the session's actual
ConceptMasteryUpdated events before the Event Emitter writes it. The agent
never has access to the MemoryStore directly.
"""

from dataclasses import dataclass

from pydantic import BaseModel
from pydantic_ai import Agent


@dataclass
class SessionSummaryDeps:
    """Dependencies — the serialised event list is the only input."""

    session_id: str


class SessionSummaryOutput(BaseModel):
    """Structured output verified by the harness before writing."""

    summary_text: str
    concepts_covered: list[str] = []
    mastery_deltas: dict[str, float] = {}  # concept_id → delta


import os

def _select_model() -> str:
    """Pick the model based on available API keys."""
    if os.environ.get("GOOGLE_API_KEY"):
        return "google:gemini-2.5-flash"
    # Fallback: Pydantic AI TestModel is used when no key is present
    return "test"


session_summary_agent = Agent(
    _select_model(),
    deps_type=SessionSummaryDeps,
    output_type=SessionSummaryOutput,
    instructions=(
        "Summarize the practice session into a compressed pedagogical record. "
        "Identify concepts covered, mastery changes, and key learning moments. "
        "Keep the summary under 200 words."
    ),
)
