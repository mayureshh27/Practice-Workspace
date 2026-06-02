# Handoff — 2026-06-02 — Phase 2 complete, continue with Phase 3

This handoff lives in the repo at
`docs/handoffs/2026-06-02/phase-2-qdrant-resilience.md` per the
repo-level `AGENTS.md` rule (hendoffs under
`docs/handoffs/{date}/{topic}.md`).

## What was done (Phase 2)

Single branch `feat/backend-2-qdrant-resilience` stacked on
Phase 1 (`feat/backend-1-ids-and-storage`). One logical commit
(imperative subject, body explains WHY). PR #3 will be opened
in **draft mode** alongside PR #1 (Phase 0) and PR #2 (Phase 1)
by `gt submit --stack`. 70 backend tests pass (was 65, +5 new),
no new ruff/mypy errors in changed files.

## Current state (resume point)

| Item | State |
|---|---|
| Branch | `feat/backend-2-qdrant-resilience` (committed, pushed, PR #3 draft pending) |
| `gt` stack | `main` ← `feat/foundation-0-feedback-loops` (PR #1) ← `feat/backend-1-ids-and-storage` (PR #2) ← `feat/backend-2-qdrant-resilience` (PR #3, pending) |
| `gt auth` | `Authenticated as: mayureshh27` ✅ (re-saved token earlier this session) |
| `gh` CLI | **Not installed** — doesn't block; `gt submit` has its own auth |
| Coverage | 57.26% (above 55% floor) |
| Tests | 70 pass (was 65) |
| Lint/type baselines | ruff 42 (all pre-existing, in files not touched by Phase 2), mypy 38 (unchanged, Phase 14's work) |
| PRs | All in **draft** (non-interactive shell skips the PR-body prompts). User marks ready from Graphite UI. |

## Findings closed (per `docs/reviews/code-review-by-layer.md`)

- **M-B3** (line 61) — Qdrant docker detection is a single-port TCP probe.
  Fix: replace `_is_docker_running` socket check with HTTP `/healthz`
  probe. New helper `_qdrant_healthz_probe(host, port)`. ✅
- **M-H1** (line 73) — Embedding model loads from a hard-coded HF id
  with no version pin. Fix: `Settings.qdrant_embedding_model` (default
  `all-MiniLM-L6-v2`) + optional `qdrant_embedding_revision` commit
  hash. ✅
- **M-H2** (line 82) — Pseudo-embedding fallback writes garbage
  vectors. Fix: `_get_embedding` raises `RuntimeError` instead of
  returning 384 md5-derived floats. Error propagates out of
  `index_chunks`. ✅
- **M-B1** (line 39) — Two temporal mastery stores, one ADR. **Deferred
  to Phase 7** (graph hardening) per the plan's dependency graph.
  M-B1 is in `kuzu_graph_layer.py`, not in Phase 2's file list
  (`qdrant_router.py` + `config.py` + `test_qdrant_router.py` + ADR).
  Plan's findings list was stale on this one point. User confirmed
  the deferral in this session's Q&A.

## Files changed in Phase 2 (2 modified, 1 new, 1 amended)

| Status | Path |
|---|---|
| MOD | `backend/app/config.py` — added `qdrant_embedding_model: str = "all-MiniLM-L6-v2"` and `qdrant_embedding_revision: str \| None = None` |
| MOD | `backend/app/harness/qdrant_router.py` — `_qdrant_healthz_probe()`; `_is_docker_running` now calls probe; `_get_embedding` uses `self.embedding_model`/`self.embedding_revision` and raises on failure (no md5 fallback); `__init__` reads Settings |
| NEW | `backend/tests/test_qdrant_router.py` — 5 tests covering M-B3×3, M-H1×1, M-H2×1 |
| AMEND | `docs/adr/0002-retrieval-layer-starts-with-qdrant.md` — added "Operational commitments" section enumerating the three contracts |

The full diff is in commit `1ebc0ee` — do not re-derive.

## Decisions made in this session (carry forward)

1. **M-B1 deferred to Phase 7** (graph hardening). Phase 2's
   plan listed M-B1 as a finding but its file (`kuzu_graph_layer.py`)
   is not in Phase 2's file list. The plan's dependency graph
   has Phase 7 owning `kuzu_graph_layer.py`. User confirmed
   in Q&A: "go with option 1 if this changes are not dependent
   in later phases ig we planed acorrding to that if i recall
   correctly". Phase 7 (graph hardening) addresses M-B1.

2. **ADR-0002 amended, not created.** The plan's Phase-2 file
   list says "create `docs/adr/0002-retrieval-layer-starts-with-qdrant.md`"
   but the file already exists on `main`. User confirmed
   amendment (option 2 in Q&A): added an "Operational
   commitments" section that documents the three Phase-2
   contracts (M-B3, M-H1, M-H2). The existing "why Qdrant"
   architecture rationale is preserved.

3. **Commit subject trimmed from 77 to 71 chars.** Plan's
   verbatim subject is `fix(backend): qdrant healthz probe + embedding model pin + no-silent-fallback`
   (77 chars, over the ≤72 AGENTS.md cap). Trimmed to
   `fix(backend): qdrant healthz + embedding model pin + no-silent-fallback`
   (71 chars). Preserved all three finding tags.

4. **No `--no-verify` this time.** Husky pre-commit ran
   normally. The new test file initially had 4 ruff errors
   (I001 import sort, SIM117 nested `with`, UP037 quoted
   type annotation, RUF100 unused `noqa`); I fixed them in
   a follow-up edit before committing. Phase 1's
   `--no-verify` exception did not recur.

5. **No 9-file format-drift revert this time.** Unlike
   Phase 1, running `ruff format` on `qdrant_router.py` only
   reformatted the file I touched. The 9 pre-existing
   format-drift files are still Phase 14's problem.

## Next session: Phase 3 (Practice agent payload shapes)

**Branch (exact):** `feat/backend-3-payload-shapes`
**Stack:** off `feat/backend-2-qdrant-resilience` (current
HEAD of the local stack). Use `gt create feat/backend-3-payload-shapes`
so Graphite stacks it correctly.
**Findings:** 5.1, 5.2, R-2.3 (parts), R-2.4 (parts), M-H3
deferred to Phase 8 (per plan §"Re-ordering rationale")
**Acceptance:** `_coerce_problems` and `_pad_problems` gone;
union covers all 3 observed shapes; `kind="placeholder"`
marker; existing 28 tests still pass; 6+4 new tests pass.
**Commit subject (verbatim from plan):**
`feat(backend): PracticePayload discriminated union + make_artifact helper + now_iso_with_ms`
**Files (per plan §"Phase 3"):**
`backend/app/domain/artifact.py` (NEW — discriminated
`PracticePayload`); `backend/app/api/practice_agent.py`
(replace `_coerce_problems`, `_pad_problems` with
discriminated union); `backend/app/api/_artifact_factory.py`
(NEW — `make_artifact`, `append_artifact`);
`backend/app/api/_ids.py` (extend with `now_iso_with_ms`);
`backend/app/api/{practice_exercises,artifacts}.py` (use
factory); `backend/tests/test_artifact_factory.py` (NEW);
`backend/tests/test_practice_agent_payload.py` (NEW — 6 tests).

**AI runtime decision (callout in plan):** Phase 3 is the
decision point for Pydantic AI direct vs LiteLLM gateway
elevation. The plan as written assumes (a) — Pydantic AI
direct, ADR-0003-aligned default. **Ask the user before
implementing if the plan's assumption (a) holds.** If the
user prefers (b) elevate LiteLLM to gateway (write new ADR;
breaking change to `model_router`), the implementation is
wider. If (c) hybrid, see plan for details. The default is
(a) unless the user says otherwise.

### Dependencies for Phase 3

- Phase 0/1/2 (all done, stacked).
- Phase 3 is **independent of Phases 4-7** per the plan's
  dependency graph — it touches only `domain/artifact.py`,
  `api/practice_agent.py`, `api/_artifact_factory.py`,
  `api/_ids.py`, `api/practice_exercises.py`, `api/artifacts.py`,
  and adds two new test files.
- `now_iso_with_ms` is an extension of `new_id` — both live
  in `backend/app/api/_ids.py`. **Phase 1's canonical id
  generator should be reused**, not re-implemented.
- Discriminated union on `PracticePayload` (with a
  `kind="placeholder"` marker) is the *single source of
  truth* for artifact payload shapes going forward.
  Phase 8 (orchestration) and Phase 11 (store cleanup)
  will refactor consumers to use the union.

## Daily ritual for the next session

```bash
cd /d/Robotics/Learning-Platform/Practice-tool
git checkout feat/backend-2-qdrant-resilience
git pull --rebase
gt log short                                 # see current stack
gt restack                                   # rebase stack on any new main
# Verify auth if needed:
gt auth --token <token>                      # only if a future submit fails
# Pre-flight checks (foundation should still be green):
cd backend && uv run pytest --cov=app --cov-fail-under=55 --ignore=tests/test_workspace_api.py
# Then start Phase 3:
cd /d/Robotics/Learning-Platform/Practice-tool
gt create feat/backend-3-payload-shapes
```

At the end of the session, before chat ends:

```bash
# If Phase 3 is done and user wants to ship it:
gt submit --stack --no-edit                  # opens PR for Phase 3 (draft, like Phases 0+1+2)
```

## Suggested skills for the next session

Load these in this order:

1. **`handoff`** — to read this doc and pick up the stack.
2. **`thermo-nuclear-code-quality-review`** — run on the
   Phase 3 diff before submitting. The same gatekeeper the
   original reviews applied; §5.4 lists 19 test-coverage
   gaps to watch for.
3. **`tdd`** — Phase 3 adds 6+4 new tests; write them
   red-green-refactor.
4. **`building-pydantic-ai-agents`** — Phase 3 is the
   first phase that touches the practice agent's payload
   shape; Pydantic AI discriminated unions are the right
   tool. The skill's structured-output and validation
   patterns apply directly.
5. **`fastapi`** — `practice_exercises.py` and `artifacts.py`
   are FastAPI routes; the new `_artifact_factory` lives
   next to them.
6. **`diagnose`** — only if Phase 3's payload shapes break
   a smoke test.

Optional (load only if a Phase 3 sub-task demands them):

- **`logfire-instrumentation`** — Phase 3 doesn't wire
  events; skip unless the user expands scope.
- **`typescript-advanced-types`** — Phase 3 is
  backend-only; skip until Phase 12.

## References (do not re-derive)

- Plan: `docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md` (Phase 3 = §"Phase 3", lines 140-147)
- Layered review: `docs/reviews/code-review-by-layer.md`
  (5.1=line ?, 5.2=line ?, R-2.3, R-2.4, M-H3)
- Chat-style review: `docs/reviews/review.md`
- ADR-0002 (amended): `docs/adr/0002-retrieval-layer-starts-with-qdrant.md`
- ADR-0003: `docs/adr/0003-ai-runtime-uses-pydantic-ai-first.md` (Phase 3 decision point)
- Phase 0 handoff: `docs/handoff-2026-06-02-phase-0-complete.md` (on `feat/foundation-0-feedback-loops` branch)
- Phase 1 handoff: `docs/handoffs/2026-06-02/phase-1-ids-and-storage.md`
- Implementation-start handoff: `docs/handoffs/2026-06-02/implementation-start.md`
- Branching rule: `docs/adr/0030-agents-must-use-graphite-stacked-prs.md`
- Stack state: `gt log short`
- Phase 2 commit: `1ebc0ee`
- Phase 1 commit: `0b48fa6`
- Phase 0 commit: `7b0be2d`
- AGENTS.md docs commit: `ac3a92c` (handoff restructure on Phase 1 branch)
- PRs (pending): #1 (Phase 0 draft), #2 (Phase 1 draft), #3 (Phase 2 draft)
- Remote: https://github.com/mayureshh27/Practice-Workspace.git
- Prototype-sync script: `D:\DevData\Temp\UserTemp\opencode\mirror.bat`

## Redaction note

No API keys, tokens, PII, or secrets are written in this
handoff. The Graphite auth token (in `~/.config/graphite/auth`)
is referenced by its storage path only. The GitHub PAT
(Windows Credential Manager) is out of scope. Both
credentials are local-environment state and must be obtained
from the user, not guessed.
