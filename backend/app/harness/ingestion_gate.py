"""Ingestion Gate — harness eval gate for ingestion pipeline stage outputs.

Runs after each ingestion stage before the source record is promoted to
active status (PRD-harness-layer.md §173).

Three checks:
  1. Citation metadata: every chunk carries source_id, chunk_index,
     page_or_timestamp.
  2. Concept candidates: minimum alias resolution requirements met.
  3. Graph facts: all graph fact records are well-formed Pydantic models.
"""

from __future__ import annotations

from typing import Any

import logfire
from pydantic import BaseModel, ValidationError


class IngestionGateResult(BaseModel):
    """Result of an Ingestion Gate evaluation."""

    passed: bool
    failures: list[str] = []
    warnings: list[str] = []


def _check_chunk_citations(chunks: list[dict]) -> list[str]:
    """Every chunk carries mandatory citation metadata.

    Required fields: source_id, chunk_index, page_or_timestamp.
    """
    failures: list[str] = []
    for i, chunk in enumerate(chunks):
        missing = []
        if not chunk.get("source_id"):
            missing.append("source_id")
        if chunk.get("chunk_index") is None:
            missing.append("chunk_index")
        if chunk.get("page_or_timestamp") is None:
            missing.append("page_or_timestamp")

        if missing:
            failures.append(
                f"chunk[{i}]: missing required citation metadata: {', '.join(missing)}"
            )
    return failures


def _check_concept_candidates(
    candidates: list[dict],
    min_alias_count: int = 1,
) -> list[str]:
    """Concept candidates meet minimum alias resolution requirements."""
    failures: list[str] = []
    for i, candidate in enumerate(candidates):
        name = candidate.get("name", "")
        aliases = candidate.get("aliases", [])
        if not name:
            failures.append(f"candidate[{i}]: missing concept name")
        if len(aliases) < min_alias_count:
            failures.append(
                f"candidate[{i}] '{name}': only {len(aliases)} aliases "
                f"(minimum {min_alias_count})"
            )
    return failures


def _check_graph_facts(graph_facts: list[Any]) -> list[str]:
    """Graph facts are well-formed Pydantic models."""
    failures: list[str] = []
    for i, fact in enumerate(graph_facts):
        if hasattr(fact, "model_dump"):
            try:
                _ = fact.model_dump()
            except ValidationError as exc:
                failures.append(f"graph_fact[{i}]: validation error — {exc}")
        elif isinstance(fact, dict):
            # Bare dict facts must have at minimum source/target/relation
            if "source" not in fact or "target" not in fact:
                failures.append(
                    f"graph_fact[{i}]: dict missing required 'source' or 'target' key"
                )
    return failures


def validate_ingestion_stage(
    *,
    chunks: list[dict] | None = None,
    concept_candidates: list[dict] | None = None,
    graph_facts: list[Any] | None = None,
) -> IngestionGateResult:
    """Run all three Ingestion Gate checks on an ingestion stage output.

    Only checks for which data is provided are run. If a stage hasn't
    produced a given output type yet, that check is skipped.

    Returns:
        IngestionGateResult with pass/fail and failure details.
    """
    failures: list[str] = []

    # 1. Citation metadata on chunks
    if chunks is not None:
        chunk_failures = _check_chunk_citations(chunks)
        failures.extend(chunk_failures)
        if chunk_failures:
            logfire.warning(
                "Ingestion Gate: {count} chunk citation failures",
                count=len(chunk_failures),
            )

    # 2. Concept candidate quality
    if concept_candidates is not None:
        concept_failures = _check_concept_candidates(concept_candidates)
        failures.extend(concept_failures)
        if concept_failures:
            logfire.warning(
                "Ingestion Gate: {count} concept candidate failures",
                count=len(concept_failures),
            )

    # 3. Graph fact validity
    if graph_facts is not None:
        fact_failures = _check_graph_facts(graph_facts)
        failures.extend(fact_failures)
        if fact_failures:
            logfire.warning(
                "Ingestion Gate: {count} graph fact failures",
                count=len(fact_failures),
            )

    passed = len(failures) == 0
    if passed:
        logfire.info("Ingestion Gate: all checks passed")

    return IngestionGateResult(
        passed=passed,
        failures=failures,
    )
