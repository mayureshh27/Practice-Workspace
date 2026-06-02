"""Workflow template data repository — CRUD for workflow templates.

Workflows are stored separately from the workspace hierarchy so they
can be queried, filtered and persisted without re-reading the entire
domain tree. Mutations persist to a JSON snapshot next to the SQLite DB
so the workflow editor and Studio survive restarts.

Scope model: each template is either *global* (reusable across the
workspace) or *scoped* to a subject/chapter/topic. The Studio's
`+ New Workflow` flow always starts at scope=global; the editor can
promote a global template into a subject-scoped variant via
``customize_workflow`` so per-class tweaks don't mutate the original.
"""

from __future__ import annotations

import json
from pathlib import Path
import time

from app.config import get_settings
from app.domain.workspace import (
    WorkflowScope,
    WorkflowTemplate,
)

# ── In-memory store (seeded at startup) ─────────────────────────────

_workflows: list[WorkflowTemplate] = []


def _dump_path() -> Path:
    settings = get_settings()
    return settings.db_path.parent / "workflows_snapshot.json"


def _persist() -> None:
    path = _dump_path()
    data = [w.model_dump(mode="json") for w in _workflows]
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _restore() -> list[WorkflowTemplate] | None:
    path = _dump_path()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return [WorkflowTemplate(**w) for w in data]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return None


def set_workflows(workflows: list[WorkflowTemplate]) -> None:
    """Replace the workflow store. Called by main.py at startup."""
    global _workflows
    _workflows = list(workflows)
    _persist()


def get_workflows() -> list[WorkflowTemplate]:
    """Return all workflow templates, restoring from snapshot on first access."""
    global _workflows
    if not _workflows:
        restored = _restore()
        if restored is not None:
            _workflows = restored
    return _workflows


def get_workflow(workflow_id: str) -> WorkflowTemplate | None:
    return next((w for w in get_workflows() if w.id == workflow_id), None)


# ── Filtering ───────────────────────────────────────────────────────


def list_workflows(
    *,
    scope: WorkflowScope | None = None,
    subject_id: str | None = None,
    chapter_id: str | None = None,
    topic_id: str | None = None,
) -> list[WorkflowTemplate]:
    """Return templates whose scope matches the requested hierarchy.

    The Studio panel passes the currently-viewed subjectId/chapterId/
    topicId so global templates bubble up alongside the scoped ones.
    Passing no filters returns every template.
    """
    results: list[WorkflowTemplate] = []
    for wf in get_workflows():
        if scope is not None and wf.scope != scope:
            continue
        if subject_id is not None and wf.scope in ("subject", "chapter", "topic"):
            if wf.subject_id != subject_id:
                continue
        if chapter_id is not None and wf.scope in ("chapter", "topic"):
            if wf.chapter_id != chapter_id:
                continue
        if topic_id is not None and wf.scope == "topic":
            if wf.topic_id != topic_id:
                continue
        results.append(wf)
    return results


# ── Mutations ───────────────────────────────────────────────────────


def add_workflow(workflow: WorkflowTemplate) -> WorkflowTemplate:
    _workflows.append(workflow)
    _persist()
    return workflow


def update_workflow(
    workflow_id: str, fields: dict
) -> WorkflowTemplate | None:
    for i, w in enumerate(_workflows):
        if w.id == workflow_id:
            _workflows[i] = w.model_copy(update=fields)
            _persist()
            return _workflows[i]
    return None


def delete_workflow(workflow_id: str) -> bool:
    global _workflows
    before = len(_workflows)
    _workflows = [w for w in _workflows if w.id != workflow_id]
    if len(_workflows) < before:
        _persist()
        return True
    return False


def duplicate_workflow(workflow_id: str) -> WorkflowTemplate | None:
    """Create an in-place copy of an existing workflow.

    Used by the Workflow Manager's "Duplicate" action — the duplicate
    starts life as global so the user can re-scope it deliberately.
    """
    src = get_workflow(workflow_id)
    if src is None:
        return None
    stamp = int(time.time() * 1000)
    copy = src.model_copy(
        update={
            "id": f"wf-dup-{stamp}",
            "name": f"{src.name} (copy)",
            "scope": "global",
            "subject_id": None,
            "chapter_id": None,
            "topic_id": None,
            "last_run": None,
        }
    )
    _workflows.append(copy)
    _persist()
    return copy


def customize_workflow(
    workflow_id: str,
    *,
    subject_id: str | None = None,
    chapter_id: str | None = None,
    topic_id: str | None = None,
) -> WorkflowTemplate | None:
    """Fork a global workflow into a scoped variant.

    The Studio's gear icon calls this so editing a global template
    while viewing a subject doesn't mutate the global. The new
    template keeps the original's prompt, eval gates, practice config
    and description, but takes on the requested scope and is appended
    to the store under a fresh id. Returns ``None`` when the source
    doesn't exist or the target scope is invalid.
    """
    src = get_workflow(workflow_id)
    if src is None:
        return None
    if src.scope != "global":
        # Customising an already-scoped template is a no-op; return the
        # original so the caller can decide what to do.
        return src

    if topic_id is not None:
        scope: WorkflowScope = "topic"
        sid: str | None = subject_id
        cid: str | None = chapter_id
        tid: str | None = topic_id
    elif chapter_id is not None:
        scope = "chapter"
        sid, cid, tid = subject_id, chapter_id, None
    elif subject_id is not None:
        scope = "subject"
        sid, cid, tid = subject_id, None, None
    else:
        return None

    stamp = int(time.time() * 1000)
    fork = src.model_copy(
        update={
            "id": f"wf-fork-{stamp}",
            "name": f"{src.name} ({_scope_label(scope)})",
            "scope": scope,
            "subject_id": sid,
            "chapter_id": cid,
            "topic_id": tid,
            "last_run": None,
        }
    )
    _workflows.append(fork)
    _persist()
    return fork


def _scope_label(scope: WorkflowScope) -> str:
    return {
        "global": "global",
        "subject": "subject",
        "chapter": "chapter",
        "topic": "topic",
    }[scope]
