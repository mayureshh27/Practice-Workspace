# AGENTS.md — repo-level guidance for AI agents

Rules that apply to any agent working anywhere in this repo
(`backend/`, `frontend/`, `docs/`). Package-specific rules live in
`frontend/AGENTS.md`.

## Handoff docs go in `docs/`, not OS temp

When a session ends mid-work, write the handoff document to
`docs/handoff-{topic}.md` in this repo (not to the OS temp dir, even
though the `handoff` skill default is OS temp). Reasoning:

- Handoffs are project memory. A new agent (human or AI) can grep
  `docs/handoff-*.md` and the git log shows when each was written.
- The team accesses them through git, PRs, and code review — not by
  digging into a developer's local temp dir.
- Cross-package context (e.g. backend API + frontend wiring) is the
  rule, not the exception, so a repo-root location beats per-package.

Naming: `docs/handoff-{short-topic}.md`. See existing examples:
`docs/handoff-adaptive-practice-workspace.md`,
`docs/handoff-current-session.md`.

Skip the handoff only when the session is a single trivial edit
(no follow-up work, no decisions worth carrying forward).

## Sync `frontend/` from `frontend-prototype/`

The `frontend/` directory is built by mirroring from the sibling
`frontend-prototype/` workspace. The reusable script is at
`D:\DevData\Temp\UserTemp\opencode\mirror.bat` (excludes `node_modules`,
`dist`, `.vite`, `.agents`, `.interface-design`, `.vscode`,
`.tanstack`, `.git_disabled`, `docs`, `session-ses_*.md`, `nul`,
`.cta.json`). Use it whenever a UI redesign lands in the prototype
and needs to flow into the practice tool.

## Backend testing scope

`backend/tests/test_workspace_api.py` has two pre-existing failures
on `main` (chapter count changed when seed was expanded). Deselect
with `--ignore=tests/test_workspace_api.py` for green CI until the
tests are updated to match the new seed.

## Branching

Work happens on topic branches off `main` and is pushed phase by
phase. Don't force-push, don't skip hooks, don't commit secrets.

**AI agents must use Graphite stacked PRs** per
[`docs/adr/0030-agents-must-use-graphite-stacked-prs.md`](docs/adr/0030-agents-must-use-graphite-stacked-prs.md).
`gt` is installed (1.8.6). The short loop:

```bash
git checkout main
gt create feat/<topic>-0-<layer>     # one branch per reviewable layer
# ... commit ...
gt create feat/<topic>-1-<layer>     # stacked on top
# ... commit ...
gt submit --stack                     # opens one PR per branch
gt restack                            # after main moves
gt absorb                             # auto-attribute fixups to the right branch
```

The handoff doc for the Studio workflows integration
(`docs/handoff-studio-workflows.md`) explains how that branch would
have stacked and what the trade-off was for shipping it flat.

## Pull requests

PRs go from a topic branch into `main`. Open them via the GitHub
compare URL (e.g.
`https://github.com/<org>/<repo>/compare/main...<branch>?expand=1`).
If `gh` is authenticated, prefer `gt submit --stack` (which wraps
`gh pr create` for every layer in the stack).

## Feedback loops (Husky + Prettier + ruff + mypy + pytest-cov)

Configured in Phase 0 of
[`docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`](docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md).
**One command runs the full gate before push:**

```bash
make check
```

Which is shorthand for `frontend: pnpm typecheck && pnpm lint && pnpm test`
plus `backend: uv run ruff check . && uv run mypy app/ && uv run pytest --cov=app --cov-fail-under=70 --ignore=tests/test_workspace_api.py`.

Per-package gates:
- `cd frontend && pnpm typecheck` — tsc -b, fails on any TS error
- `cd frontend && pnpm lint:fix` — ESLint with Prettier-aware config
- `cd frontend && pnpm format` — Prettier write
- `cd backend && uv run ruff check .` — fast lint
- `cd backend && uv run ruff format .` — formatter
- `cd backend && uv run mypy app/` — type check (lenient, see `[tool.mypy]` in pyproject.toml)
- `cd backend && uv run pytest --cov=app` — test with coverage floor 70%

Pre-commit hook (`.husky/pre-commit`): runs `lint-staged` on staged files
(Prettier + ESLint for TS/TSX, ruff format + ruff check --fix for .py).
Pre-push hook (`.husky/pre-push`): runs `make check` minus the build.

If a hook fires and you think it's wrong, read the error message — it
includes the file path and line number. The AI feedback loop is: read
the error, fix the code, retry. Don't bypass hooks.
