# Artifact Workflows Use Structured Templates With Editable Prompts

Artifact generation will use structured workflow templates that define source inputs, context slots, prompt text, output schema, evaluation checks, and artifact type. Starter workflows such as creating exercises, lessons, explanations, quizzes, concept maps, and reports may appear as UI actions, but their prompts remain editable so advanced users can customize the learning harness without changing code.

## Consequences

The workflow system should feel like a prompt library to the learner while remaining machine-readable for validation, tracing, and artifact storage. The UI should help users create or adapt templates rather than forcing every workflow through free-form chat.

---

## Amendment — Phase 5 (2026-06-02)

The "structured templates with editable prompts" commitment above is
operationalised by three concrete mechanisms. The amendment captures
the surface and the audit log that the editor + Studio rely on; the
behaviour was previously implicit and is now pinned.

### 1. Scope forking — `POST /api/workflows/{id}/customize`

A global template is the *canonical* form. Editing a global template
while viewing a subject must **not** mutate the global — instead the
editor forks the global into a subject/chapter/topic-scoped variant
via `customize_workflow`. The new template:

* keeps the original's `promptTemplate`, `evalGates`, `practiceConfig`,
  and `description`
* takes on `scope ∈ {subject, chapter, topic}` derived from the
  request body's `subjectId` / `chapterId` / `topicId` (the most
  specific non-null id wins)
* gets a fresh `wf-fork-…` id and the suffix `(subject)` /
  `(chapter)` / `(topic)` on its `name` so the Studio can disambiguate
* `lastRun` is reset — the fork has never been run

Closing finding **H-B1** ("global workflow mutation race"): forking
isolates the editor's mutations from the canonical form. Closing
finding **H-B2** ("subject-scoped variants must not be clobbered by
global edits"): the source is never mutated; only a copy is appended.

### 2. Real dispatch — `POST /api/workflows/{id}/run`

`/run` is the Studio's "Run" button endpoint. It loads the
template, resolves the scope from the template itself (or accepts
overrides in the body), and dispatches into the shared practice
generator. The body shape is intentionally narrower than
`/api/practice-exercises/`: it does not require the caller to
re-supply `domainId` / `subjectId` / `chapterId` because the
template already carries them post-`/customize`.

Closing findings **H-B3** ("Run button must reach the live agent",
**X-1** ("workflow run is a thin pass-through that does not persist
artifact state")): `/run` calls the same agent + gate + persist path
that the explicit `/api/practice-exercises/` route uses, and writes
the same `ArtifactGenerated` event. **X-2** ("Run button ignores
workflow scope"): scope is taken from the template, not from a
caller-supplied global.

### 3. Audit log — `eval_runs` table

Every attempt to run a workflow is logged to a new
`eval_runs` table (see `app/storage/eval_runs_repo.py`). One row per
attempt, written before the LLM call and updated on completion:

* `id` — uuid4, the `run_id` returned in API responses
* `startedAt` / `finishedAt` / `durationMs` — the attempt's wall-clock
  timing (the latency budget the Studio's alert+Retry banner reads)
* `workflowId` / `workflowName` / `domainId` / `subjectId` /
  `chapterId` / `topicId` — provenance; lets the operator answer
  "which workflows produced gate-rejected runs this week?"
* `count` / `difficulty` — request parameters; useful for re-running
  the same shape
* `status ∈ {running, succeeded, gate_rejected, error}` — terminal
  status (the writer enforces a whitelist on `finish_run`; typos do
  not slip in)
* `artifactId` — non-null only on `succeeded`; this is the join key
  back to the artifact table and, transitively, to the
  `ArtifactGenerated` event that triggered it
* `errorMessage` / `gateFailures` (JSON-encoded list) — diagnostic
  payload for `gate_rejected` and `error` rows; `gateFailures` is
  best-effort and a corrupt value decodes to an empty list

Closing finding **H-B4** ("no audit trail of practice-generation
runs"). Closing finding **H-B5** (gate wiring) is wired in Phase 4;
the `gate_rejected` terminal status is the eval_runs hook that makes
gate failures queryable in the same place as the rest of the run.

### Status semantics

| status | when | artifact_id | gate_failures |
|---|---|---|---|
| `running` | row created, agent call in flight | null | null |
| `succeeded` | gate passed + artifact persisted | set | null |
| `gate_rejected` | `artifact_gate.validate_artifact` returned `passed=False` | null | JSON list of failures |
| `error` | `ValidationError` from the agent or any other unexpected exception | null | null |

Rows for runs that never start (workflow not found, empty
`promptTemplate` → 400/404) are **not** written; the audit log
covers attempts the operator actually paid LLM cost for.
