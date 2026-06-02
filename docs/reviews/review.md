Thermo-Nuclear Code Review — Studio Workflows Integration
Scope: the 12 commits on feat/studio-workflows-integration (= current main on Practice-Workspace), reviewed against the four PRDs and 30 ADRs. Working tree at D:\Robotics\Learning-Platform\Practice-tool on branch dev.
The change did real work (28 new tests, backend routers wired, fork flow, alert+Retry). It also makes the codebase materially messier in several places. I'm not approving it as-is. Below is the actionable list, ordered by impact.
1. Structural regressions — blockers
1.1 SourceNotebookScreen.tsx is at 983 lines and pulls in five unrelated features
This file is the textbook case of "feature logic leaking into a shared path." One screen, five distinct features:
- Ingestion modal (state at L32–42, handlers L192–303, modal JSX L759–977) — ~250 lines for a single feature
- Chat column (state L65–71, L73–74, L129–146, JSX L458–516) — ~90 lines
- Notes (state L82–84, L185–191, JSX L708–753) — ~60 lines
- Studio workflows + Generated History (L92–108, L148–183, L539–706) — ~170 lines
- Sources column (L43–63, L120–127, JSX L311–392) — ~80 lines
this pushes the file past 1k lines. can we decompose this first? The rule isn't "did it cross 1k", it's "did the diff grow a single file to where it owns five features at once". A "Screen" should be a layout container; an "Ingestion Modal" should be a sibling component. I would not approve this without at least extracting <IngestionModal>, <ChatColumn>, and <NotesPanel> as siblings. Three extractions gets the file comfortably under 600 lines.
Code-judo move: the Ingestion Modal currently co-owns its state, its handlers, and its render in one component. The setShowAddSources boolean is shared with the rest of the screen but should be useState inside <IngestionModal> opened via a ref or a portal. The screen becomes:
<SourcesColumn subject={subject} onAddResource={addResource} />
<ChatColumn subject={subject} onWorkflowRun={runStudioWorkflow} />
<StudioColumn subject={subject} workflows={studioWorkflows} artifacts={subjectArtifacts} onRun={...} onFork={...} />
<IngestionModal subject={subject} onAddResource={addResource} />
That's a screen. What we have now is a directory.
1.2 The "backend integration" promise of the handoff is partially false: ingestion is still setTimeout mocks
handleLocalFileUpload (L194–219), handleIngestSubmit (L222–283), and handleDriveConnectMock (L285–303) are all fake handlers:
setTimeout(() => {
  Array.from(files).forEach(file => {
    const name = file.name;
    const fileType = name.split('.').pop()?.toUpperCase() || 'TXT';
    const lines = 120 + Math.floor(Math.random() * 200);  // <-- magic mock
    onAddResource?.(domain.id, subject.id, name, fileType, lines);
  });
  // ... pushes a hardcoded "📥 **Local Files Ingested Successfully!**" message
}, 1000);
The same pattern is repeated for GitHub ('🐙 **GitHub Repository Ingested!**' with lines: 160/240 hardcoded), web ('🌐 **Website Reference Ingested!**' with lines: 180), Drive ('📂 **Google Drive Connected!**' with lines: 320/190), and pasted text. None of this connects to the actual app/ingestion/ pipeline that's literally sitting in the repo, or to a POST /api/sources/ingest endpoint.
this feels like feature logic in a shared path that doesn't connect to the real backend. can we either wire it or delete it? The handoff claims "Studio workflows + LLM practice agent" backend integration. Ingestion is the Studio's other half and it's still 100% prototype. Either:
- Wire the four handleX to api.ingestFromX that hits the real ingestion pipeline, OR
- Delete the four handlers + the modal entirely (and let the user know ingestion is post-MVP via a "Coming soon" empty state).
The current state — "looks like a real ingestion flow, doesn't actually do anything" — is worse than either of the above.
1.3 Two sources of truth for artifacts
SourceNotebookScreen.tsx:104 reads from artifactsQueries.list() (TanStack Query, server-driven). The store ALSO has artifacts: Artifact[] (line 39 of workspaceStore.ts), hydrated by the loader (L83 of __root.tsx):
useWorkspaceStore.setState({ artifacts: artifacts as any })
and prepended to on every runWorkflow (L561–565) and addArtifact (L532–536). The runStudioWorkflow function then does await artifactsQuery.refetch() to update the TanStack Query side. Both sources of truth have the same data — for now — but the store-level prepend is redundant code that introduces a divergence surface. Any future code that reads useWorkspaceStore(s => s.artifacts) and expects the just-run workflow to be there will race with the loader's setState({ artifacts }) on next navigation.
this is feature-specific logic that's also redundant with the canonical source (TanStack Query). can we delete the store-level artifacts field entirely? The store should not own server data. The Studio panel reads from artifactsQuery.data. If something else needs the list, it should call artifactsQueries.list(). The store stays for writeable business state (workflows config, domains in localStorage as a write-through cache until the next loader pass).
1.4 workspaceStore.ts re-implements appState.ts
frontend/src/appState.ts (60 lines) exports the canonical helpers:
- getBrowserStorage(), readJsonStorage<T>(), writeJsonStorage()
- fetchJson<T>(), parseJsonResponse<T>(), errorMessage()
workspaceStore.ts:14–34 defines its own:
const getLocalStorageItem = (key: string, fallback: any) => {
  try { /* ...localStorage read + JSON.parse + console.warn on error... */ } catch (err) { ... }
};
const setLocalStorageItem = (key: string, value: any) => { /* ditto */ };
These are nearly identical to readJsonStorage/writeJsonStorage. The store then calls JSON.stringify(...) directly in 8+ places (L432, 437, 441, 533, 534, 564, 577, 583) instead of writeJsonStorage.
this looks like a bespoke helper for something we already have elsewhere. can we reuse the canonical one? Delete the two local helpers; switch every call site to readJsonStorage / writeJsonStorage from appState.ts. Saves ~25 lines and one place where the localStorage contract is loose (fallback: any becomes fallback: T with the type guard).
The same applies to the API client. workspaceApi.ts:632 builds fetch wrappers inline. appState.ts already has fetchJson<T>. The API methods should be one-liners: (args) => fetchJson(\/api/foo\`, init, 'foo', fetcher)`.
2. Code-judo opportunities
2.1 Artifact id collision bug was fixed in 2 of 4 places
The bug was: int(time.time() * 1000) produced identical ids for concurrent runs. The fix (commit f1cb154) was applied to:
- app/api/artifacts.py:78 ✅
- app/api/practice_exercises.py:112 ✅
But not to:
- app/api/workflows.py:107-110 _new_id(prefix) — still bare timestamp
- app/storage/workflowss_repo.py:147 duplicate_workflow uses int(time.time() * 1000) directly
- app/storage/workflows_repo.py:202 customize_workflow ditto
why does this need a cast / optional here? — sorry, wrong rule, this one is: the same bug pattern was fixed in two of four sites. extract a single canonical _new_id(prefix) helper and use it everywhere. The reason this matters more than just consistency: the next person who needs an id won't know there was a collision bug at all, and will re-introduce it.
# app/api/_ids.py  (or app/storage/_ids.py)
import time, uuid
def new_id(prefix: str) -> str:
    return f"{prefix}-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
Used by all four call sites. The uuid suffix is a few characters; the bug class is gone.
2.2 practice_agent.py:54 builds the agent at import time, coupled to env state
practice_agent: Agent[None, str] = Agent(
    _resolve_model(),  # reads env vars right now
    deps_type=None,
    output_type=str,
    instructions=_SYSTEM_PROMPT,
)
The inline comment says "if the operator changes the model via PRACDA_OVERRIDE_MODEL the next process restart will pick it up." That's an admission that the structure is wrong. The agent is also module-level so it can never resolve to a different model within one process — which is what PRACDA_OVERRIDE_MODEL is supposed to enable.
i think there's a code-judo move here that makes this much simpler. can we reframe this so these branches disappear? Move agent construction to per-request resolution:
def _build_agent() -> Agent[None, str]:
    return Agent(_resolve_model(), deps_type=None, output_type=str, instructions=_SYSTEM_PROMPT)

async def generate_practice(prompt, *, requested_count=5):
    agent = _build_agent()
    ...
Or — cleaner — pass the model string as a RunContext.deps so the harness owns resolution and the agent is a stateless function. The Agent becomes a small object built once per request, not a process-global.
2.3 practice_exercises.py:104–130 builds the artifact record inline
record = {
    "id": artifact_id,
    "name": f"{workflow.name} — {names.get('subject', 'practice')}",
    "type": workflow.target_type,
    "status": "draft",
    "time": time.strftime("%Y-%m-%dT%H:%M:%S.", time.gmtime()) + f"{int((now % 1) * 1000):03d}Z",
    "domain_id": body.domain_id,
    "subject_id": body.subject_id,
    "chapter_id": body.chapter_id,
    "topic_id": body.topic_id,
    "payload": {"problems": problems, "workflow_id": workflow.id, ...},
}
artifacts = getattr(request.app.state, "artifacts", [])
artifacts.append(record)
request.app.state.artifacts = artifacts
return ArtifactDTO(**record)
This is feature-specific construction in the API layer. The artifact record shape already lives in ArtifactDTO and the domain Artifact in app/domain/workspace.py. The ID stamping and time formatting are duplicated with artifacts.py:74-83. The mutation pattern (getattr → append → setattr) is also duplicated.
this is feature logic leaking into a shared path. can we isolate it? Three moves:
1. Move id and time stamping into app/api/artifacts.py (or app/domain/artifact_factory.py) as make_artifact(**fields) -> dict — single source of truth.
2. Move the mutation pattern into a helper: def append_artifact(request, record: dict) -> None — eliminates the getattr/append/setattr triplet.
3. Keep practice_exercises.py as orchestration only: workflow → problems → make_artifact(...) → append_artifact(...).
practice_exercises.py becomes 50 lines of straight-line code.
2.4 workspaceStore.ts: 8 deeply-nested CRUD actions, 15 lines each
Every action that mutates a nested node looks like this (L388–405, addTopic):
const next = state.domains.map(d => d.id !== domainId ? d : {
  ...d, subjects: d.subjects.map(s => s.id !== subjectId ? s : {
    ...s, chapters: s.chapters.map(c => c.id !== chapterId ? c : {
      ...c, topics: [...c.topics, created as any]
    })
  })
});
setLocalStorageItem('domains', next);
return { domains: next };
The same shape repeats for addChapter, addSubject, renameSubject, updateSubject, updateChapter, addResource, removeResource, addToRecents. Eight 15-line copies of the same pattern, totaling ~120 lines that could be ~30 lines.
this works, but it makes the surrounding code more spaghetti. let's keep the behavior and restructure the implementation. Extract one helper:
function updateInTree<T>(
  root: T[],
  path: (item: T) => boolean | undefined,  // returns true to replace
  updater: (item: T) => T,
): T[] { /* ... */ }
or, cleaner, a Lens/Path abstraction. Then addTopic is:
const next = updateInTree(domains,
  d => d.id === domainId,
  d => updateInTree(d.subjects,
    s => s.id === subjectId,
    s => updateInTree(s.chapters,
      c => c.id === chapterId,
      c => ({ ...c, topics: [...c.topics, created] }))));
Same code, ~6 lines, no nested ternary. This is the kind of "delete a layer of indirection by reframing" the skill asks for.
2.5 _is_model_configured is a hidden "is the test provider masquerading?" check
workflows.py:88–104:
def _is_model_configured(request: Request) -> bool:
    router_obj = getattr(request.app.state, "model_router", None)
    if router_obj is None: return False
    try:
        cfg = router_obj.route("workflow")
    except Exception:
        return False
    provider = getattr(cfg, "provider", None)
    return bool(provider) and provider != "test"
The "configured" check is currently the consumer's job (it asks for a config and then inspects the provider). The router knows better — the test provider is a router concept.
can we move this into the router?: add is_configured(task_type: str) -> bool to the ModelRouter Protocol. DefaultModelRouter returns False when its resolution lands on test. The endpoint then reads router.is_configured("workflow"). The "test = unconfigured" heuristic is owned by the router, which is where it belongs (per ADR 0003, the router is the layer boundary for provider selection).
2.6 mockData.ts still seeds the store
workspaceStore.ts:124–126:
domains: getLocalStorageItem('domains', INITIAL_DOMAINS),
workflows: getLocalStorageItem('workflows', INITIAL_WORKFLOWS),
artifacts: getLocalStorageItem('artifacts', INITIAL_ARTIFACTS),
The handoff says "Generated History = backend-driven (no local fallback)" and the loader comment says "Sync API domains into zustand store (replaces localStorage/mock data)". But the store seeds from INITIAL_DOMAINS/INITIAL_WORKFLOWS/INITIAL_ARTIFACTS on first load. Two consequences:
1. The first render flashes mock data before the loader replaces it.
2. The mockData.ts file is still required, still exported, still load-bearing.
delete a whole layer of indirection rather than polishing it. Pick one:
- Option A (preferred): Store starts empty. The loader populates it. The components render a loading state until the loader completes. mockData.ts and its INITIAL_* exports get deleted.
- Option B: Keep the mock fallback, but make it explicit and only used when the loader fails. Document it as a feature.
Currently it's the worst of both: mock data IS the initial value AND the loader overwrites it, with a console.warn if the loader fails. Either commit to the mock-first story or commit to the loader-first story.
2.7 mockData.ts is also referenced in queries.ts
api/queries.ts:21 does const { API } = await import('../problemContent') then fetch(\${API}/api/problems\`). This is a side-channel fetch that bypasses the api client. It's in a query that says queryFn: async () => { ... } with a hand-rolled if (!res.ok) throw new Error(...) — duplicating what fetchJson does. The "API" base URL is inlined into the query key + URL. **Route this through api.getProblems` like everything else.** This is the "scattered special cases in unrelated flows" anti-pattern.
2.8 SourceNotebookScreen.tsx:222–283 handleIngestSubmit is an if/else if chain
if (ingestType === 'github' && ingestUrl.trim()) { ... }
else if (ingestType === 'web' && ingestUrl.trim()) { ... }
else if (ingestType === 'text' && ingestText.trim()) { ... }
Each branch hardcodes its own mock message. Even if we keep the mocks (per 1.2 above), the branching can be a typed dispatcher:
const INGEST_TABS = [
  { id: 'upload', label: 'Upload Files', ... },
  { id: 'github', label: 'GitHub Repo', ... },
  ...
] as const;
type IngestId = (typeof INGEST_TABS)[number]['id'];

const INGEST_PANELS: Record<IngestId, React.FC<...>> = { ... };
const INGEST_HANDLERS: Record<IngestId, () => void> = { ... };
This eliminates the two as any casts (L800, L870) and the if/else if chain. Same number of mock handlers, but the dispatch is data-driven.
2.9 Workflow editor encodes eval_gates as an int reconstructed from 3 booleans
WorkflowEditorScreen.tsx:91–93:
setEvalSchema(selectedWf.evalGates >= 1);
setEvalSandbox(selectedWf.evalGates >= 2);
setEvalSource(selectedWf.evalGates >= 3);
And on save, L113–116:
let gates = 0;
if (evalSchema) gates++;
if (evalSandbox) gates++;
if (evalSource) gates++;
The int is a magic count. The booleans are the canonical UI. Save and load go in opposite directions and have to be kept in sync. The Schema/Sandbox/Source names are documented in labels and prose but not in the type.
this feels like a magic number that's pretending to be a count. Replace evalGates: int with evalGates: EvalGate[] where EvalGate = 'schema' | 'sandbox' | 'source'. Then:
const saveWf = { ..., evalGates: [evalSchema && 'schema', evalSandbox && 'sandbox', evalSource && 'source'].filter(Boolean) };
and on load, evalGates.includes('schema'), evalGates.includes('sandbox'), evalGates.includes('source'). The names are in the type. The set operations are symmetric. The order doesn't matter (the int encoding forced Schema < Sandbox < Source).
3. Boundary / type-contract problems
3.1 Artifact.payload: dict is an untyped escape hatch
SourceNotebookScreen.tsx:171–172:
artifact?.payload && typeof artifact.payload === 'object' && 'problems' in artifact.payload
  ? `(${Object.keys((artifact.payload as Record<string, unknown>).problems as object).length} problems)`
  : ''
Three casts in a row to peek at a field. The backend has three call sites that emit payload (practice, summary, quiz) but the contract is dict[str, Any]. The consumer is doing manual shape detection.
can we make the boundary more explicit instead? A discriminated union:
type ArtifactPayload =
  | { kind: 'practice'; problems: PracticeProblem[]; requestedCount: number; difficulty: string }
  | { kind: 'quiz'; questions: QuizQuestion[] }
  | { kind: 'summary'; text: string }
  | { kind: 'generic'; data: Record<string, unknown> };  // escape hatch, but explicit
The backend decides which kind to emit; the consumer narrows. No casts. The practice endpoint emits kind: 'practice', the summary emits kind: 'summary', etc.
3.2 __root.tsx:65 does setDomains(domains as any)
domains is DomainDTO[] (Zod-inferred). The store expects Domain[] (from workspaceTypes.ts). The two types are similar but not identical (ResourceSchema.fileType: string vs Resource.fileType: 'PDF' | 'HTML' | ... — the fileType in the Zod schema is string, not a literal union). The as any papers over a real divergence.
why does this need a cast here? can we make the boundary more explicit instead? Pick one source of truth for the workspace types. Either:
- The Zod schemas are the types (type Domain = z.infer<typeof DomainSchema>), OR
- The TypeScript types in workspaceTypes.ts are the source, and the Zod schemas are derived (z.object({...}): z.ZodType<Domain> = ...).
Right now we have both, and fileType is the first concrete drift. This is a slow-motion bug.
3.3 PracticeConfig.difficulty: str = "medium" with a comment that says "easy|medium|hard"
domain/workspace.py:90:
difficulty: str = "medium"  # 'easy' | 'medium' | 'hard'
The string is wide-open but the comment + the UI constrain it. Same for WorkflowTemplate.target_type: str — the editor dropdown has 5 options but the type is open.
why does this need to be str? can we make the boundary more explicit? Use Literal:
Difficulty = Literal["easy", "medium", "hard"]
TargetType = Literal["Exercise Pack", "Lesson", "Quiz", "Summary", "Workbook"]

class PracticeConfig(_CamelModel):
    count: int = 5
    difficulty: Difficulty = "medium"
    scope: PracticeScope = "topic"

class WorkflowTemplate(_CamelModel):
    target_type: TargetType
    ...
Then the editor's <CustomSelect options={[{value: 'easy', ...}, ...]}> becomes:
const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [...];
Single source of truth (the Literal), reused in the Pydantic model, the TS type, and the UI options.
3.4 _scope_label is a thin wrapper
workflows_repo.py:219–225:
def _scope_label(scope: WorkflowScope) -> str:
    return {
        "global": "global",
        "subject": "subject",
        "chapter": "chapter",
        "topic": "topic",
    }[scope]
This is dict[scope] — three lines of indirection. The function is called once (L206). Delete it; inline the dict.
3.5 workflows_repo.get_workflows() has a hidden side effect
workflows_repo.py:61–68:
def get_workflows() -> list[WorkflowTemplate]:
    global _workflows
    if not _workflows:
        restored = _restore()
        if restored is not None:
            _workflows = restored
    return _workflows
A get that mutates module state is a "weird if statement in a random place" smell. The first read of the store reads from disk and overwrites the empty global. Tests that depend on the seeded workflows get them after the first get call. Tests that don't get first get nothing.
this works, but it makes the surrounding code more spaghetti. let's keep the behavior and restructure the implementation. Reframe: the constructor is the right place to restore. Replace the module-global + lazy init with a WorkflowsRepo class that's instantiated once at startup and stored on app.state:
class WorkflowsRepo:
    def __init__(self, initial: list[WorkflowTemplate]):
        self._items = list(initial)
        # also restore from snapshot here, override initial
    def list(self, ...) -> list[WorkflowTemplate]: ...
    def add(self, wf): ...
main.py does app.state.workflows_repo = WorkflowsRepo(seed). The router calls request.app.state.workflows_repo.list(...). Pure read functions. The global keyword is gone. Test setup is one line.
4. File-size / decomposition
File	Lines
SourceNotebookScreen.tsx	983
workspaceApi.ts	632
workspaceStore.ts	586
WorkflowEditorScreen.tsx	535
ExplorerScreens.tsx	430
WorkPanel.tsx	405
WorkflowManagerScreen.tsx	366
SubjectScreen.tsx	361
kuzu_graph_layer.py	344
qdrant_router.py	308
graphiti_mastery_store.py	296
SourceNotebookScreen.tsx is the priority. WorkflowEditorScreen.tsx is next: extract <WorkflowMetadataCards> (L266–462) and <PromptEditor> (L464–527) as siblings; the orchestrator becomes the topbar + fork banner + layout.
workspaceApi.ts (632 lines) has three concerns: Zod schemas, fetch wrappers, API methods. Split:
- workspaceApi.ts — methods only, all one-liners via fetchJson
- workspaceSchemas.ts — Zod schemas, with types derived via z.infer
- (re-use) appState.ts — already has fetchJson/parseJsonResponse
After the split, workspaceApi.ts is ~150 lines.
5. Spaghetti / branching increases
5.1 practice_agent._coerce_problems has 3 fallback shapes
practice_agent.py:74–97:
for key in _PROBLEM_SHAPES:                # problems / questions / exercises
    items = payload.get(key)
    if isinstance(items, list) and items:
        return list(items)
summary = payload.get(_SUMMARY_SHAPE)     # summary
if isinstance(summary, str) and summary.strip():
    return [{"title": "Summary", "prompt": summary.strip(), "hints": []}]
return [{"title": "Generated content", ...}]  # stringify the whole payload
Three fallback paths, each with a different shape. The summary path wraps a string in a problem with title: "Summary" and the same shape as the others — but the UI can't tell them apart without inspecting the string.
why does this need silent fallback? Replace the dict with a typed Pydantic model + discriminator:
class PracticeProblem(BaseModel):
    title: str
    prompt: str
    hints: list[str] = []

class QuizQuestion(BaseModel): ...
class SummaryPayload(BaseModel): text: str

class PracticePayload(BaseModel, discriminated=True):
    kind: Literal["practice", "quiz", "summary"]
    # use Union + discriminator
Pydantic's model_validate does the shape branching. Bad shapes surface as errors, not silent "Generated content" fallbacks. The contract is explicit at the type level.
5.2 practice_agent._pad_problems appends placeholder stubs
practice_agent.py:99–119 pads with Placeholder problem N stubs whose prompt is "Click Rerun to regenerate." The UI shows the same shape — {title, prompt, hints} — and a user can't tell a real problem from a stub. There's no kind: "placeholder" discriminator.
why does this need a cast / optional here? same answer as 5.1: a typed PracticeProblem with an explicit kind field. The UI can render a placeholder differently (gray, smaller, "stub" badge).
5.3 __root.tsx has 4 try/except blocks that all do the same thing
__root.tsx:62–87:
try {
  const domains = await queryClient.ensureQueryData(domainQueries.list())
  useWorkspaceStore.getState().setDomains(domains as any)
} catch (err) {
  console.warn('Failed to fetch domains from API, using local fallback:', err)
}
try {
  await queryClient.ensureQueryData(masteryQueries.scores())
} catch (_) {}
try {
  await queryClient.ensureQueryData(masteryQueries.blindSpots())
} catch (_) {}
try {
  const wfResp = await queryClient.ensureQueryData(workflowQueries.list())
  useWorkspaceStore.getState().setWorkflows(wfResp.items as any)
  useWorkspaceStore.getState().setModelConfigured(wfResp.modelConfigured)
} catch (err) {
  console.warn('Failed to fetch workflows from API, using local fallback:', err)
}
try {
  const artifacts = await queryClient.ensureQueryData(artifactsQueries.list())
  useWorkspaceStore.setState({ artifacts: artifacts as any })
} catch (err) {
  console.warn('Failed to fetch artifacts from API, using local fallback:', err)
}
Six near-identical blocks. The "using local fallback" message is a lie for the first one (it has no fallback — the store is just not updated) and for the workflows one (the store keeps the previous workflows). The mastery and blindSpots blocks silently swallow errors.
this adds a special-case pattern that doesn't match the rest of the loader. Two cleanups:
1. The "fetch + side effect" pattern: extract loader.fetch('domains', (data) => store.setDomains(data)) — the side effect becomes a parameter.
2. The "using local fallback" log message is wrong for several cases. Either commit to local fallback (then the store MUST have a fallback path) or remove the message.
The bigger point: the loader is doing both "fetch server data" and "synchronize server data into the zustand store". Those are two responsibilities. The synchronization step is a workaround for the store-owning-server-data problem (see 1.3). Once you delete the store-level artifacts/workflows/domains fields (or, more carefully, some of them), the loader simplifies to just "prefetch queries". That's what queryClient.ensureQueryData is for.
6. Modularity / abstraction issues
6.1 Practice Settings options are duplicated
WorkflowEditorScreen.tsx:377–401 defines two <CustomSelect> dropdowns with [{value: 'easy', ...}, {value: 'medium', ...}, {value: 'hard', ...}] and [{value: 'subject', ...}, {value: 'chapter', ...}, {value: 'topic', ...}]. These are the same Difficulty and PracticeScope literal unions defined in domain/workspace.py and workspaceTypes.ts.
The third place these appear: WorkflowEditorScreen.tsx:289–295 (Target Artifact Type with 5 options).
Extract constants.ts (or co-locate with the types) with one source of truth per option set, and the type derived from the constant. Then the model, the TS type, and the UI all read the same list.
6.2 _resolve_names is a 4-level nested next() walk
practice_exercises.py:47–70:
def _resolve_names(domain_id, subject_id, chapter_id, topic_id):
    out = {"subject": "the subject"}
    domain = workspace_repo.get_domain(domain_id)
    if domain is None: return out
    subject = next((s for s in domain.subjects if s.id == subject_id), None)
    if subject is None: return out
    out["subject"] = subject.name
    if chapter_id is not None:
        chapter = next((c for c in subject.chapters if c.id == chapter_id), None)
        if chapter is not None:
            out["chapter"] = chapter.name
            if topic_id is not None:
                topic = next((t for t in chapter.topics if t.id == topic_id), None)
                if topic is not None:
                    out["topic"] = topic.name
    return out
This is a workspace_repo.get_topic_path(domain_id, subject_id, chapter_id, topic_id) -> dict[str, str] query that lives in the workspace hierarchy layer, not the practice endpoint. The current location means every future endpoint that needs subject/chapter/topic names will re-implement this walk.
can we move this into workspace_repo? A canonical name_path(domain_id, subject_id, chapter_id, topic_id) -> NamePath would centralize the resolution. NamePath = { subject: str; chapter?: str; topic?: str }. Every endpoint that needs names reads from the same source. The default fallback ("the subject") is owned by the helper, not invented at every call site.
6.3 useWorkspaceStore.getState() inside actions
workspaceStore.ts:164 does useWorkspaceStore.getState().chatSessionId inside endChatSession. The create callback already receives get (L123). Using get() is the canonical way. The pattern is mixed — some actions use get(), some use useWorkspaceStore.getState(). Low priority, but pick one.
7. Smaller things worth fixing
- practice_agent.py:25 imports ModelMessage from pydantic_ai.messages but never uses it.
- SourceNotebookScreen.tsx:39, 869–879 ingestFilter state is set but never read by any handler or sent to the backend. Dead state.
- SourceNotebookScreen.tsx:11–15 GithubIcon is defined as a local component. Lucide has a Github icon — use that, or move to a shared icons file if there are 5+ one-off icons.
- SourceNotebookScreen.tsx:498 Array.from({length: 12}) — hardcoded 12 lines for the prompt editor line gutter. The textarea has unbounded height; the gutter will be wrong for any prompt > 12 lines. Should be Array.from({length: Math.max(12, templateStr.split('\n').length)}).
- practice_exercises.py:113–119 builds the time string inline with millisecond math. The same math is in artifacts.py:82. Extract now_iso_with_ms().
- mockData.ts:213 — INITIAL_ARTIFACTS is still seed data. The backend artifacts endpoint is the source. The file's purpose is dead.
- SourceNotebookScreen.tsx:203 120 + Math.floor(Math.random() * 200) — magic random for mock. Trivial, but a hint that the whole thing is mock.
8. What's not a problem (positive findings)
To be fair:
- The Pydantic _CamelModel base class is a clean shared abstraction for the camelCase contract (domain/workspace.py:13–19). All DTOs extend it; no drift on the alias generator.
- The router file is well-organized. workflows.py is 201 lines with clear section dividers (─ Request/Response bodies ─, ─ Helpers ─, ─ Read endpoints ─, ─ Mutations ─). Easy to scan.
- practice_agent.py:204 returns a 3-tuple (problems, raw_payload, error_message) — the agent explicitly surfaces observability data to the caller. The raw_payload is unused at the call site (L105 of practice_exercises.py: problems, _raw, _err = ...) but the surface is right.
- The fork banner is the right approach. Non-dismissible, conditional on forkContext and selectedWf.scope === 'global'. Better than a dialog.
- The model router's "test" fallback (L117 of model_router.py) is a real feature for local dev — the Studio's Run button gracefully falls through to stub problems when no API key is set. The bug is in the consumer-side check (provider != "test") leaking into the API layer; the fallback itself is good.
- The 28 new tests pass. Test design is reasonable; the practice agent's parse+pad+coerce is covered.
- AGENTS.md is a good artifact (the new repo-root file) and the handoff in docs/ is comprehensive.
9. Approval bar
I am not approving this PR. The blockers are:
1. SourceNotebookScreen.tsx is at 983 lines and owns five unrelated features. Per the skill: "Do not let a PR push a file from under 1k lines to over 1k lines without a very strong reason." This file crossed that line by accumulating features. Decompose before merging further.
2. Ingestion is fake. The handoff claims backend integration; the Ingestion Modal is still setTimeout mocks. Either wire it to the real ingestion pipeline (app/ingestion/service.py exists) or delete the modal. The current state is misleading.
3. Two sources of truth for artifacts. The Studio reads from TanStack Query; the store also tracks the same data and the loader overwrites it. Delete the store-level field.
4. The id-collision bug is fixed in 2 of 4 places. Extract a canonical new_id(prefix) and use it everywhere.
5. workspaceStore.ts re-implements appState.ts. Replace the local helpers with the canonical ones.
These are all structural — not style nits. Once those five are addressed, the second-tier items (typed ArtifactPayload discriminator, evalGates enum, mockData.ts cleanup, repo class refactor) become the next pass.
TL;DR for the user
Five concrete moves would clean this up dramatically:
1. Decompose SourceNotebookScreen.tsx into <SourcesColumn>, <ChatColumn>, <StudioColumn>, <IngestionModal> siblings. Gets the file under 600 lines and makes the screen a screen.
2. Wire or delete ingestion. The Ingestion Modal is fake. Either hit app/ingestion/service.py or remove the modal and the four handleX mock handlers.
3. Delete the store-level artifacts field. The Studio reads from artifactsQuery.data; the store-level mirror is redundant and creates a divergence surface. Same for workflows and modelConfigured (both are also in TanStack Query now).
4. Extract a canonical new_id(prefix) helper in app/api/_ids.py and replace the 4 int(time.time() * 1000) sites (artifacts.py, practice_exercises.py, workflows.py _new_id, workflows_repo.py duplicate/customize).
5. Use appState.ts's canonical helpers in workspaceStore.ts and workspaceApi.ts. Delete the local getLocalStorageItem / setLocalStorageItem and route every fetch through fetchJson.
After those five, the next-tier fixes (typed ArtifactPayload discriminator, evalGates enum, mockData.ts removal, repo class refactor) are a follow-up PR.