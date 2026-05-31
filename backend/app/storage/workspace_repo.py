"""Workspace data repository — CRUD for domains, subjects, chapters, topics.

For the first slice, workspace data lives in a module-level store seeded at
startup. This avoids coupling the workspace hierarchy to SQLModel tables
before the schema has stabilised. The repository interface is stable; the
backing store can move to SQL later without changing callers.
"""

from app.domain.workspace import (
    Chapter,
    Domain,
    Subject,
    Topic,
)

# ── In-memory store (seeded at startup) ─────────────────────────────

_domains: list[Domain] = []


def set_domains(domains: list[Domain]) -> None:
    """Replace the workspace store. Called by seed.py at startup."""
    global _domains
    _domains = list(domains)


def get_domains() -> list[Domain]:
    """Return all domains with their full hierarchy."""
    return _domains


def get_domain(domain_id: str) -> Domain | None:
    """Return a single domain by ID, or None."""
    return next((d for d in _domains if d.id == domain_id), None)


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
