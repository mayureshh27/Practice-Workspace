# Handoff — 2026-06-02 — Pre-Phase-5 resume; Phase 5–8 in scope

This handoff lives in the repo at
`docs/handoffs/2026-06-02/phase-5-to-8-prep.md` per the
repo-level `AGENTS.md` rule (handoffs under
`docs/handoffs/{date}/{topic}.md`). The `handoff` skill default
(OS temp) is overridden for this project.

This is a **meta-handoff** — it does not correspond to a single
phase's code. It captures the state left after the Phase 4
restack, the open cleanup items, and the concrete checklist for
Phases 5–8 so a fresh agent can pick up the cycle in one
session per the user's "do phases 5–8 in 1 shot" directive.

## TL;DR for the next agent

Phases 0–3 are in `main` (commit `0dff4c4`). Phase 4 is
**merged into `graphite-base/5` (commit `32b7464`), NOT into
`main`** — this is a Graphite stacked-PR quirk (see "Graphite
stacked-PR merge flow" below). Before you start Phase 5, the
user must fast-forward `main` to `32b7464` (one command:
`git push origin 32b7464:main` after a local
`git checkout main && git merge --ff-only origin/graphite-base/5`).
The doc is also still in **PR #6** (`docs/handoff-phase-5-to-8-prep`,
draft) which the user should merge too — but it is not
blocking Phase 5 code work.

The user's directive is to do **Phases 5, 6, 7, 8 in a single
session**, executed as 4 stacked PRs in the standard Graphite
workflow (`gt create` per phase, one commit per phase,
`gt submit --stack` at the end of each phase). The "stop
before next phase" rule does **not** apply between 5→6→7→8 —
only stop at the end of Phase 8 with all 4 PRs ready for
review.

## Resume point

| Item | State |
|---|---|
| Current branch | `docs/handoff-phase-5-to-8-prep` (this handoff's branch, off main) |
| Local `main` | `0dff4c4` (Phases 0–3) |
| Remote `main` | `0dff4c4` (Phases 0–3 — NOT updated for Phase 4) |
| `origin/graphite-base/5` | `32b7464` (Phase 4 squash) — this is where Phase 4 lives |
| `feat/backend-4-gate-wiring` | merged into `graphite-base/5`, branch likely deleted from remote |
| PR #5 | Merged (squash `32b7464` into `graphite-base/5`) — not into main |
| PR #6 (this handoff) | Open, Ready for review — body correct, title stale ("feat(backend): gate wiring…") |
| Working tree | Clean (one untracked `docs/reviews/review_clean.md` from an unrelated review — do **not** commit it) |
| Test count | 110 pass, coverage 63.16% (above 55% floor) |
| Lint/type baselines | ruff 39 pre-existing (none in changed files), mypy 38 pre-existing |
| Pre-existing mypy debt (Phase 14's work) | `practice_agent.py:75`, `qdrant_router.py:246`, `kuzu_graph_layer.py`, `event_store.py` (datetime order_by) |
| Auth | `gt` authenticated as `mayureshh27`. `gh` CLI not installed — `gt submit` is the only PR-creation path. |
| Remote | `https://github.com/mayureshh27/Practice-Workspace.git` |

## What just happened (Phase 4 wrap-up + restack)

Phase 4 (`feat/backend-4-gate-wiring`) was committed (`2cd77df`
+ handoff `dd1a1a3` post-restack) and submitted as **PR #5**
(draft). The user merged Phase 3 (PR #4) and Phase 2 (PR #3)
was already on remote, which left PR #5 stacked on a
now-merged branch.

The restack flow that worked:

1. `git stash -u` to clear the untracked `review_clean.md`
2. `git checkout main && git merge --ff-only origin/main`
3. `git checkout feat/backend-4-gate-wiring`
4. `gt restack` — auto-detected Phase 3 was merged, skipped it
5. Resolved a 1-file conflict in
   `backend/tests/test_qdrant_router.py` (Phase 2 created it;
   Phase 4 added to it — merged both into 9 tests, 5+4)
6. `git rebase --onto main 6e0dd69 HEAD` to strip the Phase 3
   commits that are now squashed into main
7. `gt track --parent main feat/backend-4-gate-wiring` to
   retarget the branch
8. `git push --force-with-lease` (the Graphite-sanctioned
   restack force-push)
9. `gt submit --stack --no-edit`

The 7-commit "diff" in the PR view came from a stale
`graphite-base/5` branch pointing at the old Phase 3 handoff.
**Deleting that branch to force-refresh it auto-closed PR #5**
— do not repeat that mistake. To force-refresh a Graphite
base branch, do:

```bash
git push origin <main-sha>:refs/heads/graphite-base/<N> --force
```

## Graphite stacked-PR merge flow (CRITICAL — read this)

In the Graphite stacked-PR workflow, when you merge a stacked
PR it does **not** go into `main` directly. It is squashed
into a per-PR synthetic base branch (`graphite-base/<N>`).
`main` is the trunk; `graphite-base/<N>` is the "what this
PR actually contains once all its upstack ancestors are
merged in" branch.

For the 15-phase cycle, the user pattern seems to be:
- PRs are stacked and merged one at a time into the running
  `graphite-base/N` branch
- Between phases, the user manually fast-forwards `main` to
  `graphite-base/N` so the next phase can stack on `main`

The current state: PR #5 (Phase 4) was merged into
`graphite-base/5` (commit `32b7464`), but `main` is still at
`0dff4c4` (Phase 3). **Before starting Phase 5, the user
needs to fast-forward `main` to `32b7464`.** Without this,
Phase 5 would not include Phase 4's code in its base.

Reference: https://graphite.com/docs/stacking — "Once a PR is
merged, Graphite updates the parent PR's branch, which you can
then merge into your main branch."

## Open cleanup items (user must do before Phase 5)

1. **Fast-forward `main` to include Phase 4.** PR #5 was
   merged into `graphite-base/5` (commit `32b7464`), not into
   `main`. The user needs to:

   ```bash
   git checkout main
   git merge --ff-only origin/graphite-base/5
   git push origin main
   # or if conflicts in local-only branches: re-clone, or
   # git push origin 32b7464:main
   ```

   After this, `main` is at `32b7464` and Phase 5 can branch
   from main with Phase 4's code already in the base.

2. **(Optional) Merge PR #6** — this handoff doc. PR #6 is at
   https://github.com/mayureshh27/Practice-Workspace/pull/6.
   Once main has Phase 4 merged in, fast-forward `main` to
   include the handoff too, or merge PR #6 in the GitHub UI.
   Body is correct; title is stale ("feat(backend): gate
   wiring…") — user may want to rename.

3. The untracked `docs/reviews/review_clean.md` is a
   historical Studio-workflows review from another branch —
   leave it alone. Do not `git add` it.

## What is already in `main` (Phases 0–3) vs. `graphite-base/5` (Phase 4)

After the user fast-forwards `main` to `32b7464` per the
cleanup item above, `main` will contain all of Phases 0–4.
Until then, **only Phases 0–3 are in `main`**; Phase 4 is on
`graphite-base/5`. The next agent should assume main will
catch up before Phase 5 starts, but verify before branching.

Full commit + handoff detail is in the per-phase handoff files
(do not re-read; just know they exist):

Full commit + handoff detail is in the per-phase handoff files
(do not re-read; just know they exist):

- `docs/handoffs/2026-06-02/implementation-start.md`
- `docs/handoffs/2026-06-02/phase-1-ids-and-storage.md`
- `docs/handoffs/2026-06-02/phase-2-qdrant-resilience.md`
- `docs/handoffs/2026-06-02/phase-3-payload-shapes.md`
- `docs/handoffs/2026-06-02/phase-4-gate-wiring.md`

### Findings closed to date

| Phase | Closed | Deferred | Out of scope |
|---|---|---|---|
| 0 | (none — feedback loop setup) | — | — |
| 1 | M-B2, R-2.1 | — | — |
| 2 | M-B3, M-H1, M-H2 | M-B1 (Phase 7) | — |
| 3 | 5.1, 5.2, R-2.3 (parts), R-2.4 (parts) | M-H3 (Phase 8) | — |
| 4 | H-B5, H-H1, H-H2, H-M4, H-H5, R-2.5 | H-H6 (Phase 8) | H-H4 (Phase 13 wires consumer) |

### ADRs touched to date

- **ADR-0002** amended (Phase 2 operational section)
- **ADR-0003, ADR-0011, ADR-0013, ADR-0030** confirmed
  **unaffected** by Phase 4
- See the per-phase handoffs for full cross-reference tables

## Phase 5–8 scope (per the plan, with concrete checklists)

Plan file:
`docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`
(lines 157–188). Source of truth for findings → file lists →
acceptance criteria. **Do not duplicate the file lists here —
read the plan before starting each phase.**

### Phase 5 — `feat/backend-5-workflow-routes`
- **Findings:** H-B1, H-B2, H-B3, H-B4, X-1, X-2
- **Plan file list:** `backend/app/api/workflows.py` (NEW
  `POST /api/workflows/{id}/customize` + real
  `POST /api/workflows/{id}/run`);
  `backend/app/storage/workflows_repo.py` (add
  `customize_workflow`);
  `backend/app/storage/eval_runs_repo.py` (NEW);
  `backend/app/api/practice_exercises.py` (log to `eval_runs`);
  `docs/adr/0008-...md`
- **ADR-0008 check first:** `ls docs/adr/0008*` — if it
  already exists, ask the user whether to amend, leave, or
  follow the new interpretation (per AGENTS.md "before
  assuming a plan's create ADR-X call is correct").
- **Acceptance:** Live smoke of both endpoints; `eval_runs`
  rows written; 8 new tests pass.
- **Commit:**
  `feat(backend): POST /api/workflows/{id}/customize + real /run dispatch + eval_runs`

### Phase 6 — `feat/backend-6-context-wiring`
- **Findings:** C-B1, C-B2, C-B3, C-H1, C-H2, C-H3, C-H4, C-H5
- **Plan file list:** `backend/app/harness/context_gate.py`
  (tiktoken, per-call `deep_source`, sentence-boundary cut,
  log on `graph_seed` failure, tool descriptions,
  `system_slot_override`);
  `backend/app/harness/tool_registry.py` (add
  `list_tools_with_descriptions`);
  `backend/app/api/practice_agent.py` (call
  `build_seed_context`); `backend/tests/test_context_gate.py`
  (NEW — 8 tests); `docs/adr/{0006,0007}-...md`
- **ADR check first:** `ls docs/adr/0006* docs/adr/0007*`
- **Acceptance:** 9 slots populated; budget enforced via
  tiktoken; 8 new tests pass.
- **Commit:**
  `feat(backend): context gate — wire 9 slots + tiktoken + per-call deep_source`

### Phase 7 — `feat/backend-7-graph-hardening`
- **Findings:** G-B1, G-B2, G-B3, G-B4, G-B5, G-H1, G-H2,
  G-H3, G-H4, M-H6
- **Plan file list:** `backend/app/harness/kuzu_graph_layer.py`
  (schema versioning, `created_at` column, in-process fuzzy
  index, batched Cypher, alias concurrency fix, FK
  validation, 2-query context, `detect_prerequisite_gaps`
  traversal); `backend/app/harness/graph_layer.py`
  (`@runtime_checkable`); `backend/app/harness/context_gate.py`
  (cache `memories_dir` with mtime invalidation);
  `backend/tests/test_kuzu_graph_layer.py` (NEW — 12 tests);
  `backend/tests/test_context_gate_cache.py` (NEW);
  `docs/adr/0027-...md`
- **ADR-0027 check first.**
- **M-B1 status:** this phase finally owns
  `kuzu_graph_layer.py:23-45` (env-var gate + `logfire.error`
  on fallback). The Phase 0 review flagged it; Phase 7 is the
  fix. Do not "fix" it in an earlier phase.
- **Acceptance:** 12 new tests pass; `process.extractOne`
  behind an in-process index.
- **Commit:**
  `feat(backend): graph layer — batched cypher + in-process fuzzy index + alias concurrency fix`

### Phase 8 — `feat/backend-8-orchestration`
- **Findings:** H-H6, H-H7, H-M1, H-M2, R-2.2, R-2.5
- **Plan file list:** `backend/app/api/sources.py` (NEW
  router — `POST /api/sources/ingest`);
  `backend/app/harness/ingestion_gate.py` (wire to new route,
  emit `SourceIngested`); `backend/app/main.py` (lifespan task
  for `compaction_config.compact_history` every 60s);
  `backend/app/harness/compaction_config.py` (implement
  `compact_history`); `backend/app/harness/model_router.py`
  (`ModelRouteRequest` adds `template_id`, `workflow_id`,
  `scope`; `route` returns latency/cost);
  `backend/app/harness/named_configs.py` (add 4 missing agent
  role configs); `backend/app/api/practice_agent.py`
  (per-request `_build_agent`);
  `backend/tests/{test_sources_api,test_model_router,test_named_configs,test_compaction}.py`
  (NEW/extend)
- **Acceptance:** Live `POST /api/sources/ingest` returns 202;
  lifespan task logs once; 4 new test files pass.
- **Commit:**
  `feat(backend): ingestion route + compaction + per-request agent resolution`
- **Note:** H-H6 is finally resolved here (Phase 4 just tagged
  it for traceability; the actual wiring lands in Phase 8).

## Repo / workflow conventions (recap)

- Branch names: exact match to plan (`feat/backend-N-<topic>`).
- Stacked on previous phase, never on `main` (Phase 0 is the
  exception).
- One logical commit per phase. Body explains WHY and lists
  closed findings. Subject ≤72 chars.
- End each phase with: per-phase handoff file in
  `docs/handoffs/2026-06-02/phase-N-<topic>.md` + commit +
  push + `gt submit --stack --no-edit`. The handoff
  cross-references reviews, PRD sections, ADRs, and earlier
  handoffs.
- `make` not installed — use `uv run` + `pnpm` directly.
- Pre-push hook runs pytest strictly; ruff/mypy/typecheck are
  advisory per Phase 0 setup. Do not bypass.
- Coverage floor: 55% (gate). Aim higher.
- Don't introduce new errors in each phase; pre-existing
  ruff/mypy errors in files you touch → fix in that phase
  (housekeeping stays in Phase 14).
- **Per user 2026-06-02:** "do phases 5–8 in one shot" — 4
  stacked PRs in one session, not 4 separate sessions. The
  "stop before next phase" directive does not apply for the
  5→6→7→8 sequence — stop at the end of Phase 8 with the 4
  PRs ready for review.

## Existing artifacts to lean on (do not re-read cover-to-cover)

- **Plan:** `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`
  (especially §3 Phases 5–8)
- **Layered review:** `docs/reviews/code-review-by-layer.md`
  (line numbers for each finding ID)
- **Chat-style review:** `docs/reviews/review.md` (R-* findings;
  some already closed, see Phase handoffs)
- **PRDs:** `docs/prd-harness-layer.md` §156–173 (gates —
  relevant for Phase 5/6 acceptance)
- **ADRs:** `docs/adr/0001..0030` (skim the table of contents;
  full text only for ADRs being amended or confirmed-unaffected)
- **Prior handoffs:** see paths under "What is already in
  `main`" above
- **CI gates:** `.husky/pre-commit`, `.husky/pre-push` (read
  the bash if you need to know which commands run when)

## Skill pre-flight (every backend phase)

Run at the start of each phase (Bash tool):

```bash
pnpm dlx @tanstack/intent@latest list
```

The list of relevant skills (per plan §Pre-Phase 0):

- `thermo-nuclear-code-quality-review` (every PR — load before
  opening the PR)
- `tdd` (every PR — the layered review's §5.4 lists 19
  test-coverage gaps)
- `fastapi` (Phases 5–8)
- `building-pydantic-ai-agents` (Phases 5, 8 — Phase 8
  introduces per-request `_build_agent`)
- `logfire-instrumentation` (Phases 5, 8)

## Suggested skills for this session (load in this order)

1. `handoff` — already loaded; this doc is its output
2. `thermo-nuclear-code-quality-review` — load before starting
   Phase 5 to set the bar
3. `tdd` — load before any test-writing in any phase
4. `fastapi` — load for all 4 phases; the new routes in 5 and
   8 are FastAPI design decisions
5. `building-pydantic-ai-agents` — load for Phase 8
   (`_build_agent` per-request)
6. `logfire-instrumentation` — load for Phase 8 (ingestion
   emits `SourceIngested` event; lifespan task logs)

Optional, only if you hit a wall:
- `grill-with-docs` — if a phase's plan calls for a new ADR or
  an ADR amendment and the wording is ambiguous
- `improve-codebase-architecture` — Phase 7's graph layer has
  the most architectural leverage; consider loading it before
  Phase 7

## Pre-flight checklist before starting Phase 5

```bash
# 1. Verify main is at Phase 4 (NOT Phase 3)
git fetch origin main graphite-base/5
git rev-parse origin/main origin/graphite-base/5
# If main != 32b7464, the user hasn't done the cleanup yet.
# STOP and ask. Phase 5 must stack on Phase 4.

# 2. If main is stale, fast-forward locally (the user may have
# already done this on remote; if not, they need to):
git checkout main
git merge --ff-only origin/graphite-base/5
git push origin main

# 3. Tests green on the new main
cd backend
uv run pytest --cov=app --cov-fail-under=55 --ignore=tests/test_workspace_api.py
# Expect: 110 passed, ~63% coverage

# 4. Branch from main
gt create feat/backend-5-workflow-routes

# 5. ADR-0008 check
ls docs/adr/0008*
# If exists: stop and ask the user (amend / leave / new interpretation)
```

## Starting prompt (copy-paste into the new chat)

```
You are resuming the Practice-tool 15-phase review-fix cycle.
Read the handoff at
docs/handoffs/2026-06-02/phase-5-to-8-prep.md
in this repo (D:\Robotics\Learning-Platform\Practice-tool)
in full before doing anything.

Phases 0–3 are in main (commit 0dff4c4). Phase 4 is merged
into graphite-base/5 (commit 32b7464) but NOT into main. THIS
IS A GRAPHITE STACKED-PR QUIRK — read the "Graphite stacked-PR
merge flow" section of the handoff before doing anything.

Your first action must be to ask me whether main has been
fast-forwarded to include Phase 4. If not, prompt me to run:
  git checkout main
  git merge --ff-only origin/graphite-base/5
  git push origin main
Do NOT branch Phase 5 from a stale main that lacks Phase 4.

After main is current, your scope is Phases 5, 6, 7, 8 in this
single session, executed as 4 stacked PRs (gt create per phase,
one commit per phase, gt submit --stack at the end of each
phase). Do NOT stop between phases; only stop at the end of
Phase 8 with all 4 PRs ready for review.

For each phase:
1. Read the plan section in
   docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md
   for that phase (file list, acceptance criteria, commit
   subject).
2. Check for ADR conflicts: `ls docs/adr/00XX*` for any ADR
   the plan says to create or amend. If it exists, ask me
   before proceeding.
3. Load the per-phase skill: thermo-nuclear-code-quality-review
   + tdd (always) + fastapi (all 4) +
   building-pydantic-ai-agents (Phase 8) +
   logfire-instrumentation (Phase 8).
4. Branch from the previous phase's branch (or main for
   Phase 5): `gt create feat/backend-N-<topic>`
5. Implement, write tests, run:
   `cd backend && uv run pytest --cov=app --cov-fail-under=55
   --ignore=tests/test_workspace_api.py`
   Coverage floor is 55%; aim higher.
6. Don't introduce new ruff/mypy errors. Pre-existing errors
   in files you touch → fix in this phase.
7. Commit with the plan's exact subject (≤72 chars), body
   explains WHY and lists closed finding IDs.
8. Write per-phase handoff at
   `docs/handoffs/2026-06-02/phase-N-<topic>.md`,
   cross-referencing reviews, PRD sections, ADRs, and
   earlier handoffs. Commit as a separate commit on the
   same branch.
9. `git push` + `gt submit --stack --no-edit` to open the PR.
10. If the phase's PR is stacked on a now-merged parent (the
    user may merge between phases), `gt restack` and rebase
    onto the new main using
    `git rebase --onto main <old-base> HEAD`,
    then push --force-with-lease. DO NOT delete
    graphite-base/N branches — that closes the PR. Also do
    NOT fast-forward main yourself if graphite-base/N is
    ahead — ask the user to do the fast-forward (they may
    have a specific approval flow).

When all 4 phases are done, give me a one-screen summary:
PR numbers, commit SHAs, test counts, and the cleanup items
I need to do (e.g. merge PRs in order, fast-forward main
between merges, rebase PRs after merges).
```

## Cross-references (per AGENTS.md)

- **Reviews** —
  `docs/reviews/code-review-by-layer.md` (Phases 5–8 finding
  lines: H-B1..B4, X-1, X-2, C-B1..B3, C-H1..H5, G-B1..B5,
  G-H1..H4, M-H6, H-H6, H-H7, H-M1, H-M2, R-2.2) and
  `docs/reviews/review.md` (chat-style R-* and §2.5 R-2.5
  already closed in Phase 4)
- **Plan / PRD** —
  `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`
  Phases 5–8 lines 157–188; `docs/prd-harness-layer.md`
  §156–173 (gates acceptance for Phases 5/6)
- **ADRs** —
  *ADR-0002* (amended Phase 2 — Qdrant operational commitments
  still relevant), *ADR-0003* (Pydantic AI first; Phase 8
  introduces per-request `_build_agent`; **unaffected**),
  *ADR-0006, 0007* (may need to amend in Phase 6 — check
  before coding), *ADR-0008* (may need to amend in Phase 5 —
  check before coding), *ADR-0011, 0013* (eval/Socratic gates;
  Phase 5 wires `/run` dispatch — **unaffected**),
  *ADR-0017/0018* (route/handler conventions; Phases 5 and 8
  add routes — skim), *ADR-0027* (may need to amend in Phase
  7 — check before coding), *ADR-0030* (Graphite stacked PRs;
  followed — **unaffected**)
- **Earlier handoffs in this chain** — see "What is already
  in `main`" above; each phase's handoff cross-references the
  prior ones, so the chain is navigable without `git log`
  archaeology

## Sensitive information

Redacted from this doc (and the cat output during the session):
- Graphite auth token at `~/.config/graphite/auth` (treat as
  secret; not committed; `gt auth --token <token>` is how to
  re-add it after a fresh clone).

Kept (not PII, useful for the next session):
- GitHub username `mayureshh27` (the only repo owner; needed
  for `gt auth` and PR URLs)
- Windows username `PREDATOR` (only in local paths; no
  PII implication)
