"""Tests for the canonical ``new_id()`` helper.

Refs: M-B2 (canonical ``new_id``), R-2.1.
"""

from __future__ import annotations

import re

from app.api._ids import new_id


def test_new_id_returns_str_with_prefix() -> None:
    """``new_id('foo')`` returns a string starting with ``foo-``."""
    assert new_id("foo").startswith("foo-")


def test_new_id_shape_is_prefix_ms_timestamp_hex() -> None:
    """Format: ``{prefix}-{13_digit_ms_timestamp}-{8_hex}``."""
    pattern = re.compile(r"^[a-z][a-z\-]*-\d{13,}-[0-9a-f]{8}$")
    assert pattern.match(new_id("art"))
    assert pattern.match(new_id("wf"))
    assert pattern.match(new_id("wf-dup"))
    assert pattern.match(new_id("wf-fork"))


def test_new_id_is_unique_under_burst() -> None:
    """Two back-to-back calls return different ids (suffix differs).

    The 8-hex suffix is the contract — even two calls inside the
    same millisecond must not collide (the pre-Phase-1 timestamp-only
    format did; see the diagnose history).
    """
    assert new_id("burst") != new_id("burst")


def test_new_id_default_prefix_is_id() -> None:
    """``new_id()`` with no args uses the ``id`` prefix."""
    assert new_id().startswith("id-")
