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

import logfire
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.harness.context_gate import DefaultContextGate
from app.harness.eval_gate import SocraticGate
from app.harness.model_router import DefaultModelRouter
from app.harness.tool_registry import FileToolRegistry
from app.seed import build_seed_domains
from app.state import AppState
from app.storage import workflows_repo, workspace_repo
from app.storage.database import init_db


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

    # ── Seed workflow templates ─────────────────────────────────────
    from app.seed import build_seed_workflows

    workflows = build_seed_workflows()
    workflows_repo.set_workflows(workflows)
    logfire.info(
        "Seeded {workflow_count} workflow templates",
        workflow_count=len(workflows),
    )

    # ── Model Router ────────────────────────────────────────────────
    model_router = DefaultModelRouter()
    app.state.model_router = model_router
    logfire.info("Model Router initialised with default provider configuration")

    # ── Concrete Graph & Retrieval Layers ──────────────────────────
    try:
        from app.harness.kuzu_graph_layer import KuzuGraphLayer
        from app.harness.qdrant_router import QdrantRetrievalRouter

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

    # ── AppState container (typed state) ────────────────────────────
    app.state.custom = AppState(
        model_router=model_router,
        context_gate=context_gate,
        socratic_gate=socratic_gate,
        retrieval_router=retrieval_router,
        graph_layer=graph_layer,
        artifacts=[],
    )

    # We keep tool_registry here for backwards compatibility if needed
    app.state.tool_registry = tool_registry

    # ── Periodic Compaction Task (H-H7) ─────────────────────────────
    import asyncio

    from app.harness.compaction_config import compact_history

    async def run_compaction_loop() -> None:
        logfire.info("Lifespan task: periodic history compaction loop started")
        try:
            while True:
                await asyncio.sleep(60)
                compact_history()
        except asyncio.CancelledError:
            logfire.info("Lifespan task: periodic history compaction loop stopped")

    compaction_task = asyncio.create_task(run_compaction_loop())

    yield

    compaction_task.cancel()
    import contextlib
    with contextlib.suppress(asyncio.CancelledError):
        await compaction_task


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

    from typing import Any

    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request as StarletteRequest
    from starlette.responses import RedirectResponse

    class TrailingSlashRedirect(BaseHTTPMiddleware):
        async def dispatch(self, request: StarletteRequest, call_next: Any) -> Any:
            if request.url.path != "/" and request.url.path.endswith("/"):
                url = str(request.url).rstrip("/")
                return RedirectResponse(url=url, status_code=307)
            return await call_next(request)

    app.add_middleware(TrailingSlashRedirect)

    from app.api.artifacts import router as artifacts_router
    from app.api.chat import router as chat_router
    from app.api.concepts import router as concepts_router
    from app.api.events import router as events_router
    from app.api.health import router as health_router
    from app.api.mastery import router as mastery_router
    from app.api.practice_exercises import router as practice_router
    from app.api.problems import router as problems_router
    from app.api.sources import router as sources_router
    from app.api.workflows import router as workflows_router
    from app.api.workspace import router as workspace_router

    app.include_router(health_router)
    app.include_router(workspace_router)
    app.include_router(problems_router)
    app.include_router(events_router)
    app.include_router(chat_router)
    app.include_router(mastery_router)
    app.include_router(sources_router)
    app.include_router(artifacts_router)
    app.include_router(concepts_router)
    app.include_router(workflows_router)
    app.include_router(practice_router)

    return app


app = create_app()
