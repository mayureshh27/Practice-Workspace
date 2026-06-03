"""Eval Gate — harness primitive for artifact and hint validation.

Includes the **Socratic Gate** (ADR-0013): a permanent post-generation
eval check on every tutor response. Three binary conditions:
  1. No solution code
  2. No direct answer
  3. Response ends with a question

Responses failing (1) or (2) are blocked and a HintLeakage event is logged.
Responses failing only (3) get a guiding question appended.

Also includes the **LocalSandboxRunner**: a concrete implementation of
the :class:`app.harness.artifact_gate.SandboxRunner` protocol that
runs Python code in a subprocess with a timeout (layered review H-M4).
Remote-execution backends (firecracker, gVisor, modal) are out of
scope for v1.

Pydantic Evals wired after foundation tests pass (ADR-0011). This module
defines both the Protocol interface and the concrete SocraticGate.
"""

from __future__ import annotations

import asyncio
import re
import subprocess
import sys
from typing import Any, Protocol

import logfire
from pydantic import BaseModel


class EvalResult(BaseModel):
    """Result of an eval check."""

    passed: bool
    gate_name: str = ""
    failures: list[str] = []
    warnings: list[str] = []
    amended_text: str | None = None  # set when the gate amends the response


class EvalGate(Protocol):
    """Validate artifacts and hints before they reach the learner."""

    def validate_artifact(self, artifact: Any) -> EvalResult: ...

    def validate_hint(self, hint: str, context: Any) -> EvalResult: ...


# ── Code detection patterns ─────────────────────────────────────────

# Matches fenced code blocks containing function/method/class bodies
_CODE_BLOCK_RE = re.compile(
    r"```\w*\n"  # opening fence
    r"(?:.*\n)*?"  # any lines
    r"(?:"
    r"(?:def|func|function|fn)\s+\w+|"  # function definitions
    r"class\s+\w+|"  # class definitions
    r"(?:for|while|if).*\{|"  # control flow with braces
    r"return\s+\S+"  # return statements
    r")"
    r"(?:.*\n)*?"
    r"```",
    re.IGNORECASE,
)

# Matches inline complete function bodies (no fences)
_INLINE_FUNC_RE = re.compile(
    r"(?:def|func|function|fn)\s+\w+\s*\([^)]*\)\s*(?:->.*?)?\s*[:{]",
    re.IGNORECASE,
)

# ── Direct answer patterns ──────────────────────────────────────────

_DIRECT_ANSWER_PATTERNS = [
    re.compile(r"^(?:the\s+)?answer\s+is\b", re.IGNORECASE),
    re.compile(r"^here(?:'s| is) the (?:solution|answer|code|fix)\b", re.IGNORECASE),
    re.compile(r"^the (?:solution|fix|correct answer) is\b", re.IGNORECASE),
    re.compile(
        r"^you (?:should|need to|just need to) (?:use|write|change|replace)\b", re.IGNORECASE
    ),
    re.compile(r"^simply (?:use|write|change|replace|add|remove)\b", re.IGNORECASE),
    re.compile(r"^just (?:use|write|change|replace|do)\b", re.IGNORECASE),
]


class SocraticGate:
    """Permanent post-generation filter for tutor responses.

    This is an architectural component, not a temporary safety net.
    The gate is never relaxed (CONTEXT.md).
    """

    gate_name: str = "socratic"

    def validate_artifact(self, artifact: Any) -> EvalResult:
        """Pass-through for non-hint artifacts."""
        return EvalResult(passed=True, gate_name=self.gate_name)

    def validate_hint(self, hint: str, context: Any = None) -> EvalResult:
        """Run all three Socratic conditions on a tutor response.

        Returns:
          - ``passed=True`` if all three pass (response is safe to send)
          - ``passed=True`` with ``amended_text`` if only question-ending failed
          - ``passed=False`` if code leak or direct answer detected
        """
        failures: list[str] = []
        warnings: list[str] = []

        # ── 1. No solution code ─────────────────────────────────────
        has_code_block = bool(_CODE_BLOCK_RE.search(hint))
        has_inline_func = bool(_INLINE_FUNC_RE.search(hint))
        if has_code_block or has_inline_func:
            failures.append("code_leak: Response contains solution code")
            logfire.warning("Socratic Gate: code_leak detected in tutor response")

        # ── 2. No direct answer ─────────────────────────────────────
        stripped = hint.strip()
        for pattern in _DIRECT_ANSWER_PATTERNS:
            if pattern.search(stripped):
                failures.append("answer_leak: Response starts with direct answer pattern")
                logfire.warning("Socratic Gate: answer_leak detected in tutor response")
                break

        # Hard failures — block the response
        if failures:
            return EvalResult(
                passed=False,
                gate_name=self.gate_name,
                failures=failures,
                warnings=warnings,
            )

        # ── 3. Ends with a question ─────────────────────────────────
        amended_text: str | None = None
        if not stripped.rstrip().endswith("?"):
            warnings.append("missing_question: Response does not end with a question")
            amended_text = (
                hint.rstrip() + "\n\nWhat aspect of this would you like to explore further?"
            )
            logfire.info("Socratic Gate: appended guiding question to tutor response")

        return EvalResult(
            passed=True,
            gate_name=self.gate_name,
            failures=[],
            warnings=warnings,
            amended_text=amended_text,
        )


# ── Local sandbox ───────────────────────────────────────────────────


class LocalSandboxRunner:
    """Concrete :class:`SandboxRunner` that runs code in a subprocess.

    Implements the :class:`app.harness.artifact_gate.SandboxRunner`
    protocol so the artifact gate's ``_check_runability`` can be
    exercised end-to-end in v1 (layered review H-M4). Remote-execution
    backends (firecracker, gVisor, modal) are out of scope.

    Constraints:

    * **Python only** for v1. Other languages are not supported;
      the runner returns ``exit_code=1`` with a warning so the gate
      fails closed.
    * **Subprocess with timeout** — the runner refuses to wait
      forever for the LLM-generated code to terminate.
    * **No network isolation** — this is a local dev/CI sandbox, not
      a production isolate. Do not point it at untrusted internet
      code without layering a real sandbox on top.
    """

    def __init__(self, python_executable: str | None = None) -> None:
        self._python = python_executable or sys.executable

    async def run(
        self,
        code: str,
        language: str,
        timeout_seconds: int = 30,
    ) -> dict[str, Any]:
        """Execute ``code`` and return ``{exit_code, stdout, stderr}``.

        Timeouts surface as ``exit_code=124`` (the conventional GNU
        coreutils timeout code) plus a stderr note. The gate treats
        any non-zero exit code as a runability failure.
        """
        if language.lower() != "python":
            return {
                "exit_code": 1,
                "stdout": "",
                "stderr": (
                    f"LocalSandboxRunner only supports 'python' (got "
                    f"'{language}'). Skip runability check."
                ),
            }

        def _exec() -> subprocess.CompletedProcess[str]:
            return subprocess.run(
                [self._python, "-c", code],
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )

        try:
            completed = await asyncio.to_thread(_exec)
        except subprocess.TimeoutExpired as exc:
            stdout_str = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
            stderr_str = exc.stderr.decode() if isinstance(exc.stderr, bytes) else (exc.stderr or "")
            return {
                "exit_code": 124,
                "stdout": stdout_str,
                "stderr": (
                    f"{stderr_str}\n"
                    f"[LocalSandboxRunner] code exceeded {timeout_seconds}s timeout"
                ).strip(),
            }
        except Exception as exc:  # network FS errors, OOM, etc.
            logfire.warning("LocalSandboxRunner: subprocess failed: {error}", error=str(exc))
            return {
                "exit_code": 1,
                "stdout": "",
                "stderr": f"[LocalSandboxRunner] {exc!s}",
            }

        return {
            "exit_code": completed.returncode,
            "stdout": completed.stdout,
            "stderr": completed.stderr,
        }
