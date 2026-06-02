# Handoff — 2026-06-02 — Implementation start

## Project

**Practice-tool** at `D:\Robotics\Learning-Platform\Practice-tool`
FastAPI + TanStack Router/Query workspace. Branch: `dev`. Remote:
`https://github.com/mayureshh27/Practice-Workspace.git` (renamed this session
from the original `Practice-tool` repo).

This handoff is in the repo at `docs/handoffs/2026-06-02/implementation-start.md`
per the repo-level `AGENTS.md` rule (hendoffs live under
`docs/handoffs/{date}/{topic}.md`). It was originally saved in the user's
OS temp dir at the user's instruction that session; it was migrated to
the repo on 2026-06-02 by `git mv` so the project memory is on disk in
the canonical location.

## Current state (resume point)

| Item | State |
|---|---|
| Branch | `dev` |
| Working tree | Clean (only untracked: `docs/reviews/`, `skills-lock.json`) |
| Last commit | `10a471a docs(readme): rewrite — old PracDaGo Go-practice content replaced` |
| Graphite trunk | `main` (per `gt init --trunk main` earlier this session) |
| Graphite stack | Empty — `gt log` shows `◉ dev` / `◯ main`, no stacked branches yet |
| `gt` CLI | 1.8.6, installed |
| `gh` CLI | Installed but **not authenticated** (verified earlier this session) |
| `pnpm` | Yes; `vitest`, `eslint`, `typescript` already in `frontend/package.json` |
| Backend deps | `uv`-managed; `pyproject.toml` has fastapi/pydantic-ai/logfire/qdrant/kuzu/graphiti-core |
| Backend tests | 28 pass; 2 pre-existing failures in `test_workspace_api.py` deselected per `AGENTS.md` |
| Frontend tests | 1 test (`appState.test.ts`); 5 router/component tests not yet present |
| Pre-commit hooks | **None** — Phase 0 of the plan adds Husky + lint-staged + Prettier + ruff + mypy + pytest-cov |
| Vitest coverage | None configured |
| Editor / formatter | None — Phase 0 adds Prettier |

## Conversation summary (what just happened)

1. Two code-quality reviews were produced and saved into `docs/reviews/`:
   - `docs/reviews/review.md` — the chat-style "thermo-nuclear" review
     (5 blockers: SourceNotebookScreen.tsx at 983 lines, fake ingestion
     mocks, two sources of truth for artifacts, ID collision fixed in 2
     of 4 places, `workspaceStore.ts` re-implements `appState.ts`).
   - `docs/reviews/code-review-by-layer.md` — the layered review
     (5 cross-cutting blockers: `/api/workflows/{id}/run` stub,
     `/api/workflows/{id}/customize` not registered, mastery storage
     path resolves to CWD, Kuzu `aliases` race, eval/artifact gates
     unwired; 12 high; 19 medium/low).
2. The user asked to **combine both reviews into a single implementation
   plan that commits after each phase, on the dev branch, and sets up a
   TypeScript feedback loop** (Husky + lint-staged + Prettier + typecheck
   + vitest). The user also confirmed in a clarifying answer:
   - Scope: **all 29 findings, ~15 phases**
   - Backend gets a parallel Python loop: **ruff + mypy + pytest-cov**
3. The plan was produced in chat as 15 phases. On review of the
   dependencies, **3 conflicts** in the first-draft plan were identified
   and fixed by re-ordering. The final plan is in this conversation
   transcript and is also referenced below in *Artifacts*.

The plan has **not yet been written to disk**. The user said "save in plan
folder in `docs/plan/`" — that write is still pending plan-mode approval.

## The next session's focus (user's argument)

> "start implementing if any auth token etc need from graphite etc ask now"

**The next session must:**

1. **First action — ask the user about every required auth/token/credential
   before doing anything else.** Do not assume any of them. The
   `AUTH BLOCKERS` section below enumerates exactly what to ask.
2. Once auth is settled, save the plan to `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`
   (per the user's path instruction this session).
3. Then archive the old `docs/implementation-plan.md` →
   `docs/implementation-plan-original-2026-05.md` so the active plan is
   unambiguous.
4. Then start **Phase 0: Foundation** (Husky, lint-staged, Prettier,
   typecheck, ruff, mypy, pytest-cov) per the plan, branching off `main`
   with `gt create feat/foundation-0-feedback-loops`.

## Artifacts (read these, do not re-derive)

| Path | What it is |
|---|---|
| `docs/reviews/review.md` | First review (chat-style). 5 blockers, 12 high, 19 medium. |
| `docs/reviews/code-review-by-layer.md` | Second review (layered). 5 cross-cutting blockers, 12 high, 19 medium. |
| `docs/handoff-studio-workflows.md` | The prior session handoff that landed the 12-commit integration. |
| `docs/pr-2026-06-02-studio-workflows.md` | PR description for that integration (still useful as a PR template). |
| `docs/repo-migration-plan.md` | Migration plan to the new remote (already executed). |
| `docs/adr/0030-agents-must-use-graphite-stacked-prs.md` | The branching rule the next session follows. |
| `AGENTS.md` (repo root) | Handoff convention (`docs/handoffs/{date}/{topic}.md`), frontend-sync rule, test-scope rule, branching rule. |
| `frontend/AGENTS.md` | TanStack skill-loading rules. |
| `docs/adr/0001..0029` | All 30 ADRs; many are referenced by the plan. |
| Conversation transcript | The 15-phase plan is in the recent turns above. **Read the turn that begins "Implementation Plan — Combined Review Fix Cycle"** and the follow-up turn with the dependency-graph re-order. |

The plan is in chat only — the next session must either re-read those
turns or wait for the user to approve saving it to disk.

## AUTH BLOCKERS — ask the user before doing anything else

The plan will fail at certain phases without credentials. Ask the user
about **each** of these now, in one message, so the next session can
proceed uninterrupted. None of these are committed to the repo.

| # | Auth / token | Why it's needed | When it matters |
|---|---|---|---|
| 1 | **`gh auth login`** (GitHub CLI) | `gt submit --stack` wraps `gh pr create`. `gt` v1.8.6 needs a working `gh` for the PR open. | Phase 0 onwards (any stacked PR). |
| 2 | **Graphite API token** (if not bundled with `gt` 1.8.6) | `gt` may require a Graphite Cloud account / API key, separate from `gh`. Check `gt auth status` first. | Same as above. |
| 3 | **Git push credentials** for `https://github.com/mayureshh27/Practice-Workspace.git` | Either HTTPS PAT in credential manager, or SSH key registered. The remote was added this session. | Every commit that pushes. |
| 4 | **`LOGFIRE_TOKEN`** (optional) | Logfire works without it for local dev; only needed for cloud upload of spans. | Optional for the implementation. Skip if local-only. |
| 5 | **LLM API key** (`OPENAI_API_KEY` / `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY`) | `practice_agent` defaults to the `"test"` provider if no key is set, which returns stub problems. Phase 3+ exercises may want a real run. | Phase 3 (practice agent payload shapes) and live smoke of Phase 4+ (`/run` endpoint). |
| 6 | **`HF_TOKEN`** (Hugging Face) | `sentence-transformers/all-MiniLM-L6-v2` is a public model — **no token needed**. Only if the user later pins a private model. | Skip unless Phase 2 is changed. |
| 7 | **Qdrant Cloud URL + API key** (optional) | The router falls back to local on-disk Qdrant. Cloud is only needed if the user wants the cloud. | Skip unless the user wants cloud retrieval. |

**The next session's first message should be a single `question` call
listing items 1, 2, 3, and 5** (the ones the user must answer) and
explicitly mark 4, 6, 7 as optional / skip. Do not start Phase 0
without at least items 1, 2, 3 settled.

## Suggested skills (load these in the next session)

Run from `Practice-tool/`:

```bash
pnpm dlx @tanstack/intent@latest list
```

Then load the relevant ones per phase:

- **`handoff`** — to read this doc and continue cleanly.
- **`thermo-nuclear-code-quality-review`** — the gatekeeper skill; re-run
  on each PR diff to enforce the same standards the two reviews applied.
- **`tdd`** — Phase 0 adds the test floors; every later phase must add
  tests for the changes it makes (the second review's §5.4 lists 19
  test-coverage gaps to close).
- **`typescript-advanced-types`** — Phase 11 (EvalGate enum, Difficulty /
  Scope / Target Literal types, ArtifactPayload discriminated union).
- **`tanstack-router-best-practices`**, **`tanstack-query-best-practices`**
  — Phase 9, 10, 11, 12 (frontend refactor).
- **`improve-codebase-architecture`** — Phase 9 (decompose the 983-line
  `SourceNotebookScreen.tsx`) and Phase 11 (store cleanup).
- **`fastapi`** — Phases 3, 4, 5, 6, 7, 8 (all backend).
- **`building-pydantic-ai-agents`** — Phase 3 (PracticePayload
  discriminated union, per-request agent construction in Phase 8).
- **`logfire-instrumentation`** — Phases 3, 4, 8 (gate/agent/event
  observability).
- **`impeccable`** / **`interface-design`** — Optional, only if any UI
  polish is needed during Phase 9's split (likely not — the goal is
  no-behaviour-change decomposition).
- **`diagnose`** — Only if a phase lands and the smoke fails.

## Open questions for the next session (besides auth)

1. **Wire or delete the ingestion modal?** Phase 9 in the plan was
   originally "wire or delete"; the recommendation is wire. The user
   has not confirmed. Ask before starting Phase 9.
2. **Backend `name` field aliasing** — Phase 5 (now consolidated) keeps
   `title` as an alias for one minor version. If the user prefers a
   hard rename (breaking the seed), say so.
3. **Coverage floor for `pytest-cov --cov-fail-under`** — Phase 0
   needs a number. The current coverage is unknown. Suggest 70 to
   start, ratchet to 80 in Phase 15.

## What NOT to redo (carried-forward decisions)

- The 12 commits on `feat/studio-workflows-integration` (now part of
  `main`) — **do not rewrite or revert**. The plan layers on top.
- The README rewrite on `dev` (`10a471a`) — keep as-is.
- The repo migration to `Practice-Workspace` — already executed.
- The `legacy-fork-main` and `revamp-frontend-design` branches on the
  new remote — keep for reference; do not delete.
- The 5 backend blockers (X-1 through X-5) — these are the *minimum*
  to land before the frontend Studio's "Run" button works. Do not
  skip past them.

## Branching reminders (for the next session's first `gt` call)

Per `AGENTS.md` and `docs/adr/0030-agents-must-use-graphite-stacked-prs.md`:

```bash
git checkout main
git pull --rebase
gt create feat/foundation-0-feedback-loops
# ... commit ...
gt create feat/backend-1-ids-and-storage    # stacked on top
# ... commit ...
gt submit --stack                            # opens one PR per branch
gt restack                                   # after main moves
gt absorb                                    # auto-attribute fixups
```

Do not use `git commit` shortcuts that skip hooks once Husky is
installed in Phase 0. Do not force-push. Do not commit secrets.

## Redaction note

No API keys, tokens, or PII are present in this handoff or in the
referenced artifacts. The remote URL is public. The only credentials
that exist live in the user's local environment and must be obtained
from the user, not guessed.
