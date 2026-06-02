# Handoff — 2026-06-02 — Phase 5 — Workflow routes + eval_runs audit

This is the per-phase handoff for Phase 5 of the Practice-tool
15-phase review-fix cycle. It lives at
`docs/handoffs/2026-06-02/phase-5-workflow-routes.md` per the
repo-level `AGENTS.md` rule.

## TL;DR

Phase 5 ships three things:

1. **`POST /api/workflows/{id}/customize` (already in main)** — the
   forking endpoint for global → subject/chapter/topic-scoped
   variants (H-B1, H-B2).
2. **`POST /api/workflows/{id}/run` (new)** — real dispatch for the
   Studio's Run button. Reads scope from the workflow itself
   (post-`/customize`) and routes through the shared
   `_run_workflow_for_artifact` helper (H-B3, X-1, X-2).
3. **`eval_runs` audit table (new)** — one row per LLM run,
   started before the call and finished with `succeeded` /
   `gate_rejected` / `error`. Wired into both routes via the shared
   helper so the audit log semantics are pinned by one call site
   (H-B4).

Plus an amendment to the existing 7-line `ADR-0008` stub to
document the operational commitments the code now keeps.

## State at start of this phase

| Item | State |
|---|---|
| Working tree | On `feat/backend-5-workflow-routes`, branched off main (5a57524) |
| Pre-existing partial work in working tree | `eval_runs_repo.py` (185 lines, 10 repo tests), `database.py` + `conftest.py` eval_runs-table import wiring, untracked `docs/reviews/review_clean.md` (leave alone) |
| ADR-0008 | Existed as a 7-line stub in main. The plan's "create ADR-0008" step was moot; user chose **amend** (append) rather than leave or new_interpretation |
| Phases 0–4 | Merged to main (PRs #3, #4, #5, #6) |
| Test baseline | 110 pass, 63.16% coverage |
| Lint/type baselines | ruff 39 pre-existing, mypy 38 pre-existing |

## What landed (commits on `feat/backend-5-workflow-routes`)

### Commit 1 — code

Subject (shortened to ≤72 chars; plan's exact subject was 83):

> feat(backend): POST /workflows/{id}/customize + /run + eval_runs

Body (WHY + closed finding IDs):

> The Studio's Run button must reach the live LLM, persist the
> artifact, and leave a traceable audit row. The dispatch
> endpoint reads scope from the workflow itself (post-/customize)
> so the user doesn't have to re-supply subjectId/chapterId/topicId
> for the customised variant.
>
> Closes H-B1 (global workflow mutation race — forking via
> /customize isolates the editor from the canonical form),
> H-B2 (subject-scoped variants clobbered by global edits — fork
> is appended, never mutates source), H-B3 (Run button must reach
> the live agent — /run calls the shared helper), H-B4 (no audit
> trail of practice-generation runs — eval_runs row per attempt),
> X-1 (workflow run is a thin pass-through that does not persist
> artifact state — /run persists via the shared helper, same path
> as /api/practice-exercises/), X-2 (Run button ignores workflow
> scope — /run reads scope from the workflow template, body is
> for domainId + optional overrides only).

Files touched:

* `backend/app/storage/eval_runs_repo.py` (NEW, 211 lines) — the
  `eval_runs` model + `start_run` / `finish_run` / `get_run` /
  `list_runs` / `gate_failures_for` repo functions.
* `backend/app/storage/database.py` — import `eval_runs_repo` so
  SQLModel.metadata.create_all picks up the table.
* `backend/app/api/practice_exercises.py` — extracted
  `_run_workflow_for_artifact` async helper (the agent + gate +
  persist + eval_runs path). `run_practice_exercises` is now a
  thin handler that calls the helper. `_finish_run` is the
  best-effort finaliser used by the helper on every status branch.
* `backend/app/api/workflows.py` — added
  `POST /api/workflows/{id}/run` route + `RunWorkflowBody`. Refuses
  global templates with a 400 pointing the caller at `/customize`
  (X-2's full intent: scope must come from the workflow).
* `backend/tests/test_eval_runs_repo.py` (NEW, 10 tests) — direct
  repo coverage. Includes an `autouse` fixture that clears the
  `eval_runs` table before each test (the conftest's
  `db_session` fixture only rolls back uncommitted work, but
  `start_run` / `finish_run` commit; the table would otherwise
  accumulate cross-test pollution).
* `backend/tests/conftest.py` — import `eval_runs_repo` so the
  test engine's `create_all` registers the table.
* `backend/tests/test_practice_exercises.py` — 4 new tests pinning
  the eval_runs wiring (success writes a row; 404 and 400 do
  not; status='succeeded' filter works end-to-end).
* `backend/tests/test_workflows_api.py` — 4 new tests pinning
  the /run endpoint (404 on unknown, 400 on global, scope
  precedence from the workflow, /run writes an eval_runs row).
* `docs/adr/0008-artifact-workflows-use-structured-templates-with-editable-prompts.md` —
  amended the 7-line stub with the operational commitments
  (customize fork semantics, /run dispatch contract, eval_runs
  schema, status taxonomy).

### Commit 2 — handoff

Subject:

> docs(handoffs): add phase-5-workflow-routes

This file.

## Test results

```
$ cd backend && uv run pytest --cov=app --cov-fail-under=55 \
    --ignore=tests/test_workspace_api.py
====================== 128 passed, 6 warnings in 37.26s =======================
Required test coverage of 55% reached. Total coverage: 64.44%
```

* **128 passed** (up from 110 baseline: +10 repo, +4 API in
  test_practice_exercises, +4 API in test_workflows_api).
* **64.44%** coverage (up from 63.16%).
* Two coverage improvements directly attributable to Phase 5:
  * `app/api/practice_exercises.py` 84% (helper is well-tested
    through the API tests).
  * `app/api/workflows.py` 94% (the new /run endpoint is
    covered by the 4 new tests + the existing workflow tests).
  * `app/storage/eval_runs_repo.py` 98% (10 direct repo tests).

## Findings closed

| ID | Where | Note |
|---|---|---|
| H-B1 | `workflows_repo.customize_workflow` | fork isolates editor from canonical form |
| H-B2 | same | fork appended, never mutates source |
| H-B3 | `workflows.run_workflow` | /run calls the shared agent + gate + persist helper |
| H-B4 | `practice_exercises._run_workflow_for_artifact` + `eval_runs_repo` | one row per LLM run, written before the call |
| X-1 | `workflows.run_workflow` | /run persists + emits event + writes eval_runs |
| X-2 | `workflows.run_workflow` | scope from workflow, body only for domainId + overrides |

The 7-line ADR-0008 stub is amended (per user's "append to
existing one" choice on the ADR pre-flight question).

## Cross-references

* **Reviews** —
  `docs/reviews/code-review-by-layer.md` for the H-B1..B4, X-1, X-2
  line numbers; `docs/reviews/review.md` for the chat-style
  R-* findings (R-2.5 was already closed in Phase 4).
* **Plan / PRD** —
  `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`
  Phase 5 (lines 157–163); `docs/prd-harness-layer.md` §156–173
  (gates acceptance — the gate-rejected terminal status in
  `eval_runs` is the operator-visible hook the PRD asks for).
* **ADRs** —
  ADR-0008 (amended this phase), ADR-0011 (eval gates use
  pydantic-evals — `eval_runs` is the structured pre-eval trace
  the ADR-0011 layer checks run against), ADR-0017/0018
  (route/handler conventions — followed).
* **Earlier handoffs** —
  `docs/handoffs/2026-06-02/implementation-start.md`,
  `phase-1-ids-and-storage.md`, `phase-2-qdrant-resilience.md`,
  `phase-3-payload-shapes.md`, `phase-4-gate-wiring.md`. The
  Phase 4 handoff noted the `is_configured` model-router
  check; Phase 5's /run endpoint reads `is_configured` indirectly
  through the `_is_model_configured` helper already wired in
  Phase 2.

## Known issues / cleanup items for next phases

* **Phase 6 pre-flight**: `docs/adr/0006*` and `docs/adr/0007*`
  exist. Read before coding; ask before amending.
* **Coverage floor (Phase 15 verify)**: 80% across the board.
  Phase 5 lifts the floor; Phase 6 (context gate) is the next
  big lift.
* **`logfire` warnings on `_finish_run` failure paths**: best-
  effort, never raise. Pre-existing logfire instrumentation in
  the project follows the same pattern; the dev/Logfire token is
  off in tests, so the warnings are silent.

## Sensitive information

None redacted; the eval_runs row contents are workflow + scope
provenance, not PII.
