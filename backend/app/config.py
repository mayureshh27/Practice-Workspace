"""Application configuration via Pydantic Settings.

Environment variables prefixed with ``PRACDA_`` override defaults.
A ``.env`` file in the backend directory is also loaded if present.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PRACDA_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # ── Database ────────────────────────────────────────────────────
    db_path: Path = Path("data/pracda_go.db")

    # ── Telemetry (Logfire) ─────────────────────────────────────────
    # If unset, Logfire runs in noop/console mode — app never crashes.
    logfire_token: str | None = None
    environment: str = "development"

    # ── Model routing (BYOK) ────────────────────────────────────────
    default_model: str = "google:gemini-2.5-flash"

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
