"""FastAPI application factory for the PracDaGo backend.

Startup sequence:
  1. Load settings from environment / .env
  2. Configure Logfire (noop if no LOGFIRE_TOKEN)
  3. Initialise SQLite database and create tables
  4. Seed workspace data
  5. Initialise Model Router
  6. Initialise harness primitives (Tool Registry, Context Gate, Socratic Gate)
  7. Instrument FastAPI, HTTPX, SQLite, Pydantic AI
  8. Register routers
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import logfire

from app.config import get_settings
from app.storage.database import init_db
from app.seed import build_seed_domains
from app.storage import workspace_repo
from app.harness.tool_registry import FileToolRegistry
from app.harness.context_gate import DefaultContextGate
from app.harness.eval_gate import SocraticGate
from app.harness.model_router import DefaultModelRouter


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()

    # ── Database ────────────────────────────────────────────────────
    init_db(settings)

    # ── Seed workspace data ─────────────────────────────────────────
    domains = build_seed_domains()
    workspace_repo.set_domains(domains)
    logfire.info(
        "Seeded {domain_count} domains into workspace repository",
        domain_count=len(domains),
    )

    # ── Model Router ────────────────────────────────────────────────
    model_router = DefaultModelRouter()
    app.state.model_router = model_router
    logfire.info("Model Router initialised with default provider configuration")

    # ── Concrete Graph & Retrieval Layers ──────────────────────────
    try:
        from app.harness.qdrant_router import QdrantRetrievalRouter
        from app.harness.kuzu_graph_layer import KuzuGraphLayer

        retrieval_router = QdrantRetrievalRouter()
        graph_layer = KuzuGraphLayer(use_graphiti=True)
    except Exception as exc:
        logfire.warning(
            "Graph/Retrieval layers not available: {error} — running without",
            error=str(exc),
        )
        retrieval_router = None
        graph_layer = None

    # ── Harness primitives ──────────────────────────────────────────
    tool_registry = FileToolRegistry()
    context_gate = DefaultContextGate(
        tool_registry=tool_registry,
        system_prompt=(
            "You are a Socratic tutor for the PracDaGo Adaptive Practice "
            "Workspace. Guide learners through technical concepts using "
            "questions and hints. Never give direct answers or solution code."
        ),
        graph_layer=graph_layer,
    )
    socratic_gate = SocraticGate()

    # ── Artifacts store (populated by workflow agents) ──────────────
    app.state.artifacts: list[dict] = []

    # Store on app.state so route handlers can access them
    app.state.tool_registry = tool_registry
    app.state.context_gate = context_gate
    app.state.socratic_gate = socratic_gate
    app.state.retrieval_router = retrieval_router
    app.state.graph_layer = graph_layer

    logfire.info(
        "Harness primitives initialised: {tools} tools loaded",
        tools=len(tool_registry.list_tool_names()),
    )

    yield


def create_app() -> FastAPI:
    settings = get_settings()

    logfire.configure(
        send_to_logfire="if-token-present",
        environment=settings.environment,
    )

    app = FastAPI(
        title="PracDaGo — Adaptive Practice Workspace",
        version="0.1.0",
        lifespan=lifespan,
    )

    logfire.instrument_fastapi(app)
    logfire.instrument_httpx()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.api.health import router as health_router
    from app.api.workspace import router as workspace_router
    from app.api.events import router as events_router
    from app.api.chat import router as chat_router
    from app.api.mastery import router as mastery_router
    from app.api.sources import router as sources_router
    from app.api.artifacts import router as artifacts_router
    from app.api.concepts import router as concepts_router

    app.include_router(health_router)
    app.include_router(workspace_router)
    app.include_router(events_router)
    app.include_router(chat_router)
    app.include_router(mastery_router)
    app.include_router(sources_router)
    app.include_router(artifacts_router)
    app.include_router(concepts_router)

    return app


app = create_app()
