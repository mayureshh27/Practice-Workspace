"""Canonical id generation for runtime-created entities.

Replaces ad-hoc ``int(time.time() * 1000)`` call sites that
collided when two writes landed in the same millisecond (verified
during diagnose; see the pre-Phase-1 ``practice_exercises.py`` for
the original comment). The fix is a single function that always
returns a sortable, collision-resistant id with a human-readable
prefix.

Format: ``{prefix}-{ms_timestamp}-{8_hex_chars}``

* ``ms_timestamp`` keeps ids lexicographically sortable by
  creation — useful for "newest first" listings that don't need a
  separate ``created_at`` column to sort on.
* The 8 hex chars from ``uuid4()`` guarantee no collisions even
  for concurrent calls in the same millisecond, so the
  timestamp-collision workaround the old code carried around
  (a separate ``uuid.uuid4().hex[:8]`` suffix inlined at each
  call site) goes away.
* The prefix (``art-``, ``wf-``, ``wf-dup-``, ``wf-fork-``) makes
  log lines and DB rows self-describing.

Refs: M-B2 (canonical ``new_id``), R-2.1 (storage paths).
"""

from __future__ import annotations

import time
import uuid


def new_id(prefix: str = "id") -> str:
    """Return a collision-resistant, lexicographically-sortable id.

    Parameters
    ----------
    prefix
        Human-readable short tag (e.g. ``"art"``, ``"wf"``,
        ``"wf-dup"``). The result always starts with ``"{prefix}-"``.

    Returns
    -------
    str
        ``"{prefix}-{ms_timestamp}-{8_hex}"``

    Examples
    --------
    >>> new_id("art").startswith("art-")
    True
    >>> new_id("art") != new_id("art")
    True
    """
    return f"{prefix}-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
