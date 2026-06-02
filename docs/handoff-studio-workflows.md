# Handoff: Studio workflows integration + bug-hunt round 1

> Path: `docs/handoff-studio-workflows.md` — kept in repo for easy access,
> not in OS temp. See `AGENTS.md` for the rule.

## What this session did

Completed all 8 planned phases of the Studio workflows integration on branch
`feat/studio-workflows-integration` in `D:\Robotics\Learning-Platform\Practice-tool`,
pushed to `origin`, then ran a bug-hunt round that found and fixed three real
bugs.

Branch state at handoff: 9 commits ahead of `main`, all pushed.
`git log --oneline main..feat/studio-workflows-integration` →
`89f32d2` → `136e565` → `3638480` → `d0505f6` → `fe3fb71` → `de23f8e`
→ `a812075` → `b7761a2` → `f1cb154` (round-1 bugfixes).

## State of the world

- 28/28 new tests pass (`tests/test_workflows_api.py`,
  `tests/test_artifacts_api.py`, `tests/test_practice_exercises.py`).
- Two pre-existing tests fail on `main` (unrelated to this work; expanded
  `seed.py` in Phase 0.2 changed the chapter count). Deselect them with
  `--deselect tests/test_workspace_api.py` if running the full suite.
- `cd backend && uv run fastapi dev` + `cd frontend && pnpm dev` work
  end-to-end. Smoke-tested POST /api/workflows, GET /api/artifacts,
  POST /api/practice-exercises; all 200/201.
- `pnpm build` is green; chunk size warning is pre-existing and not
  from this work.

## Bug-hunt round 1 — fixed and pushed

See commit `f1cb154`:

1. **Artifact id collision in tight loops.** All 5 calls landing in the
   same millisecond produced identical ids. Confirmed with a `time.time()*1000`
   loop. Fix: append `uuid.uuid4().hex[:8]` in both
   `backend/app/api/artifacts.py:create_artifact` and
   `backend/app/api/practice_exercises.py:run_practice_exercises`.
2. **Retry button no-op.** `isGenerating` was cleared in the
   `runStudioWorkflow` `finally` block, so the Retry handler's
   `studioWorkflows.find(w => w.id === isGenerating)` always missed.
   Fix: add `lastFailedId` state, set in catch, reset on success.
3. **Fork navigation bounced to the list.** After
   `customizeWorkflow` the editor called
   `onNavigate({level: 'workflows'})` instead of opening the new fork.
   Fix: `navigate({ to: '/workflow-editor', search: { id: fork.id } })`.

## Remaining bugs / trade-offs I deferred

- **+ New Topic hardcodes the first chapter's first topic slot**
  (`SourceNotebookScreen` `handleNewTopic`). Acceptable for prototype
  scope, but the right fix is a dedicated "New Topic" modal that lets
  the user pick a chapter.
- **Workflow manager surface not extended** (Phase 6 said it would be).
  The `PATCH /api/workflows/{id}` body accepts `scopeFilters: string[]`
  but no UI surfaces them. Acceptable — scope filters are a backend
  capability, not a UI gap. Worth a follow-up.
- **Practice `+ New Topic` keyboard a11y.** Clickable card is not a
  `<button>`, so Enter/Space don't trigger it. Low priority.
- **Concurrent workflow runs from same user not serialised.** The
  Studio allows clicking two different workflows in quick succession
  with no in-flight indicator other than the per-row spinner. Could
  add a global "running" badge. Low priority.

## Suggested skills for the next session

In rough priority order:

- **`diagnose`** — if a new bug surfaces. The reproduce→minimise→hypothesise→
  instrument loop worked well in round 1; apply again.
- **`impeccable`** — for the next frontend pass. The Studio panel was
  rewritten functionally; an UX polish sweep (hierarchy, motion,
  empty states) would tighten it.
- **`tdd`** — if extending the test suite. The 28 new tests were
  written test-first, but practice agent output parsing could use
  more fixture variety.
- **`zoom-out`** — before adding more features. The Studio + Editor +
  Practice flow now has 3 surfaces, 4 backend routers, 1 agent. A
  "what's the shape of this" check would help decide where to put
  the next feature.
- **`thermo-nuclear-code-quality-review`** — before merging to main.
  Will catch any abstraction-quality issues in
  `WorkflowEditorScreen.tsx` (533 lines, the biggest file in the
  diff) and `SourceNotebookScreen.tsx` (similarly dense).
- **`find-skills`** — if the next task drifts into territory this
  agent's tools don't cover (e.g. observability → `logfire-*`).
- **`grill-with-docs`** — if there are scope questions about
  workflow hierarchy or practice generation that the project's
  CONTEXT.md / ADRs should answer. There is no `CONTEXT.md` yet;
  this skill would help create one.

## Files / commits to read

- Diff vs main: `git diff main..feat/studio-workflows-integration --stat`
- Phase-by-phase commits: see the chain above; each commit message
  describes one phase.
- The two largest new files:
  - `frontend/src/components/SourceNotebookScreen.tsx` (Studio + history)
  - `frontend/src/components/WorkflowEditorScreen.tsx` (editor + fork)
- New backend code:
  - `backend/app/api/workflows.py` — CRUD + `customize` + `modelConfigured`
  - `backend/app/api/practice_exercises.py` — LLM call + artifact emit
  - `backend/app/api/artifacts.py` — extended DTO + POST
  - `backend/app/agents/practice_agent.py` — Pydantic AI agent + helpers
  - `backend/app/storage/workflows_repo.py` — in-memory repo + scope filter
- New tests: `tests/test_{workflows_api,artifacts_api,practice_exercises}.py`

## How to pick this up

1. `cd D:\Robotics\Learning-Platform\Practice-tool`
2. `git checkout feat/studio-workflows-integration`
3. `cd backend && uv run python -m pytest tests/ --ignore=tests/test_workspace_api.py -q`
   (28 pass)
4. `cd ../frontend && pnpm install && pnpm build`
5. `cd ../backend && uv run fastapi dev` in one shell,
   `cd frontend && pnpm dev` in another.
6. Open `http://localhost:5173`, navigate to a subject, click
   ⚡ in the right panel to run a workflow. Or click a workflow's
   gear icon → `Customise for this subject` to see the fork flow.

## Open question for the user (not blocking)

The `+ New Topic` UX hardcodes the first chapter. The right next
move is a small topic-creation modal that lets the user pick a
chapter (and possibly position the new topic within it). Want
this in the next round, or is the prototype scope acceptable?
