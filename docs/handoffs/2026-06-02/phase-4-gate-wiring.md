# Handoff — 2026-06-02 — Phase 4 complete, continue with Phase 5

This handoff lives in the repo at
`docs/handoffs/2026-06-02/phase-4-gate-wiring.md` per the
repo-level `AGENTS.md` rule (handoffs under
`docs/handoffs/{date}/{topic}.md`).

## What was done (Phase 4)

Single branch `feat/backend-4-gate-wiring` stacked on
Phase 3 (`feat/backend-3-payload-shapes`). One logical code
commit (`4f2e395`) + this handoff. The commit body lists the
five closed findings (H-B5, H-H1, H-H2, H-M4, H-H5, R-2.5) and
calls out the two out-of-scope items (H-H4, H-H6).

Backend test suite is 105 pass with 62.78% coverage (was 75
pass / 57.25% — 30 new tests, +5.53 percentage points). No new
ruff errors in changed files (one pre-existing `SIM102` in
`artifact_gate.py` fixed; net -1 for the phase). Mypy went
38 → 38 — one new error in `practice_exercises.py`
(`Generator[Session]` used as a context manager) introduced
and fixed in the same commit, so the baseline is unchanged.

## Current state (resume point)

| Item | State |
|---|---|
| Branch | `feat/backend-4-gate-wiring` (committed, pushed) |
| Code commit | `4f2e395` — `feat(backend): gate wiring: artifact + eval + event + is_configured` |
| `gt` stack | `main` (89a352e, PR #3 squash) ← `feat/backend-3-payload-shapes` (PR #4 draft) ← `feat/backend-4-gate-wiring` (PR #5 draft) |
| PRs | #1 merged (Phase 0), #2 merged (Phase 1), #3 merged (Phase 2), #4 draft (Phase 3), #5 draft (Phase 4) |
| `gt auth` | `Authenticated as: mayureshh27` |
| `gh` CLI | **Not installed** — doesn't block; `gt submit` has its own auth |
| Coverage | 62.78% (above 55% floor) |
| Tests | 105 pass (was 75) |
| Lint/type baselines | ruff 39 (was 40 — Phase 4 fixed one pre-existing `SIM102`), mypy 38 (unchanged) |
| Pre-existing mypy debt | `practice_agent.py:75` (Pydantic AI overload), `qdrant_router.py:246` (Qdrant client overload), `kuzu_graph_layer.py` (dict[int] index), `event_store.py` (datetime order_by) — Phase 14 |

## Findings closed (per `docs/reviews/code-review-by-layer.md` and `docs/reviews/review.md`)

| ID | Where | Resolution |
|---|---|---|
| **H-M4** | artifact_gate.py sandbox protocol was abstract | `LocalSandboxRunner` added to `eval_gate.py` per the plan. Async `run(code, language, timeout)` using `asyncio.to_thread(subprocess.run)`. Exit 124 on timeout. Python-only for v1; non-python returns `exit_code=1` (fail closed). 7 new tests in `test_eval_gate.py`. |
| **H-H1** | artifact_gate dedup was keyed only on scope ids | Dedup key is now `(concept_ids, source_ids, prompt_template_sha)`. The factory stamps `prompt_template_sha` on every record; the gate forwards it. The flat `and` chain resolves a pre-existing `SIM102` ruff finding. 4 new dedup tests in `test_artifact_gate.py` cover distinct-workflow-doesn't-collide, legacy-without-SHA back-compat, and the previously-broken case. |
| **H-H2** | qdrant_router lacked `chunk_exists` | `QdrantRetrievalRouter.chunk_exists(chunk_id)` added using `client.retrieve` with `with_payload=False` and `with_vectors=False`. Errors swallowed and treated as not-found so the gate behaves the same on unreachable Qdrant. 4 new tests in `test_qdrant_router.py`. |
| **H-B5** | `validate_artifact` existed but wasn't called | Wired in `practice_exercises.run_practice_exercises` between `generate_practice` and `make_artifact`. Computes `prompt_template_sha` via `hashlib.sha256(workflow.prompt_template)`. Gate failures raise `HTTPException(502, detail=failures_list)`. The existing-artifact list comes from `request.app.state.artifacts`. |
| **H-H5** | `PracticeAttempted` couldn't trace back to a workflow-specific artifact | `practice_exercises.py` emits an `ArtifactGenerated` event after `append_artifact`. Downstream `PracticeAttempted` events join on `artifact_id`, so the mastery rule (`ConceptMasteryUpdated.trigger_event_id`) remains traceable. 4 new tests in `test_event_emitter.py` pin the no-side-effect contract for non-`PracticeAttempted` events. |
| **R-2.5** | workflows.py inspected `cfg.provider` to decide "configured" | Added `is_configured(task_type) -> bool` to the `ModelRouter` Protocol (ADR-0003 boundary), not just `DefaultModelRouter`. `workflows._is_model_configured` now asks the router. 5 new tests in `test_model_router.py`. |

## Plan path correction (call out for the next agent)

The plan file list names
`backend/app/api/practice_agent.py` as the wiring point for
H-B5, but `practice_agent.py` is the gen agent module with a
stable signature. The gate is wired in the API route
(`backend/app/api/practice_exercises.py`) so the gen agent
stays unchanged. H-B5's intent — gate before persistence, with
failures surfaced to the operator — is preserved.

H-H5 emits the existing `ArtifactGenerated` event class from
`app/domain/events.py` rather than a new event type. Its
fields (artifact_id, artifact_type, workflow_id, source_id,
concept_ids) already match the practice-gen output, so
introducing a new event would have added a class with no new
information.

## Out of scope (called out for traceability)

* **H-H4** — `FileToolRegistry` concrete already exists in
  `app/harness/tool_registry.py` (loads JSON from
  `tool_registry/` directory); there is just no consumer wired
  in. Phase 7+ concern, not Phase 4 per the plan file list.
* **H-H6** — `ingestion_gate` has no route consumer. Deferred
  to Phase 8 per the plan file list. The Phase 4 finding tag
  is just a traceability note.

## Design notes worth carrying forward

* **`LocalSandboxRunner` placement**: lives in `eval_gate.py`,
  not `artifact_gate.py` where the `SandboxRunner` Protocol
  lives. `eval_gate.py` is the broader "runtime evaluation"
  concept (it also has `SocraticGate`), so a cross-file import
  is cleaner than splitting the gate into gate + runner.
  Phase 5+ agents should follow the same pattern: protocols
  live with the gate that owns the contract; concrete impls
  live in the broader module.
* **`is_configured` is on the Protocol, not the concrete**:
  the boundary is the `ModelRouter` interface (ADR-0003), so
  any test stub router must implement it. The chat review §2.5
  hint ("can we move this into the router?") drove the
  placement.
* **Best-effort event emit**: `practice_exercises.py` wraps
  the `emit_event` call in `try/except` and logs
  `logfire.warning` on failure. The artifact is already
  persisted at that point, so a failed emit must not fail the
  HTTP request. The event is observability, not source of
  truth.
* **Hash-based dedup is semantic, not syntactic**: two
  different workflows against the same scope ids are not
  flagged because the SHA of the prompt template changes the
  key. Legacy records without `prompt_template_sha` only
  collide when the caller also passes an empty/None SHA — no
  silent all-collide on a missing field. The 4 dedup tests pin
  this contract.
* **`get_session()` is a generator, not a context manager**:
  `app/storage/database.py:get_session` is
  `Generator[Session, None, None]` (FastAPI Depends-style). For
  ad-hoc session in non-route code, use
  `Session(get_engine())` instead. This is now a confirmed
  Phase 4 trap.
* **H-H5 event chain**:
  `ArtifactGenerated` (no side effects) →
  `PracticeAttempted` (existing mastery/blind-spot rules) →
  `ConceptMasteryUpdated(trigger_event_id=PracticeAttempted.id)`.
  The artifact id is the join key.

## Test design notes

* **`test_engine` is session-scoped** — `db_session` fixture's
  `session.rollback()` does NOT undo committed rows from
  `event_store.append_event` (which calls `session.commit()`
  inside the same Session). New `test_event_emitter.py` tests
  filter by `artifact_id`/`concept_id` rather than counting
  rows. This is now a known pattern for event-store tests.
* **Qdrant test fixture uses `:memory:`** — the existing
  in-memory Qdrant pattern in `test_qdrant_router.py` was
  reused for the `chunk_exists` tests. No new fixture needed.
* **Sandbox tests skip the harness** — `LocalSandboxRunner`
  tests use `tmp_path` and shell scripts for the timeout and
  non-language cases; they don't try to start a real sandbox.

## Verification (what was actually run)

```bash
cd backend
uv run pytest --cov=app --cov-fail-under=55 \
  --ignore=tests/test_workspace_api.py
# 105 passed, 6 warnings in 45.62s; coverage 62.78%

uv run ruff check app/ tests/
# 39 pre-existing errors; none in the 8 Phase 4 source files
# or the 4 new test files

uv run mypy app/
# 38 pre-existing errors; no new ones
```

Pre-push hook ran the full backend pytest gate (typecheck,
ruff, and mypy are advisory per Phase 0's hook). Push
succeeded.

## Plan compliance

* Branch name: `feat/backend-4-gate-wiring` (matches plan).
* Stacked on Phase 3, not on main (Graphite track confirmed).
* One logical code commit + this handoff commit.
* Subject ≤72 chars: 68 chars including type and scope.
* Body explains WHY, lists closed findings, calls out
  out-of-scope and plan path corrections.
* No `--no-verify`, no force-push, no secrets in diff.
* PR opened via `gt submit --stack --no-edit` (PR #5 draft).

## Cross-references (per AGENTS.md)

* **Reviews**:
  * `docs/reviews/code-review-by-layer.md` — closed: H-B5,
    H-H1, H-H2, H-M4, H-H5, R-2.5. Out of scope: H-H4
    (already structurally resolved), H-H6 (Phase 8). Still
    open: M-B1 (Phase 7), M-H3 (Phase 8).
  * `docs/reviews/review.md` — closed: R-2.5 (chat §2.5
    "can we move this into the router?"). Still open: R-1.3
    (Phase 12), R-3.1 (Phase 12), R-2.4 (Phase 8).
* **Plan / PRD**:
  * `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`
    — Phase 4 lines 149-155 (5-slice scope).
  * `docs/prd-harness-layer.md` §156-173 — Socratic Gate
    (H-B5's runability counterpart) and Artifact Gate (4
    checks incl. dedup key).
* **ADRs**:
  * ADR-0003 (Pydantic AI first) — `is_configured` lives on
    the `ModelRouter` boundary defined here. **Unaffected.**
  * ADR-0011 (eval gates use pydantic-evals and layer-specific
    checks) — `LocalSandboxRunner` and the dedup key are the
    layer-specific check instances. **Unaffected.**
  * ADR-0013 (Socratic Gate permanent) — `LocalSandboxRunner`
    is the runability counterpart to the Socratic Gate.
    **Unaffected.**
  * ADR-0030 (Graphite stacked PRs) — followed. **Unaffected.**
* **Earlier handoffs in this chain**:
  * `docs/handoffs/2026-06-02/implementation-start.md` —
    session start.
  * `docs/handoffs/2026-06-02/phase-1-ids-and-storage.md` —
    Phase 1.
  * `docs/handoffs/2026-06-02/phase-2-qdrant-resilience.md` —
    Phase 2 (on remote main, post-PR #3 squash).
  * `docs/handoffs/2026-06-02/phase-3-payload-shapes.md` —
    Phase 3 (commit `f19a7c6`).
  * This file — Phase 4 (commit pending for the handoff).

## Open items / next session

* **Stack ordering**: PR #3 is merged on remote main. PR #4
  (Phase 3) and PR #5 (Phase 4) are stacked. When PR #4
  merges, PR #5 will need `gt restack` against the new main.
* **Phase 5 file (per plan)**: `feat/backend-5-...` — TBD
  topic from the plan. Read
  `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`
  Phase 5 section before starting.
* **Daily ritual**: `git checkout feat/backend-4-gate-wiring`,
  `git pull --rebase`, `gt log short`.
* **Pre-flight** before Phase 5 work:
  `cd backend && uv run pytest --cov=app --cov-fail-under=55
  --ignore=tests/test_workspace_api.py` (105 pass expected).
* **Skills for next session** (in order):
  `handoff`, `thermo-nuclear-code-quality-review`, `tdd`,
  `fastapi`, optional `logfire-instrumentation`.
* **Stop before starting Phase 5** per user directive.
