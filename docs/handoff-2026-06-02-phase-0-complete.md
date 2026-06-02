# Handoff — 2026-06-02 — Phase 0 complete, continue Phases 1–15

> This handoff lives in the repo (`docs/handoff-2026-06-02-phase-0-complete.md`)
> per the `AGENTS.md` rule. It is for the new chat session that will
> continue the 15-phase review-fix cycle.

## TL;DR for the next agent

**Phase 0 of the review-fix cycle is DONE, committed, and pushed.** The
foundation is in place: TypeScript feedback loop (Husky, lint-staged,
Prettier, typecheck, vitest) and Python feedback loop (ruff, mypy,
pytest-cov). Pre-existing errors are visible but advisory.

**Your job: continue with Phase 1.** The full 15-phase plan is at
[`docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`](plan/implementation-plan-2026-06-02-review-fix-cycle.md).
The dependency graph in §2 of that plan tells you what must come before
what. **Do not start a phase whose dependencies have not landed.**

The plan's branching convention is **Graphite stacked PRs** — see the
"gt loop" below. **Graphite is strict, not optional** (see the "Graphite
practices — STRICT" section).

## Current state (resume point)

| Item | State |
|---|---|
| Branch | `feat/foundation-0-feedback-loops` (pushed, ready for `gt submit --stack` when the user wants) |
| Trunk | `main` |
| Last commit (this phase) | see `git log feat/foundation-0-feedback-loops -1` |
| Working tree | Clean (only untracked: `skills-lock.json`, ignored by `.gitignore`) |
| `gt auth` | `Authenticated as: mayureshh27` ✅ |
| `git push` | Works (Windows Credential Manager holds the GitHub PAT) |
| Env keys | None set. The `"test"` provider fallback handles non-live runs. |
| Pre-push hook | Installed at `.husky/pre-push`; `core.hooksPath = .husky`; runs advisory (typecheck, ruff, mypy are `\|\| true`) until Phases 12/14 land |
| Aggregate gate | `make check` from repo root |

## Phase 0 — what landed

### Frontend
- `frontend/package.json` — added scripts: `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test:watch`. Added devDeps: `husky`, `lint-staged`, `prettier`, `eslint-config-prettier`.
- `frontend/.prettierrc.json` — 100-col, single quotes, trailing commas.
- `frontend/.prettierignore` — dist, node_modules, .tanstack, .vite, routeTree.gen.ts.
- `frontend/.lintstagedrc.json` — Prettier + ESLint on staged `.ts/.tsx/.js/.jsx/.json/.md/.css/.yml/.yaml`.
- `frontend/eslint.config.js` — extends with `eslint-config-prettier` (must be last).
- `frontend/tests/appState.test.ts` — converted from `node:test` to vitest syntax (5 tests pass).

### Backend
- `backend/pyproject.toml` — `[tool.ruff]` (E,W,F,I,B,UP,N,SIM,RUF), `[tool.mypy]` (lenient, ignores for graphiti/qdrant/kuzu/litellm), `[tool.coverage]` (`fail_under=55` baseline), `[tool.pytest.ini_options]` (`asyncio_mode=auto`).
- New dev deps via `uv add --dev`: `ruff`, `mypy`, `pytest-cov`, `types-PyYAML`.
- `uv run ruff check --fix` auto-cleaned 38 lint issues across 19 `app/` files (import sorting, f-string prefixes, line length).

### Hooks (manual setup — husky 9 has a Windows init bug)
- `.husky/pre-commit` — runs `lint-staged` on staged files under `frontend/` (Prettier only — see "Pre-existing tech debt" below) and `ruff format` + `ruff check --fix` (advisory) on staged files under `backend/`. Patterns are scoped (`^frontend/`, `^backend/`) so a `.md` in `docs/` doesn't trigger the hook. Path conversion handles Windows backslashes.
- `.husky/pre-push` — runs `pnpm typecheck` (advisory), `pnpm test` (strict), `ruff check` (advisory), `mypy app/` (advisory), `pytest --cov=app --cov-fail-under=55 --ignore=tests/test_workspace_api.py` (strict).
- `git config core.hooksPath .husky` (set once; persists in the local repo config).

### Repo-level
- `Makefile` — `make check` runs the full gate; `make format`, `make lint`, `make test`, `make build` are also wired.
- `AGENTS.md` — added a "Feedback loops" section pointing at this plan and the `make check` shortcut.
- `.gitignore` — explicit rules for `backend/data`, `.env`, `.venv`, `.agents`, etc. (Restored `.env/.env.*` that the previous version was missing.)

## Pre-existing errors now visible (advisory)

| Tool | Count | Fix in |
|---|---|---|
| `pnpm typecheck` | 27 | Phase 12 (frontend type contracts) |
| `uv run ruff check` | 18 | Phase 14 (housekeeping) |
| `uv run mypy app/` | 38 | Phase 14 (housekeeping) |
| `pytest --cov` | 57% (floor 55%) | Phase 14 raises floor to 80% |

Run them manually anytime:
```bash
cd frontend && pnpm typecheck
cd backend && uv run ruff check .
cd backend && uv run mypy app/
cd backend && uv run pytest --cov=app
```

## Pre-existing tech debt surfaced (do NOT fix in Phase 0)

| Item | Where | What to do |
|---|---|---|
| `frontend/eslint.config.js` imports 5 packages that are NOT in `frontend/package.json` (`@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`, plus `eslint` itself) | `frontend/eslint.config.js` | Phase 14 — either install the full ESLint stack or delete the file. **Not Phase 0**, because installing ESLint + plugins is a sizeable change that belongs with the housekeeping pass. |
| `pnpm lint` / `pnpm lint:fix` scripts removed from `frontend/package.json` | `frontend/package.json` | Re-add after Phase 14 lands ESLint. |
| `.gitignore` previously dropped `.env` and `.env.*` | `.gitignore` | **Already restored in this commit.** Verify `git check-ignore -v .env` returns the rule. |

## Auth state (verified this session)

- ✅ `gt auth` = `mayureshh27` — Graphite PRs will work
- ✅ `git push` to `https://github.com/mayureshh27/Practice-Workspace.git` works
- ⚠️ No LLM API keys in env. Practice gen will use the `"test"` provider stub for non-live runs. Live smoke of Phase 3+ needs `OPENAI_API_KEY` / `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY`.

## Open questions (the user has not answered)

1. **Wire or delete the ingestion modal?** Plan recommends wire. Ask before Phase 10.
2. **Backend `name` field aliasing.** Plan keeps `title` as alias for one minor version in Phase 5.
3. **Coverage floor for pytest-cov.** Currently 55%. Plan ratchets to 80% in Phase 14.
4. **LiteLLM gateway decision.** Per `docs/adr/0003-ai-runtime-uses-pydantic-ai-first.md`, a central LiteLLM gateway is deferred. The user asked about it on 2026-06-02; the current plan keeps Pydantic AI direct. If the user wants to elevate LiteLLM to gateway, that's a new ADR + Phase 3 redesign.

## gt loop (recap)

```bash
# From the repo root, starting from Phase 0's branch:
git checkout main
git pull --rebase
gt create feat/backend-1-ids-and-storage     # stacks on Phase 0
# ... commit work ...
gt submit --stack                            # opens a PR for each branch in the stack
gt restack                                   # after main moves
gt absorb                                    # auto-attribute fixups to the right branch
```

**Do not commit secrets, do not force-push, do not skip hooks.** If a
hook fires and you think it's wrong, read the error and fix the code.
The feedback loop is the contract.

## Graphite practices — STRICT (the next agent must follow these)

The plan calls for **15 phases, each as its own branch in a single
stacked PR**. This is enforced by Graphite (the `gt` CLI). The rule
lives in
[`docs/adr/0030-agents-must-use-graphite-stacked-prs.md`](adr/0030-agents-must-use-graphite-stacked-prs.md).
Treat the following as non-negotiable:

### 1. One branch per phase, named exactly per the plan

| Phase | Branch (exact) |
|---|---|
| 0 (done) | `feat/foundation-0-feedback-loops` |
| 1 | `feat/backend-1-ids-and-storage` |
| 2 | `feat/backend-2-qdrant-resilience` |
| 3 | `feat/backend-3-payload-shapes` |
| 4 | `feat/backend-4-gate-wiring` |
| 5 | `feat/backend-5-workflow-routes` |
| 6 | `feat/backend-6-context-wiring` |
| 7 | `feat/backend-7-graph-hardening` |
| 8 | `feat/backend-8-orchestration` |
| 9 | `feat/frontend-9-screen-decomposition` |
| 10 | `feat/frontend-10-ingestion-truth` |
| 11 | `feat/frontend-11-store-cleanup` |
| 12 | `feat/frontend-12-type-contracts` |
| 13 | `feat/backend-13-template-registry` |
| 14 | `feat/housekeeping-14-misc-cleanups` |
| 15 | `feat/verify-15-final-gates` |

**Never** create a phase branch with a different prefix. **Never** put
two phases on one branch. **Never** branch off main with `git checkout
-b`; use `gt create` so the branch stacks on its parent.

### 2. Stack discipline

- Always start the next phase from the previous phase's branch
  (`gt create feat/backend-2-qdrant-resilience` while on
  `feat/backend-1-ids-and-storage`).
- `gt restack` after every change to `main` (rebase the whole stack on
  new main tip).
- `gt absorb` after every fixup commit — let Graphite decide which
  branch in the stack the fix belongs to. **Do not** hand-curate which
  branch gets a fix.
- `gt submit --stack` opens one PR per branch. **Do not** open PRs
  manually with `gh pr create`; the stack is the contract.

### 3. Commit hygiene (strict)

- **One logical change per commit.** If a commit message has "and" in
  the subject, split it.
- **No fixup commits in the final stack.** Squash or `gt absorb` before
  submitting.
- **Subject line ≤ 72 chars, imperative mood, scoped:**
  `feat(backend): add canonical new_id` not `added new id stuff`.
- **Body explains WHY, not WHAT.** The diff shows what; the body
  should justify the choice or link the review finding (e.g.
  `Refs: M-B2, R-2.1`).
- **Never commit secrets, .env files, or build artifacts.** The
  `.gitignore` and pre-commit hook enforce this; if you find a way
  around them, fix the gap, don't bypass it.

### 4. No force-pushes to a submitted branch

- Force-push only on branches that are still local in the stack.
- After `gt submit --stack`, the PR exists; subsequent changes go
  through `gt modify` (which rebases safely) or a new commit that
  Graphite absorbs into the right branch.
- **Never** `git push --force` or `git push --force-with-lease` to a
  branch that has an open PR.

### 5. Hooks are the contract

- **Never** `git commit --no-verify` or `git push --no-verify`. If a
  hook fires, the diff is wrong — fix it.
- If a hook is wrong (e.g. it fails on a file pattern it shouldn't
  touch), fix the hook in Phase 0, not in your phase.
- The pre-push hook is **advisory on typecheck/ruff/mypy** until
  Phases 12/14 close the loop. Tests and coverage are strict. Don't
  lower the bar.

### 6. Auth (verified this session)

- `gt auth` = `mayureshh27` ✅
- `git push` to `https://github.com/mayureshh27/Practice-Workspace.git`
  works (Windows Credential Manager holds the PAT).
- No LLM API keys in env. The `"test"` provider stub handles non-live
  runs. Live smoke of Phase 3+ needs `OPENAI_API_KEY` / `GOOGLE_API_KEY` /
  `ANTHROPIC_API_KEY`.

### 7. Daily ritual for the AI agent

At the start of every work session:

```bash
cd /d/Robotics/Learning-Platform/Practice-tool
git checkout main
git pull --rebase
gt log short                                 # see current stack state
gt restack                                   # rebase stack on new main, if any
make check                                   # verify foundation is green
```

At the end of every work session (before the chat ends):

```bash
# All work committed, stack is local:
gt log short                                 # confirm N branches in the stack
make check                                   # confirm foundation still green
# If a phase is "done" and user wants to submit:
gt submit --stack --no-edit                  # opens N PRs
```

### 8. When the user says "commit and push" or "submit the stack"

- If only one phase is done, `git push origin <branch>` is fine (the
  branch is tracked by Graphite).
- If a whole milestone of phases is done, prefer `gt submit --stack`
  so each phase has its own PR for review.
- **Never** merge a PR manually. The user merges after review.

### 9. What Graphite is NOT for

- Graphite is not a substitute for good commits. The diff inside a
  branch still needs to be small, focused, and reviewable.
- Graphite is not a magic rebase tool. If two phases interleave
  awkwardly, that's a planning problem — go back to the plan, not to
  Graphite.
- Graphite is not a CI runner. CI runs on the PR; the local hooks are
  for the AI's own feedback loop.

### 10. If Graphite is unavailable or breaks

- Fall back to plain `git` branches named exactly as above, with the
  same `feat/*` prefix. Document the deviation in the phase's PR body
  (`## Graphite deviation: <reason>`).
- Never silently fall back to `main` and push there. The whole point
  of stacked PRs is per-phase review.

## Phases 1–15 — quick reference

The full plan is in `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`.
Here is the order with the dependency each phase satisfies:

| Phase | Branch | Depends on | Findings (per the two reviews) |
|---|---|---|---|
| 1 | `feat/backend-1-ids-and-storage` | Phase 0 | M-B2, R-2.1 (canonical `new_id` + `backend/data/` paths) |
| 2 | `feat/backend-2-qdrant-resilience` | Phase 0 | M-B1, M-B3, M-H1, M-H2 (Qdrant healthz, model pin, no silent fallback) |
| 3 | `feat/backend-3-payload-shapes` | Phase 0 | 5.1, 5.2, R-2.3, R-2.4, M-H3 deferred (PracticePayload discriminated union, factory) — **AI runtime decision point** |
| 4 | `feat/backend-4-gate-wiring` | Phase 3 | H-B5, H-H1, H-H2, H-H4, H-H5, H-H6, R-2.5 (artifact_gate + eval_gate + event_emitter + is_configured) |
| 5 | `feat/backend-5-workflow-routes` | Phase 4 | H-B1, H-B2, H-B3, H-B4, X-1, X-2 (`/customize` + real `/run` + `eval_runs`) |
| 6 | `feat/backend-6-context-wiring` | Phase 3 | C-B1, C-B2, C-B3, C-H1–C-H5 (9-slot context gate, tiktoken, per-call deep_source) |
| 7 | `feat/backend-7-graph-hardening` | Phase 1 | G-B1, G-B2, G-B3, G-B4, G-B5, G-H1–G-H4, M-H6 (schema versioning, batched Cypher, alias concurrency fix) |
| 8 | `feat/backend-8-orchestration` | Phase 0 | H-H6, H-H7, H-M1, H-M2, R-2.2, R-2.5 (ingestion route, compaction, per-request agent) |
| 9 | `feat/frontend-9-screen-decomposition` | Phase 5 | R-1.1, R-2.8, R-3.1 (decompose 983-line `SourceNotebookScreen.tsx`; leave IngestionModal for Phase 10) |
| 10 | `feat/frontend-10-ingestion-truth` | Phase 8 + Phase 9 | R-1.2 (extract IngestionModal + wire to `POST /api/sources/ingest`) |
| 11 | `feat/frontend-11-store-cleanup` | Phase 5 | R-1.3, R-1.4, R-2.4, R-2.6, R-2.7, R-3.2 (delete store-level server-data, delete `mockData.ts`, remove `as any`, `updateInTree` helper) |
| 12 | `feat/frontend-12-type-contracts` | Phase 11 | R-2.9, R-3.1, R-3.3, R-3.4, R-3.5 (EvalGate enum, Difficulty/Scope/Target Literal, ArtifactPayload discriminator) — **also fixes the 27 `pnpm typecheck` errors** |
| 13 | `feat/backend-13-template-registry` | Phase 0 | H-H3, H-H4, M-H5 (concrete `CompositeWorkflowTemplate`, `DefaultToolRegistry`, Graphiti cache invalidation) |
| 14 | `feat/housekeeping-14-misc-cleanups` | All | Medium/low from both reviews; **also fixes the 18 ruff + 38 mypy errors and raises the coverage floor to 80%** |
| 15 | `feat/verify-15-final-gates` | All | Read-only verification: `make check`, live smoke, `gt log --stack` shows 15 clean branches, `gt submit --stack` opens 15 PRs |

## Sharp edges and mitigations (from the plan §4)

| Phase | Risk | Mitigation |
|---|---|---|
| 3 (payload shapes) | Stricter parse rejects shapes the LLM produces | Union covers all 3 observed shapes; existing 28 tests pass; manual smoke; 6 new tests |
| 9 (decompose 983 lines) | Feature loss during split | Existing 5 frontend tests pass; manual smoke of all 5 features; 4 new component tests; visual diff |
| 11 (store cleanup) | Empty initial state → first-render flash | Components render "Loading…"; vitest with slow-resolving query mock; `gt restack` re-tests prior phases |

## Review docs (reference only — do not re-derive)

- `docs/reviews/review.md` (394 lines) — chat-style review: 5 blockers, 12 high, 19 medium. Frontend-heavy.
- `docs/reviews/code-review-by-layer.md` (645 lines) — layered review: 5 cross-cutting blockers, 12 high, 19 medium. Backend-heavy.
- `docs/adr/0001..0029` — all 30 ADRs.
- `docs/adr/0030-agents-must-use-graphite-stacked-prs.md` — the branching rule.

## What NOT to redo (carried-forward decisions)

- The 12 commits on `feat/studio-workflows-integration` (now part of `main`) — do not rewrite
- The README rewrite on `dev` (`10a471a`) — keep as-is
- The repo migration to `Practice-Workspace` — already executed
- `legacy-fork-main` and `revamp-frontend-design` branches on the new remote — keep for reference
- ADR-0003 (Pydantic AI first, LiteLLM gateway deferred) — unless a new ADR elevates it
- The advisory pre-push hook — leave advisory until Phase 12/14 lands

## Quick smoke test for the next session

```bash
# Verify the foundation still works
cd /d/Robotics/Learning-Platform/Practice-tool
git checkout feat/foundation-0-feedback-loops
make check
gt log short
```

Expected: 5 frontend tests + 59 backend tests pass, 18 ruff + 38 mypy + 27 tsc errors advisory, Graphite stack shows Phase 0 on top of main.
