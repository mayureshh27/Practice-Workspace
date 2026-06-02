"""Tests for the Eval Gate harness primitive (Phase 4 H-M4).

Covers:

* :class:`SocraticGate` — the post-generation no-leak filter from
  ADR-0013 (tests live in ``test_tracer_bullet.py``; this module
  focuses on the new ``LocalSandboxRunner``).
* :class:`LocalSandboxRunner` — the concrete :class:`SandboxRunner`
  implementation that the artifact gate's ``_check_runability``
  calls. Without this, the runability check was dead code
  (layered review H-M4).
"""

from __future__ import annotations

import sys

import pytest

from app.harness.eval_gate import EvalResult, LocalSandboxRunner, SocraticGate

# ── LocalSandboxRunner ──────────────────────────────────────────────


@pytest.fixture
def runner() -> LocalSandboxRunner:
    return LocalSandboxRunner()


async def test_local_sandbox_runs_clean_python(runner):
    result = await runner.run("print('hi')", "python", timeout_seconds=5)
    assert result["exit_code"] == 0
    assert "hi" in result["stdout"]
    assert result["stderr"] == ""


async def test_local_sandbox_returns_nonzero_on_runtime_error(runner):
    result = await runner.run("raise ValueError('boom')", "python", timeout_seconds=5)
    assert result["exit_code"] != 0
    assert "ValueError" in result["stderr"] or "boom" in result["stderr"]


async def test_local_sandbox_returns_nonzero_on_syntax_error(runner):
    result = await runner.run("def (", "python", timeout_seconds=5)
    assert result["exit_code"] != 0
    # SyntaxError lands in stderr; the exact wording varies by version.
    assert result["stderr"]


async def test_local_sandbox_times_out_with_exit_code_124(runner):
    """An infinite loop is killed with the conventional timeout code."""
    result = await runner.run("while True: pass", "python", timeout_seconds=1)
    assert result["exit_code"] == 124
    assert "timeout" in result["stderr"].lower()


async def test_local_sandbox_rejects_non_python(runner):
    """Non-python languages are unsupported → exit_code=1, fail closed."""
    result = await runner.run("echo hi", "javascript", timeout_seconds=5)
    assert result["exit_code"] == 1
    assert "python" in result["stderr"].lower()


async def test_local_sandbox_uses_configured_executable(tmp_path):
    """``python_executable`` is honoured (used in CI / venvs)."""
    custom = LocalSandboxRunner(python_executable=sys.executable)
    result = await custom.run(
        "import sys; print(sys.executable)", "python", timeout_seconds=5
    )
    assert result["exit_code"] == 0
    assert sys.executable in result["stdout"]


# ── Socratic Gate (smoke — full coverage is in test_tracer_bullet) ─


def test_socratic_gate_smoke():
    """``SocraticGate`` is exported and instantiable from this module."""
    gate = SocraticGate()
    assert gate.gate_name == "socratic"
    # Artifact path is pass-through by design.
    result = gate.validate_artifact({"foo": "bar"})
    assert isinstance(result, EvalResult)
    assert result.passed is True
