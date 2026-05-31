"""FastAPI application factory for the PracDaGo backend.

Startup sequence:
  1. Load settings from environment / .env
  2. Configure Logfire (noop if no LOGFIRE_TOKEN)
  3. Initialise SQLite database and create tables
  4. Seed workspace data
  5. Initialise harness primitives (Tool Registry, Context Gate, Socratic Gate)
  6. Instrument FastAPI, HTTPX, SQLite, Pydantic AI
  7. Register routers
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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — runs once at startup and shutdown."""
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

    # ── Harness primitives ──────────────────────────────────────────
    tool_registry = FileToolRegistry()
    context_gate = DefaultContextGate(
        tool_registry=tool_registry,
        system_prompt=(
            "You are a Socratic tutor for the PracDaGo Adaptive Practice "
            "Workspace. Guide learners through technical concepts using "
            "questions and hints. Never give direct answers or solution code."
        ),
    )
    socratic_gate = SocraticGate()

    # Concrete Graph & Retrieval Layers
    from app.harness.qdrant_router import QdrantRetrievalRouter
    from app.harness.kuzu_graph_layer import KuzuGraphLayer
    
    retrieval_router = QdrantRetrievalRouter()
    graph_layer = KuzuGraphLayer()

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

    # Shutdown — nothing to clean up yet.


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    # ── Logfire — configure first, always (Logfire skill rule) ───────
    logfire.configure(
        send_to_logfire="if-token-present",
        environment=settings.environment,
    )

    app = FastAPI(
        title="PracDaGo — Adaptive Practice Workspace",
        version="0.1.0",
        lifespan=lifespan,
    )

    # ── Logfire instrumentation — after configure, before app starts ─
    logfire.instrument_fastapi(app)
    logfire.instrument_httpx()

    # ── CORS ────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Register routers ────────────────────────────────────────────
    from app.api.health import router as health_router
    from app.api.workspace import router as workspace_router
    from app.api.events import router as events_router
    from app.api.chat import router as chat_router
    from app.api.mastery import router as mastery_router

    app.include_router(health_router)
    app.include_router(workspace_router)
    app.include_router(events_router)
    app.include_router(chat_router)
    app.include_router(mastery_router)

    return app


# Module-level app instance — used by ``fastapi dev`` and ``fastapi run``
# via the ``[tool.fastapi] entrypoint`` in pyproject.toml.
app = create_app()
