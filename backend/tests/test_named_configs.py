"""Tests for the Named Harness Configs (Phase 8)."""

from __future__ import annotations

from app.harness.named_configs import NAMED_CONFIGS


def test_named_configs_registry_contains_all_roles():
    """Verify NAMED_CONFIGS maps all 5 agent roles correctly (ADR-0018)."""
    assert "tutor" in NAMED_CONFIGS
    assert "ingestion" in NAMED_CONFIGS
    assert "workflow" in NAMED_CONFIGS
    assert "session_summary" in NAMED_CONFIGS
    assert "eval" in NAMED_CONFIGS

    # Verify deep source contracts
    assert NAMED_CONFIGS["ingestion"].deep_source is True
    assert NAMED_CONFIGS["tutor"].deep_source is False
    assert NAMED_CONFIGS["workflow"].deep_source is False
