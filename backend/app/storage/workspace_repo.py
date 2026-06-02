"""Workspace data repository — CRUD for domains, subjects, chapters, topics.

For the first slice, workspace data lives in a module-level store seeded at
startup. This avoids coupling the workspace hierarchy to SQLModel tables
before the schema has stabilised. The repository interface is stable; the
backing store can move to SQL later without changing callers.

Write operations persist to SQLite event store so mutations survive restarts.
"""

from pathlib import Path
import json

from sqlmodel import Session, select

from app.config import get_settings
from app.domain.workspace import (
    Chapter,
    Domain,
    Subject,
    Topic,
)
from app.storage.database import get_engine

# ── In-memory store (seeded at startup) ─────────────────────────────

_domains: list[Domain] = []


def _dump_path() -> Path:
    settings = get_settings()
    return settings.db_path.parent / "workspace_snapshot.json"


def _persist() -> None:
    """Persist the workspace hierarchy to a JSON snapshot next to the SQLite DB."""
    path = _dump_path()
    data = [d.model_dump(mode="json") for d in _domains]
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _restore() -> list[Domain] | None:
    """Restore workspace from persisted snapshot, or None if unavailable."""
    path = _dump_path()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return [Domain(**d) for d in data]
    except (json.JSONDecodeError, KeyError, TypeError):
        return None


def set_domains(domains: list[Domain]) -> None:
    """Replace the workspace store. Called by seed.py at startup."""
    global _domains
    _domains = list(domains)
    _persist()


def get_domains() -> list[Domain]:
    """Return all domains with their full hierarchy.

    Attempts to restore from snapshot first (survives restarts),
    falling back to in-memory.
    """
    global _domains
    if not _domains:
        restored = _restore()
        if restored is not None:
            _domains = restored
    return _domains


def get_domain(domain_id: str) -> Domain | None:
    """Return a single domain by ID, or None."""
    return next((d for d in get_domains() if d.id == domain_id), None)


def get_subject(domain_id: str, subject_id: str) -> Subject | None:
    """Return a subject within a domain, or None."""
    domain = get_domain(domain_id)
    if domain is None:
        return None
    return next((s for s in domain.subjects if s.id == subject_id), None)


def get_chapter(
    domain_id: str, subject_id: str, chapter_id: str
) -> Chapter | None:
    """Return a chapter within a subject, or None."""
    subject = get_subject(domain_id, subject_id)
    if subject is None:
        return None
    return next((c for c in subject.chapters if c.id == chapter_id), None)


def get_topic(
    domain_id: str, subject_id: str, chapter_id: str, topic_id: str
) -> Topic | None:
    """Return a topic within a chapter, or None."""
    chapter = get_chapter(domain_id, subject_id, chapter_id)
    if chapter is None:
        return None
    return next((t for t in chapter.topics if t.id == topic_id), None)


# ── Mutations (persist to snapshot) ─────────────────────────────────


def add_domain(name: str) -> Domain:
    domain = Domain(id=f"domain-{hash(name) % (2**31)}", name=name, subjects=[])
    _domains.append(domain)
    _persist()
    return domain


def update_domain(domain_id: str, fields: dict) -> Domain | None:
    domain = get_domain(domain_id)
    if domain is None:
        return None
    idx = next(i for i, d in enumerate(_domains) if d.id == domain_id)
    _domains[idx] = domain.model_copy(update=fields)
    _persist()
    return _domains[idx]


def delete_domain(domain_id: str) -> bool:
    global _domains
    before = len(_domains)
    _domains = [d for d in _domains if d.id != domain_id]
    if len(_domains) < before:
        _persist()
        return True
    return False


def add_subject(domain_id: str, name: str, description: str | None = None) -> Subject | None:
    domain = get_domain(domain_id)
    if domain is None:
        return None
    subject = Subject(
        id=f"subject-{hash(name) % (2**31)}",
        name=name,
        description=description,
        chapters=[Chapter(id=f"c-init-{hash(name) % (2**31)}", name="Chapter 1: Foundations", topics=[])],
        resources=[],
    )
    domain.subjects.append(subject)
    _persist()
    return subject


def update_subject(domain_id: str, subject_id: str, fields: dict) -> Subject | None:
    domain = get_domain(domain_id)
    if domain is None:
        return None
    for i, s in enumerate(domain.subjects):
        if s.id == subject_id:
            domain.subjects[i] = s.model_copy(update=fields)
            _persist()
            return domain.subjects[i]
    return None


def delete_subject(domain_id: str, subject_id: str) -> bool:
    domain = get_domain(domain_id)
    if domain is None:
        return False
    before = len(domain.subjects)
    domain.subjects = [s for s in domain.subjects if s.id != subject_id]
    if len(domain.subjects) < before:
        _persist()
        return True
    return False


def add_chapter(domain_id: str, subject_id: str, name: str, description: str | None = None) -> Chapter | None:
    subject = get_subject(domain_id, subject_id)
    if subject is None:
        return None
    chapter = Chapter(
        id=f"chapter-{hash(name) % (2**31)}",
        name=name,
        description=description or f"Learning modules for {name}.",
        topics=[],
    )
    subject.chapters.append(chapter)
    _persist()
    return chapter


def update_chapter(domain_id: str, subject_id: str, chapter_id: str, fields: dict) -> Chapter | None:
    chapter = get_chapter(domain_id, subject_id, chapter_id)
    if chapter is None:
        return None
    subject = get_subject(domain_id, subject_id)
    if subject is None:
        return None
    for i, c in enumerate(subject.chapters):
        if c.id == chapter_id:
            subject.chapters[i] = chapter.model_copy(update=fields)
            _persist()
            return subject.chapters[i]
    return None


def add_topic(domain_id: str, subject_id: str, chapter_id: str, name: str) -> Topic | None:
    chapter = get_chapter(domain_id, subject_id, chapter_id)
    if chapter is None:
        return None
    topic = Topic(id=f"topic-{hash(name) % (2**31)}", name=name, last_message="Not started")
    chapter.topics.append(topic)
    _persist()
    return topic
