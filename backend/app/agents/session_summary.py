from dataclasses import dataclass

from pydantic import BaseModel
from pydantic_ai import Agent

from app.harness.model_router import DefaultModelRouter, ModelRouter


@dataclass
class SessionSummaryDeps:
    session_id: str


class SessionSummaryOutput(BaseModel):
    summary_text: str
    concepts_covered: list[str] = []
    mastery_deltas: dict[str, float] = {}


_router: ModelRouter = DefaultModelRouter()


def _resolve_model() -> str:
    cfg = _router.route("session_summary")
    return cfg.pydantic_ai_model()


session_summary_agent = Agent(
    _resolve_model(),
    deps_type=SessionSummaryDeps,
    output_type=SessionSummaryOutput,
    instructions=(
        "Summarize the practice session into a compressed pedagogical record. "
        "Identify concepts covered, mastery changes, and key learning moments. "
        "Keep the summary under 200 words."
    ),
)
