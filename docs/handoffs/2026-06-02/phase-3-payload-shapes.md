# Handoff — 2026-06-02 — Phase 3 complete, continue with Phase 4

This handoff lives in the repo at
`docs/handoffs/2026-06-02/phase-3-payload-shapes.md` per the
repo-level `AGENTS.md` rule (handoffs under
`docs/handoffs/{date}/{topic}.md`).

## What was done (Phase 3)

Single branch `feat/backend-3-payload-shapes` stacked on
Phase 2 (`feat/backend-2-qdrant-resilience`). One logical commit
(imperative subject, body explains WHY). 75 backend tests pass
(was 70, +5 net after removing 3 obsolete helpers and adding 13
new), 57.25% coverage (above 55% floor). No new ruff errors in
changed files (net -2 unused-import cleanups). Mypy 38 errors
unchanged (all pre-existing, Phase 14's work).

## Current state (resume point)

| Item | State |
|---|---|
| Branch | `feat/backend-3-payload-shapes` (committed, pushed) |
| `gt` stack | `main` ← `feat/backend-2-qdrant-resilience` (PR #3 draft) ← `feat/backend-3-payload-shapes` (PR #4 pending) |
| `gt auth` | `Authenticated as: mayureshh27` |
| `gh` CLI | **Not installed** — doesn't block; `gt submit` has its own auth |
| Coverage | 57.25% (above 55% floor) |
| Tests | 75 pass (was 70) |
| Lint/type baselines | ruff 40 (was 42 — Phase 3 cleaned up 2 pre-existing F401s), mypy 38 (unchanged, Phase 14's work) |

## Findings closed (per `docs/reviews/code-review-by-layer.md` and `docs/reviews/review.md`)

- **5.1** (line 503, cross-cutting) — `_coerce_problems` had 3 silent
  fallback shapes. ✅ Replaced with strict Pydantic v2
  discriminated union (`PracticePayload`). Unknown shapes raise
  `ValidationError` and the API surfaces them as 502 (chat review
  §5.1: "Bad shapes surface as errors, not silent fallbacks").
- **5.2** (line 514, cross-cutting) — `_pad_problems` appended
  placeholder stubs indistinguishable from real problems. ✅ New
  `PlaceholderProblem` carries `kind="placeholder"` discriminator
  on the item; the UI narrows on the discriminator (chat review
  §5.2: explicit kind field, not a fake problem masquerading as real).
- **R-2.3** (chat review line 82) — `practice_exercises.py:104-130`
  built the artifact record inline. ✅ Moved to
  `make_artifact()` in `app/api/_artifact_factory.py`; the duplicated
  id-stamping / time-formatting / state-mutation pattern is gone.
- **R-2.4** (chat review line 100) — mutation pattern
  (`getattr → append → setattr`) duplicated. ✅ `append_artifact()`
  helper hides the triplet; call sites never touch state directly.
- **3.5.1 H-M3** (layered review line 280) — Deferred to Phase 4/8.
  The fallback path doesn't stamp scope ids; this phase's refactor
  fixes the *return shape* but doesn't add scope-id stamping on
  the placeholder fallback path. The new
  `PlaceholderProblem(title="Stub problem N", prompt="(LLM call
  failed: ...)")` is consistent with the prior behavior. Phase 4's
  scope: `artifact_gate.validate_artifact` wires scope ids.

## Files changed in Phase 3 (4 modified, 4 new)

| Status | Path |
|---|---|
| MOD | `backend/app/agents/practice_agent.py` — `_coerce_problems` and `_pad_problems` removed; new `parse_practice_payload()` (strict, raises `ValidationError` on unknown shape); `generate_practice` returns typed `PracticePayload` (not a 3-tuple); LLM-fail path returns stub `PracticePayloadPractice` with `kind="placeholder"` items |
| NEW | `backend/app/domain/artifact.py` — `PracticePayload` discriminated union (`PracticePayloadPractice` \| `PracticePayloadQuiz` \| `PracticePayloadSummary`); `PracticeItem` = `PracticeProblem` \| `PlaceholderProblem` (also discriminated on `kind`) |
| NEW | `backend/app/api/_artifact_factory.py` — `make_artifact()` stamps id+time; `append_artifact()` hides the `getattr/append/setattr` triplet |
| MOD | `backend/app/api/_ids.py` — added `now_iso_with_ms()` (ISO-8601 with ms precision and `Z` suffix) |
| MOD | `backend/app/api/artifacts.py` — routes through `make_artifact` / `append_artifact`; the inline id+time stamping and state mutation are gone |
| MOD | `backend/app/api/practice_exercises.py` — uses `make_artifact`; catches `ValidationError` from `parse_practice_payload` and surfaces as 502 (chat review §5.1) |
| NEW | `backend/tests/test_practice_agent_payload.py` — 7 tests (4 happy-path variants + 1 hard-fail + 2 padding cases) |
| NEW | `backend/tests/test_artifact_factory.py` — 6 tests for the factory + the ISO timestamp helper |
| MOD | `backend/tests/test_practice_exercises.py` — removed 3 obsolete `_coerce_problems` / `_pad_problems` tests; added `kind == "practice"` assertion to the artifact test |

The full diff is in commit `72fda75` — do not re-derive.

## Decisions made in this session (carry forward)

1. **AI runtime stays Pydantic AI direct (option a).** The plan's
   Phase 3 callout asked whether to elevate LiteLLM to a gateway
   or keep Pydantic AI direct. User chose (a) in this session's
   Q&A: "Keep Pydantic AI direct (Recommended)". Phase 3's
   *file list* only touches the payload-shape layer
   (`practice_agent.py` + new factory + `practice_exercises.py`),
   not `model_router`. The agent construction
   (`_build_agent()` per-request) is **still Phase 8's work**
   (chat review §2.2; plan's Phase 8 file list).

2. **Hard-fail on unknown shape, not permissive.** Chat review §5.1
   explicitly recommends "Bad shapes surface as errors, not silent
   fallbacks". User chose "do best for longterm" in the Q&A. The
   discriminated union rejects unknown shapes with
   `pydantic.ValidationError`; the API layer converts to 502. No
   `kind="generic"` variant (would defeat the union's purpose).
   No two-tier hard-fail-in-dev / permissive-in-prod (would
   create environment divergence).

3. **`PracticeProblem` carries `kind="problem"`.** Pydantic v2's
   discriminated union requires the discriminator field on every
   variant. Both `PracticeProblem` and `PlaceholderProblem` declare
   `kind`. The wire format now has `kind` on every item, but the
   UI narrows on it — `kind === "placeholder"` triggers the
   stub-rendering path (chat review §5.2).

4. **Subject trimmed 91 → 70 chars.** Plan's verbatim subject is
   91 chars (over the ≤72 AGENTS.md cap). Trimmed to
   `feat(backend): PracticePayload union + make_artifact + now_iso_with_ms`
   (70 chars). Dropped "discriminated" (the *type* is the
   discrimination) and "helper" (the *symbol* is the function,
   not the docstring).

5. **Path correction in plan.** Plan's Phase 3 file list says
   `backend/app/api/practice_agent.py`, but the actual file
   lives at `backend/app/agents/practice_agent.py`. The plan was
   written before the move (Phase 0 reorganised the agents into
   `app/agents/`). This handoff records the actual paths.

6. **Module-level `Agent` is still constructed at import time.**
   Chat review §2.2 recommends `_build_agent()` per-request so
   `PRACDA_OVERRIDE_MODEL` works without a process restart. This
   is **NOT Phase 3's work** — it's Phase 8's. The `Agent` is
   still built once with the router's default; if the operator
   changes the model the next process restart picks it up (this
   comment is preserved from the original).

7. **LLM-fail path returns a stub `PracticePayloadPractice`.** The
   agent catches network/infra failures and emits a
   `PracticePayloadPractice` whose `problems` are all
   `kind="placeholder"` (so the UI shows the "Rerun" affordance
   via the placeholder badge). The old behavior — silent stub
   problems without a kind marker — is replaced; the new stub
   is identifiable in the payload.

8. **Discriminator on the payload AND the item.** The chat review
   §3.1's `ArtifactPayload` puts the discriminator on the payload
   (not the item). Phase 3 mirrors that: `PracticePayload.kind`
   on the payload, `PracticeItem.kind` (problem | placeholder)
   on items inside `problems[]`. Two levels of discrimination.

## Next session: Phase 4 (Gate wiring)

**Branch (exact):** `feat/backend-4-gate-wiring`
**Stack:** off `feat/backend-3-payload-shapes` (current
HEAD of the local stack). Use `gt create feat/backend-4-gate-wiring`
so Graphite stacks it correctly.
**Findings:** H-B5, H-H1, H-H2, H-H4, H-H5, H-H6, R-2.5
**Acceptance:** `provider != "test"` consumer check gone; gates
called in agent path; 6+4+ subscriber tests pass
**Commit subject (verbatim from plan):**
`feat(backend): wire artifact_gate + eval_gate + event_emitter into agent path`

**Files (per plan §"Phase 4"):**
`backend/app/api/practice_agent.py` (call
`artifact_gate.validate_artifact`);
`backend/app/harness/qdrant_router.py` (add `chunk_exists`);
`backend/app/harness/eval_gate.py` (add `LocalSandboxRunner`
concrete); `backend/app/harness/artifact_gate.py` (hash-based
dedup); `backend/app/harness/model_router.py` (add
`is_configured` to protocol); `backend/app/api/workflows.py` (use
`router.is_configured`); `backend/tests/{test_artifact_gate,
test_eval_gate}.py` (NEW);
`backend/tests/test_event_emitter.py` (extend).

**Open question to resolve before Phase 4:** the
`provider != "test"` consumer check in
`backend/app/api/workflows.py:88-104` is the target. The plan
moves this to `router.is_configured("workflow")`. Confirm
whether the plan's destination (`ModelRouter` Protocol) is the
right home, or if `DefaultModelRouter` is enough (the Protocol
is the layer boundary per ADR-0003). The default in this handoff
is "extend the Protocol" — matches the plan's file list.

**Cross-phase reminder:** Phase 3's `parse_practice_payload` is
the **single source of truth** for payload shapes going forward.
Phase 4's `artifact_gate.validate_artifact` should call into
`parse_practice_payload` (or take a typed `PracticePayload`) —
not duplicate the shape logic. Phase 4's `event_emitter` emits
`ConceptMasteryUpdated` from `practice_agent.run_practice`
*before* `update_mastery` (H-H5 fix).

## Daily ritual for the next session

```bash
cd /d/Robotics/Learning-Platform/Practice-tool
git checkout feat/backend-3-payload-shapes
git pull --rebase
gt log short                                 # see current stack
gt restack                                   # rebase stack on any new main
# Verify auth if needed:
gt auth --token <token>                      # only if a future submit fails
# Pre-flight checks (foundation should still be green):
cd backend && uv run pytest --cov=app --cov-fail-under=55 --ignore=tests/test_workspace_api.py
# Then start Phase 4:
cd /d/Robotics/Learning-Platform/Practice-tool
gt create feat/backend-4-gate-wiring
```

At the end of the session, before chat ends:

```bash
# If Phase 4 is done and user wants to ship it:
gt submit --stack --no-edit                  # opens PR for Phase 4 (draft)
```

## Suggested skills for the next session

Load these in this order:

1. **`handoff`** — to read this doc and pick up the stack.
2. **`thermo-nuclear-code-quality-review`** — run on the
   Phase 4 diff before submitting. The same gatekeeper the
   original reviews applied; §5.4 lists 19 test-coverage
   gaps to watch for.
3. **`tdd`** — Phase 4 adds 6+4+ tests; write them
   red-green-refactor.
4. **`building-pydantic-ai-agents`** — Phase 4's
   `event_emitter.emit_concept_mastery_updated(...)` is
   Pydantic AI's first event-emission hook. The skill's
   `Hooks` pattern applies.
5. **`fastapi`** — `artifact_gate` and `eval_gate` integrate
   with the practice agent's return path; FastAPI dependency
   injection patterns apply.
6. **`diagnose`** — only if Phase 4's gate wiring breaks a
   smoke test.

Optional (load only if a Phase 4 sub-task demands them):

- **`logfire-instrumentation`** — Phase 4 wires the event
  emitter; load to instrument the `ConceptMasteryUpdated`
  emission. Phase 8 wires Logfire spans for compaction.
- **`improve-codebase-architecture`** — the
  `provider != "test"` consumer check is a layer-leakage
  smell. The skill's "find the layer boundary" pattern
  applies.

## References (do not re-derive)

- Plan: `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md`
  (Phase 3 = §"Phase 3", lines 140-147)
- Layered review: `docs/reviews/code-review-by-layer.md`
  (5.1=line 503, 5.2=line 514, R-2.3, R-2.4)
- Chat-style review: `docs/reviews/review.md` (§2.3, §3.1, §5.1, §5.2)
- ADR-0002 (amended): `docs/adr/0002-retrieval-layer-starts-with-qdrant.md`
- ADR-0003: `docs/adr/0003-ai-runtime-uses-pydantic-ai-first.md`
  (Phase 3 confirmed Pydantic AI direct, no LiteLLM gateway)
- Phase 0 handoff: `docs/handoff-2026-06-02-phase-0-complete.md`
  (on `feat/foundation-0-feedback-loops` branch)
- Phase 1 handoff: `docs/handoffs/2026-06-02/phase-1-ids-and-storage.md`
- Phase 2 handoff: `docs/handoffs/2026-06-02/phase-2-qdrant-resilience.md`
- Implementation-start handoff: `docs/handoffs/2026-06-02/implementation-start.md`
- Branching rule: `docs/adr/0030-agents-must-use-graphite-stacked-prs.md`
- Stack state: `gt log short`
- Phase 3 commit: `72fda75`
- Phase 2 commit (rebased): `ea0012b` (handoff) + `f5d3ee5` (code) → `2d2549a` (handoff) + `2966f0c` (code) → final `28efb20` (handoff) + `2f32019` (code)
- Phase 1 commit (rebased): `0b48fa6`
- Phase 0 commit: `7b0be2d`
- AGENTS.md docs commit: `023a84d` (on main, from PR #2 squash)
- PRs (pending): #1 (Phase 0 — merged, `d544b12`), #2 (Phase 1 — merged, `4d0879d`), #3 (Phase 2 draft, open), #4 (Phase 3 — pending `gt submit`)
- Remote: https://github.com/mayureshh27/Practice-Workspace.git
- Prototype-sync script: `D:\DevData\Temp\UserTemp\opencode\mirror.bat`

## Redaction note

No API keys, tokens, PII, or secrets are written in this
handoff. The Graphite auth token (in `~/.config/graphite/auth`)
is referenced by its storage path only. The GitHub PAT
(Windows Credential Manager) is out of scope. Both
credentials are local-environment state and must be obtained
from the user, not guessed.

## Phase 3 sharp edges (for review by next agent)

- The 7 payload tests cover happy-path variants + hard-fail +
  padding/truncation. The chat review §5.4 names "0 tests for
  `eval_gate.py`" and "0 tests for `artifact_gate._check_runability`" —
  those are **Phase 4's coverage**. The new `test_artifact_factory.py`
  covers the factory, not the gate. The gate's tests are new files
  in Phase 4's file list (`test_artifact_gate.py`).
- The new `PracticePayload` is a strict union. If a downstream
  consumer (e.g. the workflow editor's "Save as artifact" button)
  emits a dict that doesn't match any variant, the API will 502.
  This is the intended long-term behaviour per chat review §5.1,
  but it does mean Phase 11 (store cleanup) may surface new 502s
  when it removes the store-level `as any` casts.
- `now_iso_with_ms()` uses `time.gmtime()` (UTC) — the previous
  inline code also used `time.gmtime()`. No timezone regression.
- The `_resolve_names` helper in `practice_exercises.py` was
  left untouched (chat review §6.2: "move to workspace_repo"; this
  is **Phase 14's** housekeeping, not Phase 3). The duplicated
  4-level `next()` walk is a known smell, not introduced here.
