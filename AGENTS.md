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
