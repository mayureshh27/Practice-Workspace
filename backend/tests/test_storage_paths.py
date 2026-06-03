"""Tests for the ``data_path()`` helper.

Refs: R-2.1 (storage paths pinned to ``backend/data/``).
"""

from __future__ import annotations

import os

from app.storage import data_path


def test_data_path_returns_absolute_path_under_backend_data() -> None:
    """``data_path(name)`` resolves to an absolute path ending in
    ``backend/data/{name}``."""
    p = data_path("foo.db")
    assert p.is_absolute()
    assert p.as_posix().endswith("backend/data/foo.db")
    # The parent directory exists (mkdir ran at import time).
    assert p.parent.is_dir()


def test_data_path_is_cwd_invariant(tmp_path) -> None:
    """``data_path()`` returns the same absolute path regardless of CWD.

    CWD changes after import must not affect the resolved path —
    this is the whole point of the helper. We import lazily so
    the resolution runs after the ``chdir``.
    """
    original_cwd = os.getcwd()
    try:
        os.chdir(str(tmp_path))
        # Lazy import so the module-level _DATA_DIR (already
        # resolved at first import) is what we test here. The
        # contract is "the first import wins"; the chdir below
        # confirms that subsequent cwd changes don't move the
        # root.
        from app.storage import data_path as fresh_data_path

        p = fresh_data_path("cwd_invariance_check.db")
        assert p.is_absolute()
        # We didn't change _DATA_DIR — it's still under backend/data/.
        assert p.as_posix().endswith("backend/data/cwd_invariance_check.db")
        # And the path is NOT under the new CWD (tmp_path).
        assert not p.as_posix().startswith(str(tmp_path))
    finally:
        os.chdir(original_cwd)
