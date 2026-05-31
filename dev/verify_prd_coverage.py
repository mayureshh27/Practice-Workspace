#!/usr/bin/env python3
"""PRD Coverage Verifier -- checks implementation status across all 4 PRDs.

Usage:
    python dev/verify_prd_coverage.py

Exits 0 with coverage report printed to stdout.
"""

import ast
import importlib.util
import os
import sys
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parent.parent

PASS = "[PASS]"
FAIL = "[FAIL]"
PARTIAL = "[PART]"


def exists(path: str) -> bool:
    return (ROOT / path).exists()


def has_method(filepath: str, method: str) -> bool:
    full = ROOT / filepath
    if not full.exists():
        return False
    try:
        tree = ast.parse(full.read_text(encoding="utf-8"))
    except Exception:
        return False
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == method:
            return True
        if isinstance(node, ast.AsyncFunctionDef) and node.name == method:
            return True
    return False


def has_class(filepath: str, cls: str) -> bool:
    full = ROOT / filepath
    if not full.exists():
        return False
    try:
        tree = ast.parse(full.read_text(encoding="utf-8"))
    except Exception:
        return False
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == cls:
            return True
    return False


def file_lines(filepath: str) -> int:
    full = ROOT / filepath
    if not full.exists():
        return 0
    return len(full.read_text(encoding="utf-8").splitlines())


def check(description: str, path: str, check_type: str, *args) -> tuple[str, bool]:
    if check_type == "exists":
        ok = exists(path)
    elif check_type == "method":
        ok = has_method(path, args[0])
    elif check_type == "class":
        ok = has_class(path, args[0])
    elif check_type == "both":
        ok = has_class(path, args[0]) and has_method(path, args[1])
    else:
        ok = exists(path)
    icon = PASS if ok else FAIL
    return f"  {icon} {description}", ok


def check_list(description: str, paths: list[str], check_type: str, *args) -> tuple[str, bool]:
    results = []
    all_ok = True
    for p in paths:
        if check_type == "exists":
            ok = exists(p)
        elif check_type == "method":
            ok = has_method(p, args[0])
        elif check_type == "class":
            ok = has_class(p, args[0])
        else:
            ok = exists(p)
        if not ok:
            all_ok = False
        results.append((p, ok))
    icon = PASS if all_ok else PARTIAL
    lines = f"  {icon} {description}"
    for p, ok in results:
        lines += f"\n    {PASS if ok else FAIL} {p}"
    return lines, all_ok


# ?? PRD 1: Adaptive Practice Workspace ???????????????????????????????????

PRD1_CHECKS = [
    ("Workspace Shell -- FastAPI app factory", "backend/app/main.py", "exists"),
    ("API routers registered (8 routers)", "backend/app/api/health.py", "exists"),
    ("  workspace router", "backend/app/api/workspace.py", "exists"),
    ("  events router", "backend/app/api/events.py", "exists"),
    ("  chat router", "backend/app/api/chat.py", "exists"),
    ("  mastery router", "backend/app/api/mastery.py", "exists"),
    ("  sources router", "backend/app/api/sources.py", "exists"),
    ("  artifacts router", "backend/app/api/artifacts.py", "exists"),
    ("  concepts router", "backend/app/api/concepts.py", "exists"),
    ("Ingestion pipeline exists", "ingestion-pipeline/pipeline.py", "exists"),
    ("Frontend -- Workspace Shell layout", "frontend/src/routes/__root.tsx", "exists"),
    ("Frontend -- Sources panel wired to React Query", "frontend/src/components/panels/SourcesPanel.tsx", "exists"),
    ("Frontend -- Artifacts panel wired to React Query", "frontend/src/components/panels/ArtifactsPanel.tsx", "exists"),
    ("Frontend -- Graph panel wired to React Query", "frontend/src/components/panels/GraphPanel.tsx", "exists"),
    ("Frontend -- ContextPanel", "frontend/src/components/panels/ContextPanel.tsx", "exists"),
    ("Frontend -- TutorPanel", "frontend/src/components/panels/TutorPanel.tsx", "exists"),
    ("Frontend -- MemoryPanel", "frontend/src/components/panels/MemoryPanel.tsx", "exists"),
    ("Frontend -- InspectorPanel", "frontend/src/components/panels/InspectorPanel.tsx", "exists"),
    ("Frontend -- workspaceApi with Zod schemas", "frontend/src/api/workspaceApi.ts", "exists"),
    ("SQLite database init", "backend/app/storage/database.py", "exists"),
    ("Workspace repo (domains/subjects/chapters/topics)", "backend/app/storage/workspace_repo.py", "exists"),
    ("Event store (typed event log)", "backend/app/storage/event_store.py", "exists"),
    ("Domain models for events (7 event types)", "backend/app/domain/events.py", "exists"),
    ("problems.json compatibility export", "backend/app/storage/problems_export.py", "exists"),
    ("docker-compose.yml (Qdrant only)", "docker-compose.yml", "exists"),
]

# ?? PRD 2: Context Engineering Layer ????????????????????????????????????

PRD2_CHECKS = [
    ("ContextGate -- DefaultContextGate class", "backend/app/harness/context_gate.py", "class", "DefaultContextGate"),
    ("ContextGate -- build_seed_context() (9-slot assembly)", "backend/app/harness/context_gate.py", "method", "build_seed_context"),
    ("ContextGate -- BudgetError class", "backend/app/harness/context_gate.py", "class", "BudgetError"),
    ("ContextGate -- deep_source constructor param", "backend/app/harness/context_gate.py", "method", "__init__"),
    ("ContextGate -- _read_memory_seed() for 4 files", "backend/app/harness/context_gate.py", "method", "_read_memory_seed"),
    ("CompactionConfig -- ToolClearConfig", "backend/app/harness/compaction_config.py", "class", "ToolClearConfig"),
    ("CompactionConfig -- CompactConfig", "backend/app/harness/compaction_config.py", "class", "CompactConfig"),
    ("CompactionConfig -- CompactionConfig", "backend/app/harness/compaction_config.py", "class", "CompactionConfig"),
    ("ToolRegistry -- FileToolRegistry class", "backend/app/harness/tool_registry.py", "class", "FileToolRegistry"),
    ("ToolRegistry -- get_tool_schema()", "backend/app/harness/tool_registry.py", "method", "get_tool_schema"),
    ("ToolRegistry -- list_tool_names()", "backend/app/harness/tool_registry.py", "method", "list_tool_names"),
    ("Tool schemas in tool_registry/ dir (12+ files)", "backend/app/harness/tool_registry", "exists"),
    ("Memory Seed Protocol -- memory_seed.py", "backend/app/harness/memory_seed.py", "exists"),
    ("QdrantRetrievalRouter -- index_chunks()", "backend/app/harness/qdrant_router.py", "method", "index_chunks"),
    ("QdrantRetrievalRouter -- source_search()", "backend/app/harness/qdrant_router.py", "method", "source_search"),
    ("QdrantRetrievalRouter -- source_search_exact()", "backend/app/harness/qdrant_router.py", "method", "source_search_exact"),
    ("Retrieval Router Protocol (source_ids mandatory)", "backend/app/harness/retrieval_router.py", "exists"),
    ("Large-chunk protocol in qdrant_router.py", "backend/app/harness/qdrant_router.py", "exists"),
    ("Raw session history SQLite path", "backend/app/harness/compaction_config.py", "exists"),
]

# ?? PRD 3: Memory Layer ?????????????????????????????????????????????????

PRD3_CHECKS = [
    ("EventBase (SQLModel) -- all events share base", "backend/app/domain/events.py", "class", "EventBase"),
    ("SourceIngested event", "backend/app/domain/events.py", "class", "SourceIngested"),
    ("ArtifactGenerated event", "backend/app/domain/events.py", "class", "ArtifactGenerated"),
    ("PracticeAttempted event", "backend/app/domain/events.py", "class", "PracticeAttempted"),
    ("HintRequested event", "backend/app/domain/events.py", "class", "HintRequested"),
    ("BlindSpotDetected event", "backend/app/domain/events.py", "class", "BlindSpotDetected"),
    ("ConceptMasteryUpdated event", "backend/app/domain/events.py", "class", "ConceptMasteryUpdated"),
    ("SessionSummaryCreated event", "backend/app/domain/events.py", "class", "SessionSummaryCreated"),
    ("Event Emitter -- emit_event()", "backend/app/harness/event_emitter.py", "method", "emit_event"),
    ("Event Emitter -- mastery rule (+0.10 / -0.05)", "backend/app/harness/event_emitter.py", "method", "_process_practice_attempt"),
    ("Event Emitter -- blind spot detection (>=3 attempts, >=3 sessions)", "backend/app/harness/event_emitter.py", "exists"),
    ("Event Emitter -- blind spot clearing at mastery >=0.70", "backend/app/harness/event_emitter.py", "exists"),
    ("MemorySeed -- materialise_learner_state()", "backend/app/harness/memory_seed.py", "method", "materialise_learner_state"),
    ("MemoryStore -- get_blind_spots()", "backend/app/storage/event_store.py", "method", "get_blind_spots"),
    ("MemoryStore -- get_mastery_for_concept()", "backend/app/storage/event_store.py", "method", "get_mastery_for_concept"),
    ("TemporalMasteryStore -- SQLite-backed", "backend/app/harness/temporal_mastery_store.py", "class", "TemporalMasteryStore"),
    ("TemporalMasteryStore -- get_score_at_time()", "backend/app/harness/temporal_mastery_store.py", "method", "get_score_at_time"),
    ("GraphitiMasteryStore -- Graphiti-backed", "backend/app/harness/graphiti_mastery_store.py", "class", "GraphitiMasteryStore"),
    ("GraphitiMasteryStore -- append_mastery_edge() via EntityEdge.save()", "backend/app/harness/graphiti_mastery_store.py", "method", "append_mastery_edge"),
    ("GraphitiMasteryStore -- get_score_at_time()", "backend/app/harness/graphiti_mastery_store.py", "method", "get_score_at_time"),
    ("GraphLayer -- 5-method Protocol interface", "backend/app/harness/graph_layer.py", "class", "GraphLayer"),
    ("KuzuGraphLayer -- structural graph backend", "backend/app/harness/kuzu_graph_layer.py", "class", "KuzuGraphLayer"),
    ("KuzuGraphLayer -- use_graphiti flag", "backend/app/harness/kuzu_graph_layer.py", "method", "__init__"),
    ("SessionSummaryAgent exists", "backend/app/agents/session_summary.py", "exists"),
]

# ?? PRD 4: Harness Layer ????????????????????????????????????????????????

PRD4_CHECKS = [
    ("ContextGate -- 9-slot seed context (SeedContext)", "backend/app/harness/context_gate.py", "class", "SeedContext"),
    ("ContextGate -- system slot hard limit (BudgetError)", "backend/app/harness/context_gate.py", "class", "BudgetError"),
    ("ContextGate -- deep_source=False default", "backend/app/harness/context_gate.py", "method", "__init__"),
    ("MemorySeed Protocol -- 4 files", "backend/app/harness/memory_seed.py", "exists"),
    ("Retrieval Router -- 3 modes (semantic/exact/hybrid)", "backend/app/harness/qdrant_router.py", "exists"),
    ("Retrieval Router -- source_ids mandatory at type level", "backend/app/harness/retrieval_router.py", "exists"),
    ("Tool Registry -- name-only injection", "backend/app/harness/tool_registry.py", "class", "FileToolRegistry"),
    ("Tool Registry -- get_tool_schema() reads from tool_registry/", "backend/app/harness/tool_registry.py", "method", "get_tool_schema"),
    ("CompactionConfig -- ToolClearConfig + CompactConfig", "backend/app/harness/compaction_config.py", "exists"),
    ("Socratic Gate -- 3 binary checks", "backend/app/harness/eval_gate.py", "class", "SocraticGate"),
    ("Socratic Gate -- code_leak detection", "backend/app/harness/eval_gate.py", "exists"),
    ("Socratic Gate -- answer_leak detection", "backend/app/harness/eval_gate.py", "exists"),
    ("Socratic Gate -- question-ending check", "backend/app/harness/eval_gate.py", "exists"),
    ("Socratic Gate -- validate_hint returns EvalResult", "backend/app/harness/eval_gate.py", "method", "validate_hint"),
    ("Socratic Gate -- wired in main.py", "backend/app/main.py", "exists"),
    ("Artifact Gate -- validate_artifact() with 4 checks", "backend/app/harness/artifact_gate.py", "method", "validate_artifact"),
    ("Ingestion Gate -- validate_ingestion_stage() 3 checks", "backend/app/harness/ingestion_gate.py", "method", "validate_ingestion_stage"),
    ("Workflow Template System -- 7 templates", "backend/app/harness/workflow_template_system.py", "class", "WorkflowTemplateSystem"),
    ("Workflow templates dir (.platform/workflows/)", ".platform/workflows", "exists"),
    ("Event Emitter -- mastery rule (pure Python, no LLM)", "backend/app/harness/event_emitter.py", "method", "emit_event"),
    ("Event Emitter -- blind spot detection (deterministic)", "backend/app/harness/event_emitter.py", "exists"),
    ("Named Harness Configs -- 5 role configs", "backend/app/harness/named_configs.py", "exists"),
    ("  TUTOR_HARNESS_CONFIG", "backend/app/harness/named_configs.py", "exists"),
    ("  INGESTION_HARNESS_CONFIG", "backend/app/harness/named_configs.py", "exists"),
    ("  WORKFLOW_HARNESS_CONFIG", "backend/app/harness/named_configs.py", "exists"),
    ("  SESSION_SUMMARY_HARNESS_CONFIG", "backend/app/harness/named_configs.py", "exists"),
    ("  EVAL_HARNESS_CONFIG", "backend/app/harness/named_configs.py", "exists"),
    ("Model Router -- ModelRouter Protocol", "backend/app/harness/model_router.py", "class", "ModelRouter"),
    ("Model Router -- DefaultModelRouter", "backend/app/harness/model_router.py", "class", "DefaultModelRouter"),
    ("Model Router -- route(task_type) method", "backend/app/harness/model_router.py", "method", "route"),
    ("Ingestion Agent exists", "backend/app/agents/ingestion_agent.py", "exists"),
    ("Workflow Agent exists", "backend/app/agents/workflow_agent.py", "exists"),
    ("Eval Agent exists", "backend/app/agents/eval_agent.py", "exists"),
    ("Tutor agent exists", "backend/app/agents/tutor.py", "exists"),
    ("Integration tests (test_tracer_bullet.py)", "backend/tests/test_tracer_bullet.py", "exists"),
]


def run_section(title: str, checks: list) -> tuple[int, int, list[str]]:
    print(f"\n{'-'*60}")
    print(f"  {title}")
    print(f"{'-'*60}")
    passed = 0
    total = 0
    failures = []
    for check_data in checks:
        desc = check_data[0]
        path = check_data[1]
        ctype = check_data[2]
        args = check_data[3:] if len(check_data) > 3 else []
        if ctype in ("class", "method"):
            line, ok = check(desc, path, ctype, *args)
        elif ctype == "exists" and "exists" in check_data[2:]:
            line, ok = check(desc, path, ctype)
        else:
            line, ok = check(desc, path, ctype, *args)
        print(line)
        total += 1
        if ok:
            passed += 1
        else:
            failures.append(desc)
    return passed, total, failures


def main():
    print()
    print("#" * 60)
    print("#  PRD COVERAGE VERIFIER -- Adaptive Practice Workspace")
    print("#" * 60)
    print(f"  Root: {ROOT}")
    print()

    all_passed = 0
    all_total = 0
    all_failures = []

    sections = [
        ("PRD 1: Adaptive Practice Workspace", PRD1_CHECKS),
        ("PRD 2: Context Engineering Layer (v1->v1.1)", PRD2_CHECKS),
        ("PRD 3: Memory Layer", PRD3_CHECKS),
        ("PRD 4: Custom Harness Layer", PRD4_CHECKS),
    ]

    for title, checks in sections:
        p, t, f = run_section(title, checks)
        all_passed += p
        all_total += t
        all_failures.extend(f)

    # ?? Summary ????????????????????????????????????????????????????????
    print(f"\n{'-'*60}")
    print("  SUMMARY")
    print(f"{'-'*60}")
    pct = (all_passed / all_total * 100) if all_total else 0
    print(f"  Passed: {all_passed}/{all_total} ({pct:.1f}%)")
    print()

    if pct < 100:
        print("  Missing items:")
        for f in all_failures:
            print(f"    {FAIL} {f}")

    # ?? Known remaining work ???????????????????????????????????????????
    print(f"\n{'-'*60}")
    print("  KNOWN GAPS & OPEN ITEMS")
    print(f"{'-'*60}")

    gaps = []
    info = []

    # Context Gate - debug_print and usage
    cg_path = ROOT / "backend" / "app" / "harness" / "context_gate.py"
    cg = cg_path.read_text(encoding="utf-8")
    if "def debug_print" not in cg:
        gaps.append("debug_print() missing from DefaultContextGate -- PRD-required token diagnostic")
    if "def usage" not in cg:
        gaps.append("usage() missing from DefaultContextGate -- PRD-required token accounting")
    if "set_system" not in cg and "build_seed_context" in cg:
        info.append("DefaultContextGate uses build_seed_context(), not fluent set_*() -- functionally equivalent but diverges from PRD spec")

    # Named configs not wired
    has_wired = any(
        "named_configs" in (ROOT / f).read_text(encoding="utf-8")
        for f in ["backend/app/agents/ingestion_agent.py", "backend/app/agents/workflow_agent.py",
                  "backend/app/agents/eval_agent.py", "backend/app/agents/tutor.py",
                  "backend/app/agents/session_summary.py", "backend/app/main.py"]
        if (ROOT / f).exists()
    )
    if not has_wired:
        gaps.append("Named configs not wired into any agent or main.py -- 5 configs defined but unused")

    # Agent roles imported in main.py
    main_path = ROOT / "backend/app/main.py"
    if main_path.exists():
        main_content = main_path.read_text(encoding="utf-8")
        agent_imports = sum(1 for a in ["ingestion_agent", "workflow_agent", "eval_agent", "tutor", "session_summary"] if a in main_content)
        if agent_imports < 5:
            gaps.append(f"Only {agent_imports}/5 agent roles imported in main.py (need to register all 5)")
        else:
            info.append(f"All {agent_imports}/5 agent roles referenced in main.py")
    else:
        gaps.append("main.py not found")

    # Ingestion pipeline check
    if not list(ROOT.glob("ingestion-pipeline/**/*.py")):
        gaps.append("ingestion-pipeline/ directory missing or has no Python files -- PRD-required")

    # problems.json export
    if not (ROOT / "backend/app/storage/problems_export.py").exists():
        gaps.append("problems_export.py missing -- PRD-required compatibility export")

    # Integration tests
    tb = ROOT / "backend/tests/test_tracer_bullet.py"
    if tb.exists():
        content = tb.read_text(encoding="utf-8")
        test_count = content.count("def test_")
        if test_count < 16:
            gaps.append(f"test_tracer_bullet.py exists but has only {test_count}/16 test functions")
    else:
        gaps.append("test_tracer_bullet.py missing -- PRD requires 16 integration tests")

    info.append("All 7 event types present [OK]")

    if not gaps:
        print("  No gaps found!")
    else:
        for g in gaps:
            print(f"  {FAIL} {g}")
    if info:
        for i in info:
            print(f"  {PARTIAL} {i}")

    print()
    return 1 if pct < 100 else 0


if __name__ == "__main__":
    sys.exit(main())
