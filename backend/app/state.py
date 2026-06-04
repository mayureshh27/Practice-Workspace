from dataclasses import dataclass, field
from typing import Any

from app.harness.context_gate import ContextGate
from app.harness.eval_gate import SocraticGate
from app.harness.graph_layer import GraphLayer
from app.harness.model_router import ModelRouter
from app.harness.retrieval_router import RetrievalRouter


@dataclass
class AppState:
    model_router: ModelRouter | None = None
    context_gate: ContextGate | None = None
    socratic_gate: SocraticGate | None = None
    retrieval_router: RetrievalRouter | None = None
    graph_layer: GraphLayer | None = None
    artifacts: list[dict[str, Any]] = field(default_factory=list)
