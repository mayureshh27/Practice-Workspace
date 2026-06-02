"""Tests for the Artifact Gate harness primitive (Phase 4 H-B5 + H-H1).

Covers the four checks of :func:`validate_artifact`:

1. Schema validity
2. Source grounding (via ``ChunkExistenceChecker``)
3. Exercise runability (via ``SandboxRunner``)
4. Duplicate detection — key is ``(concept_ids, source_ids,
   prompt_template_sha)`` since H-H1 (was: ``(concept_ids,
   source_ids)`` only).

Before Phase 4 the gate was unwired (layered review H-B5: "eval_gate
exists but is never called") and the dedup missed the prompt
dimension. These tests pin the new contract.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.harness.artifact_gate import (
    _check_duplicate,
    validate_artifact,
)

# ── Helpers ─────────────────────────────────────────────────────────


class _Artifact(BaseModel):
    """Minimal artifact shape for the gate's ``getattr`` lookups."""

    concept_ids: list[str] = []
    source_ids: list[str] = []
    cited_chunk_ids: list[str] = []
    starter_code: str = ""
    solution_code: str = ""
    tests: str = ""
    language: str = "python"


class _FakeChecker:
    """In-memory ChunkExistenceChecker — only the listed ids exist."""

    def __init__(self, present: list[str]) -> None:
        self._present = set(present)

    def chunk_exists(self, chunk_id: str) -> bool:
        return chunk_id in self._present


class _FakeSandbox:
    """Configurable SandboxRunner — emits the result we hand it."""

    def __init__(self, result: dict) -> None:
        self._result = result
        self.calls: list[tuple[str, str, int]] = []

    async def run(self, code: str, language: str, timeout_seconds: int = 30) -> dict:
        self.calls.append((code, language, timeout_seconds))
        return self._result


# ── Schema ──────────────────────────────────────────────────────────


async def test_validate_artifact_passes_schema_for_pydantic_artifact():
    """A valid Pydantic artifact passes the schema check."""
    art = _Artifact()
    result = await validate_artifact(art)
    assert result.passed is True
    assert result.failures == []


# ── Source grounding ────────────────────────────────────────────────


async def test_validate_artifact_flags_missing_chunks():
    """A cited chunk id that the checker doesn't know → review queue."""
    art = _Artifact(cited_chunk_ids=["missing-1"])
    checker = _FakeChecker(present=[])  # nothing exists
    result = await validate_artifact(art, checker=checker)
    assert result.passed is True  # grounding is a warning, not a failure
    assert result.review_queue is True
    assert any("missing-1" in w for w in result.warnings)


async def test_validate_artifact_passes_when_chunks_known():
    art = _Artifact(cited_chunk_ids=["ok-1", "ok-2"])
    checker = _FakeChecker(present=["ok-1", "ok-2"])
    result = await validate_artifact(art, checker=checker)
    assert result.passed is True
    assert result.review_queue is False


# ── Runability ──────────────────────────────────────────────────────


async def test_validate_artifact_blocks_on_runability_failure():
    """A non-zero exit code from the sandbox fails the gate."""
    art = _Artifact(
        starter_code="def solve():\n    return 1\n",
        solution_code="def solve():\n    return 1\n",
        tests="assert solve() == 2",
    )
    sandbox = _FakeSandbox(result={"exit_code": 1, "stderr": "AssertionError"})
    result = await validate_artifact(art, sandbox=sandbox)
    assert result.passed is False
    assert any("runability" in f for f in result.failures)


async def test_validate_artifact_passes_runability():
    art = _Artifact(
        starter_code="def solve():\n    return 1\n",
        solution_code="def solve():\n    return 1\n",
        tests="assert solve() == 1",
    )
    sandbox = _FakeSandbox(result={"exit_code": 0, "stdout": "", "stderr": ""})
    result = await validate_artifact(art, sandbox=sandbox)
    assert result.passed is True


# ── Dedup (H-H1: hash-based key) ───────────────────────────────────


async def test_dedup_key_includes_prompt_template_sha():
    """Same concepts+sources but different prompt SHA → not a duplicate."""
    art = _Artifact(concept_ids=["c1"], source_ids=["s1"])
    existing = [
        {
            "concept_ids": ["c1"],
            "source_ids": ["s1"],
            "prompt_template_sha": "sha-A",
        }
    ]
    failures_a = _check_duplicate(art, existing, prompt_template_sha="sha-A")
    failures_b = _check_duplicate(art, existing, prompt_template_sha="sha-B")
    assert len(failures_a) == 1  # exact match → flagged
    assert failures_b == []  # different prompt → not flagged


async def test_dedup_requires_both_concept_and_source_ids():
    """Dedup only fires when BOTH concept_ids and source_ids are present."""
    art_no_concepts = _Artifact(concept_ids=[], source_ids=["s1"])
    art_no_sources = _Artifact(concept_ids=["c1"], source_ids=[])
    existing = [
        {"concept_ids": [], "source_ids": ["s1"], "prompt_template_sha": "sha-A"}
    ]
    assert _check_duplicate(art_no_concepts, existing, prompt_template_sha="sha-A") == []
    assert _check_duplicate(art_no_sources, existing, prompt_template_sha="sha-A") == []


async def test_dedup_back_compat_with_legacy_records():
    """An existing record without ``prompt_template_sha`` only collides if
    the caller also passes ``prompt_template_sha=None``.

    This keeps the dedup key consistent across upgraded and
    un-upgraded artifact records (no silent all-collide on missing).
    """
    art = _Artifact(concept_ids=["c1"], source_ids=["s1"])
    existing = [{"concept_ids": ["c1"], "source_ids": ["s1"]}]  # no SHA
    # Both sides empty → match → flagged (legacy row treated as SHA="").
    assert len(_check_duplicate(art, existing, prompt_template_sha="")) == 1
    # Caller passed a real SHA → no collision with the legacy record.
    assert _check_duplicate(art, existing, prompt_template_sha="sha-A") == []


async def test_dedup_handles_none_existing_list():
    """A None existing list → no failures (defer to caller)."""
    art = _Artifact(concept_ids=["c1"], source_ids=["s1"])
    assert _check_duplicate(art, None, prompt_template_sha="sha-A") == []


async def test_validate_artifact_dedup_integration_with_prompt_sha():
    """End-to-end: a colliding prompt_sha triggers review_queue."""
    art = _Artifact(concept_ids=["c1"], source_ids=["s1"])
    existing = [
        {"concept_ids": ["c1"], "source_ids": ["s1"], "prompt_template_sha": "sha-X"}
    ]
    result = await validate_artifact(
        art, existing_artifacts=existing, prompt_template_sha="sha-X"
    )
    assert result.review_queue is True
    assert any("duplicate" in w for w in result.warnings)
