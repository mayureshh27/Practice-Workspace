<p align="center">
  <img src="./assets/goprac-banner.png" alt="Practice-Workspace" />
</p>

# Practice-Workspace

A local-first **adaptive practice workspace** for technical learning. It turns
books, videos, repos, and web sources into structured study material, runs
LLM-powered practice generation, and tracks progress through a
domain → subject → chapter → topic hierarchy.

> This is the **renamed home** of the project (previously `PracDaGo`).
> See `docs/repo-migration-plan.md` for the move history and
> `docs/handoff_migration.md` for the legacy context.

## What it is

A workspace where the learning loop — read, model, solve, get feedback,
build mastery — is the spine. The Studio panel runs scoped **workflows**
that emit typed artifacts (exercises, lessons, summaries, quizzes) backed
by a real LLM through a Pydantic AI agent. Workflows can be forked from
global to subject/chapter/topic scope so subject-specific edits never
mutate the global blueprint.

The product language, the layer contracts, and the architectural
decisions are all captured in-repo so the work stays coherent across
sessions and agents:

- `CONTEXT.md` — the product vocabulary (Adaptive Practice Workspace,
  Harness, Context Gate, Chunk, etc.) and the things to **avoid** calling them.
- `docs/adr/` — 30+ Architecture Decision Records, from the graph
  layer (`0001-graph-layer-starts-with-graphiti-kuzu.md`) to the
  Graphite workflow rule (`0030-agents-must-use-graphite-stacked-prs.md`).
- `docs/prd-*.md` — PRDs for the Adaptive Practice Workspace, the
  Context Engineering Layer, the Harness, and Memory.
- `docs/handoff-*.md` — session handoffs. The most recent is
  `handoff-studio-workflows.md`.
- `AGENTS.md` — repo-level rules for AI agents (handoff location,
  frontend sync, branching).

## Features

- **Domain / Subject / Chapter / Topic** workspace hierarchy with
  scope-aware navigation
- **Studio panel** with a real workflows list (replaces the prototype
  button grid) — runs workflows, surfaces backend-driven **Generated
  History**, error alert + Retry
- **Workflow editor** with prompt template, practice settings (count,
  difficulty, scope), and a non-dismissible fork banner when a global
  workflow is opened from inside a subject
- **Per-scope workflow fork** — global workflows can be customised
  into subject / chapter / topic-scoped copies without affecting the
  original
- **LLM-backed practice generation** via Pydantic AI; robust JSON
  parse with padding when the model under-fills
- **Layer contracts** between Ingestion, Storage, Retrieval, Memory,
  Graph, Model Router, Context Builder, Tools, and UI
- **Ingestion pipeline** (PDF, video transcripts, GitHub repos, web
  pages) producing typed artifacts with citations
- **Dark-first UI**, Tailwind CSS, Radix primitives, lucide icons

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, TanStack Router + Query, Tailwind CSS 4, Radix UI, lucide-react, Monaco Editor, xyflow |
| Backend | Python 3.12+, FastAPI, Pydantic v2, Pydantic AI, Logfire (optional), Uvicorn |
| Storage | In-memory + snapshot files (workspace, workflows, artifacts); Kuzu for graph; Qdrant for vector |
| Memory | Graphiti (temporal graph), Kuzu backend |
| Retrieval | Retrieval Router over chunks with mandatory citation metadata |
| AI runtime | Pydantic AI; LiteLLM kept for ingestion-pipeline compatibility |
| Package mgr | `uv` (Python), `pnpm` (frontend) |
| Workflow | Graphite (`gt`) stacked PRs — see `AGENTS.md` |

## Project Structure

```txt
Practice-Workspace/
├── AGENTS.md                 # repo-level rules for AI agents
├── CONTEXT.md                # product vocabulary and naming conventions
├── README.md                 # this file
├── backend/
│   ├── app/                  # FastAPI app
│   │   ├── agents/           # Pydantic AI agents (practice, ...)
│   │   ├── api/              # routers (workflows, artifacts, practice, workspace, ...)
│   │   ├── domain/           # Pydantic domain models
│   │   ├── harness/          # context engineering primitives
│   │   ├── ingestion/        # ingestion pipeline
│   │   ├── storage/          # in-memory repos with snapshot persistence
│   │   ├── seed.py           # demo data
│   │   └── main.py           # FastAPI entrypoint
│   ├── data/                 # runtime snapshot files (gitignored)
│   ├── tests/                # pytest suite
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/
│   │   ├── components/       # screens + UI primitives
│   │   ├── routes/           # TanStack Router file-based routes
│   │   ├── api/              # backend client + zod schemas
│   │   ├── stores/           # zustand stores
│   │   ├── styles.css        # Tailwind v4 entry
│   │   └── main.tsx
│   ├── package.json
│   └── pnpm-lock.yaml
├── docs/
│   ├── adr/                  # Architecture Decision Records (0001..0030)
│   ├── prd-*.md              # Product Requirements Documents
│   ├── handoff-*.md          # session handoffs
│   ├── repo-migration-plan.md
│   └── *.md                  # design briefs, demo sessions, etc.
├── data/                     # legacy exercise fixtures (kept for reference)
└── assets/
```

## Run Locally

You need:
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) for the backend
- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) for the frontend

### 1. Start the backend

```bash
cd backend
uv sync
uv run fastapi dev
```

The API runs on <http://localhost:8000> (default). Health check:
`GET /api/health`.

### 2. Start the frontend

In another terminal:

```bash
cd frontend
pnpm install
pnpm dev
```

The UI runs on <http://localhost:5173>. It calls the backend at
`http://localhost:8000` by default.

### 3. Optional: API key for the practice agent

`POST /api/practice-exercises` runs the workflow's prompt through a
Pydantic AI agent. Set one of the following before `uv run fastapi dev`:

```bash
export GOOGLE_API_KEY=...        # preferred
# or
export OPENAI_API_KEY=...
# or
export ANTHROPIC_API_KEY=...
```

Without a key, the practice agent falls through to `"Generated content"`
stubs so the rest of the UI stays exercisable.

## API surface (current)

| Method | Path | Purpose |
| --- | --- | --- |
| GET    | `/api/health` | Liveness check |
| GET    | `/api/workspace` | Full domain / subject / chapter / topic tree |
| GET / PATCH | `/api/workspace/...` | Workspace CRUD |
| GET / POST | `/api/workflows` | List + create workflow templates |
| GET / PATCH / DELETE | `/api/workflows/{id}` | Workflow CRUD |
| POST   | `/api/workflows/{id}/duplicate` | Duplicate |
| POST   | `/api/workflows/{id}/customize` | Fork (global → scoped) |
| GET    | `/api/workflows/model-configured` | `{configured: bool}` for the UI |
| POST   | `/api/practice-exercises` | Run a workflow's `practiceConfig` through the LLM |
| GET / POST | `/api/artifacts/` | List + create artifacts (typed, scoped, with `payload`) |

The `modelConfigured` flag is derived from
`model_router.route("workflow").provider` — false when the configured
provider is `"test"`, true otherwise. It drives the Run button enable
state in the Studio.

## Testing

```bash
# Backend (28 new tests for workflows / artifacts / practice)
cd backend
uv run pytest tests/ --ignore=tests/test_workspace_api.py -q

# Frontend
cd frontend
pnpm test
```

> The `--ignore` is for two pre-existing failures on `main` (unrelated
> to this work — the seed in `app/seed.py` was expanded from 2 to 4
> chapters per subject). Either revert the seed or update the tests.

## Contributing

**AI agents must use Graphite stacked PRs.** See
[`docs/adr/0030-agents-must-use-graphite-stacked-prs.md`](docs/adr/0030-agents-must-use-graphite-stacked-prs.md)
and the `Branching` section in `AGENTS.md`. The trunk is `main`;
working branch for the next feature should be `dev` (created via
`gt create dev`).

```bash
# Start a new feature
gt create feat/<topic>-0-<layer>
# ... commit ...
gt create feat/<topic>-1-<layer>
gt submit --stack
```

## License

TBD. The original PracDaGo content (Go practice lessons, problems) is
kept under `data/` for reference but is no longer the active product.

## Pointers

- New here? Read `CONTEXT.md` first — it defines the product
  vocabulary.
- Planning a feature? Skim the relevant PRDs in `docs/prd-*.md` and
  the matching ADRs in `docs/adr/`.
- Picking up an in-flight session? Read the latest
  `docs/handoff-*.md`.
- AI agent reading this? Read `AGENTS.md`.
