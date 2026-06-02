"""Application configuration via Pydantic Settings.

Environment variables prefixed with ``PRACDA_`` override defaults.
A ``.env`` file in the backend directory is also loaded if present.

All on-disk paths are pinned under ``backend/data/`` so the same
config works from any working directory (see ``app.storage`` for
the matching ``data_path()`` helper).
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve to backend/data/ — mirrors backend/app/storage/__init__.py.
# Duplicated rather than imported to keep app.config free of
# app.storage dependencies; both modules are imported very early in
# the import graph (main.py pulls in app.config before app.storage).
_BACKEND_ROOT: Path = Path(__file__).resolve().parent.parent
_DATA_DIR: Path = _BACKEND_ROOT / "data"
_DATA_DIR.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PRACDA_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # ── Database ────────────────────────────────────────────────────
    # Default lives under backend/data/ — a `cd backend && uv run …`
    # from the repo root and a `uv run …` from elsewhere both find
    # the same file. Override with PRACDA_DB_PATH=/some/where/else.db
    # for non-default layouts (e.g. a CI scratch directory).
    db_path: Path = _DATA_DIR / "pracda_go.db"

    # ── Telemetry (Logfire) ─────────────────────────────────────────
    # If unset, Logfire runs in noop/console mode — app never crashes.
    logfire_token: str | None = None
    environment: str = "development"

    # ── Model routing (BYOK via ModelRouter Contract) ───────────────
    default_model: str = "google:gemini-2.5-flash"
    model_router_providers: list[str] = ["google", "openai", "anthropic", "ollama"]
    model_router_default_task: str = "tutor"

    # ── CORS ────────────────────────────────────────────────────────
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # ── Three distinct thresholds (ADR-0029) ────────────────────────
    # Prerequisite gap: mastery below this → surfaced in graph_seed slot
    prerequisite_gap_threshold: float = 0.5
    # Blind spot clearing: mastery above this → resolved_at set
    blind_spot_clearing_threshold: float = 0.70
    # Blind spot detection: count-based (≥3 attempts, ≥3 sessions)
    blind_spot_min_attempts: int = 3
    blind_spot_min_sessions: int = 3

    # ── Concept Identity Resolution (ADR-0027) ─────────────────────
    # Token-set-ratio threshold for fuzzy alias matching at ingestion.
    # Locked before the first source is ingested; changing thereafter
    # is a schema migration, not a configuration change.
    concept_fuzzy_threshold: int = 85


def get_settings() -> Settings:
    """Singleton-ish settings accessor — cached by FastAPI's dependency system."""
    return Settings()
