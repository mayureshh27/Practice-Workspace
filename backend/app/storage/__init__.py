"""Storage layer for the Adaptive Practice Workspace.

This package owns *all* on-disk persistence paths. Paths are
resolved under ``backend/data/`` regardless of the caller's
working directory, so the same code runs from any of:

* ``uv run pytest`` from the repo root
* ``cd backend && uv run fastapi dev``
* ``cd backend && uv run python -c "from app.storage import ..."``

Refs: R-2.1 (storage paths pinned to ``backend/data/``).
"""

from __future__ import annotations

from pathlib import Path

# backend/app/storage/__init__.py -> backend/ (three .parent calls)
_BACKEND_ROOT: Path = Path(__file__).resolve().parent.parent.parent
_DATA_DIR: Path = _BACKEND_ROOT / "data"

# Idempotent — every import is a no-op after the first.
_DATA_DIR.mkdir(parents=True, exist_ok=True)


def data_path(name: str) -> Path:
    """Return an absolute path under ``backend/data/``.

    Parameters
    ----------
    name
        File or directory name relative to ``backend/data/`` (e.g.
        ``"pracda_go.db"``, ``"workflows_snapshot.json"``,
        ``"qdrant_db"``).

    Returns
    -------
    Path
        Absolute, CWD-independent path.
    """
    return _DATA_DIR / name


__all__ = ["data_path"]
