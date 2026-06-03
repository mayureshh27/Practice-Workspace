from typing import Any

"""Problems API — serves Go and Robotics problems from JSON files.

Endpoints mirror the legacy Go backend (port 8080) so the frontend
can switch to FastAPI (port 8000) as a single backend.
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/problems", tags=["problems"])

PROBLEM_FILES: dict[str, str] = {
    "go": "../data/problems.json",
    "robotics": "../data/problems_robotics.json",
}

_cache: dict[str, dict] | None = None  # type: ignore


def _load_all() -> dict[str, dict]:  # type: ignore
    global _cache
    if _cache is not None:
        return _cache
    _cache = {}
    base = Path(__file__).resolve().parent.parent.parent
    for key, rel in PROBLEM_FILES.items():
        path = base / rel
        if not path.exists():
            path = Path.cwd() / rel
        if path.exists():
            with open(path) as f:
                _cache[key] = json.load(f)
    return _cache


@router.get("")
def list_problems(domain: str | None = None):  # type: ignore
    """Return all problems, optionally filtered by domain (go|robotics)."""
    all_data = _load_all()
    if domain:
        if domain not in all_data:
            raise HTTPException(status_code=404, detail=f"Unknown problem domain: {domain}")
        return all_data[domain]
    merged: dict[str, Any] = {"chapters": [], "problems": []}
    for data in all_data.values():
        merged["chapters"].extend(data.get("chapters", []))
        merged["problems"].extend(data.get("problems", []))
    return merged


@router.get("/chapters")
def list_chapters(domain: str | None = None):  # type: ignore
    """Return only chapters, optionally filtered by domain."""
    all_data = _load_all()
    if domain:
        if domain not in all_data:
            raise HTTPException(status_code=404, detail=f"Unknown problem domain: {domain}")
        return all_data[domain].get("chapters", [])
    chapters = []
    for data in all_data.values():
        chapters.extend(data.get("chapters", []))
    return chapters
