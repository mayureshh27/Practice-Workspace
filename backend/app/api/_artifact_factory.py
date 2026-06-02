"""Artifact factory — single source of truth for artifact construction.

Two helpers:

* :func:`make_artifact` — stamps the canonical ``id`` (collision-safe
  via :func:`app.api._ids.new_id`) and ``time`` (ISO-8601 with ms via
  :func:`app.api._ids.now_iso_with_ms`) on the record, then hands back
  the dict the API layer appends.
* :func:`append_artifact` — hides the ``getattr/append/setattr`` triplet
  on ``request.app.state.artifacts``.

Both helpers exist because the artifact construction logic was
duplicated in two call sites (``artifacts.py`` and
``practice_exercises.py``) with the same id-stamping, time-formatting,
and state-mutation code (chat review §2.3).

Refs: chat review §2.3 (single source of truth for artifact construction),
layered review H-H1 (``prompt_template_sha`` widens the dedup key).
"""

from __future__ import annotations

from typing import Any

from fastapi import Request

from app.api._ids import new_id, now_iso_with_ms


def make_artifact(
    *,
    name: str,
    type: str,
    status: str,
    domain_id: str | None,
    subject_id: str | None,
    chapter_id: str | None,
    topic_id: str | None,
    payload: dict[str, Any] | None,
    prompt_template_sha: str | None = None,
) -> dict[str, Any]:
    """Build an artifact record with canonical id + ISO timestamp.

    The caller supplies the semantic fields; the factory stamps the
    bookkeeping fields (``id``, ``time``). The shape returned matches
    :class:`app.api.artifacts.ArtifactDTO` so a direct
    ``ArtifactDTO(**record)`` at the call site is type-safe.

    Parameters
    ----------
    name
        Human-readable artifact name (e.g. "Loops — Go").
    type
        The artifact's type, typically ``workflow.target_type``
        (``"Exercise Pack"``, ``"Lesson"``, ``"Quiz"``,
        ``"Summary"``, ``"Workbook"``).
    status
        Lifecycle status: ``"draft"``, ``"approved"``, ``"reviewed"``.
    domain_id, subject_id, chapter_id, topic_id
        Workspace scope ids (``chapter_id`` and ``topic_id`` may be
        ``None`` for global workflows).
    payload
        The discriminated union (kind="practice" | "quiz" |
        "summary") produced by the practice agent, serialised to a
        dict. May be ``None`` for stub artifacts.
    prompt_template_sha
        SHA-256 of the workflow's ``prompt_template``. Stored on the
        record so the artifact gate's dedup check can compare against
        it without re-fetching the workflow (layered review H-H1).

    Returns
    -------
    dict
        A record ready for :func:`append_artifact` or
        ``ArtifactDTO(**record)``.
    """
    return {
        "id": new_id("art"),
        "name": name,
        "type": type,
        "status": status,
        "time": now_iso_with_ms(),
        "domain_id": domain_id,
        "subject_id": subject_id,
        "chapter_id": chapter_id,
        "topic_id": topic_id,
        "payload": payload,
        "prompt_template_sha": prompt_template_sha,
    }


def append_artifact(request: Request, record: dict[str, Any]) -> None:
    """Append ``record`` to the in-memory artifact store on app.state.

    The store lives on ``request.app.state.artifacts`` (a list). The
    helper hides the ``getattr / append / setattr`` triplet so callers
    never touch state directly (chat review §2.3 #2).
    """
    artifacts = getattr(request.app.state, "artifacts", [])
    artifacts.append(record)
    request.app.state.artifacts = artifacts
