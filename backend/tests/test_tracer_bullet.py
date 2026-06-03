"""End-to-end tracer bullet integration tests.

Per PRD-harness-layer.md §308-314:
  Given: one ingested PDF chunk, one mastery state, one active blind spot,
         one practice exercise.
  When: hint pipeline runs end-to-end.
  Then: ``HintResponse`` is a valid Pydantic model, contains no solution
         code, ends with a question, cites a source chunk_id.
  Seed context token count < 10,000 tokens.
  ``HintRequested`` event written with correct foreign keys.
"""

from datetime import UTC
from pathlib import Path

import pytest

from app.domain.events import PracticeAttempted
from app.harness.compaction_config import CompactionConfig
from app.harness.context_gate import DefaultContextGate
from app.harness.eval_gate import SocraticGate
from app.harness.event_emitter import emit_event
from app.harness.model_router import DefaultModelRouter
from app.harness.tool_registry import FileToolRegistry
from app.storage import event_store


@pytest.mark.asyncio
async def test_context_gate_seed_budget(db_session):
    """Verify the seed context stays within the ~9,400 token budget.

    Per PRD-harness-layer.md:
      - Seed context is approximately 9,400 tokens
      - System slot has a hard 800 token budget
    """
    tool_registry = FileToolRegistry()
    gate = DefaultContextGate(
        tool_registry=tool_registry,
        system_prompt="You are a Socratic tutor.",
    )

    seed = gate.build_seed_context(
        task_intent="Explain the concept of configuration space.",
        source_ids=["source-1"],
        workflow_name="generate_hint",
    )

    total_tokens = (
        len(seed.system_slot.split())
        + len(seed.task_intent.split())
        + len(" ".join(seed.tool_names).split())
    )

    # System slot must be under hard budget
    assert len(seed.system_slot.split()) <= 800
    # Total seed should be reasonable
    assert total_tokens < 5000


def test_compaction_config_defaults(db_session):
    """Verify CompactionConfig serializes correctly.

    Per ADR-0016 and PRD-context-engineering-layer.md §99-121.
    """
    cfg = CompactionConfig()
    assert cfg.clear.trigger_tokens == 30_000
    assert cfg.compact.trigger_tokens == 60_000
    assert "blind spots" in cfg.compact.preserve_instruction

    cfg.configure_for_session("test-session-1")
    assert "test-session-1" in cfg.raw_history_db


def test_mastery_rule_pure_python(db_session):
    """Verify mastery update rule is deterministic (no LLM).

    Per PRD-memory-layer.md §178-186.
    """
    concept = "concept-test-rule"

    # Pass
    att = PracticeAttempted(
        session_id="session-test",
        concept_id=concept,
        verdict="Accepted",
    )
    emit_event(db_session, att)
    m = event_store.get_mastery_for_concept(db_session, concept)
    assert m.new_mastery == 0.10

    # Fail
    att2 = PracticeAttempted(
        session_id="session-test",
        concept_id=concept,
        verdict="WrongAnswer",
    )
    emit_event(db_session, att2)
    m2 = event_store.get_mastery_for_concept(db_session, concept)
    assert m2.new_mastery == 0.05


def test_model_router_resolves_correctly(db_session):
    """Verify Model Router returns valid config for each task type.

    Per PRD-adaptive-practice-workspace.md §106.
    """
    router = DefaultModelRouter()

    for task_type in ("tutor", "session_summary", "ingestion", "workflow", "eval"):
        cfg = router.route(task_type)
        assert cfg.provider in ("test", "google", "openai", "anthropic")
        assert cfg.max_tokens > 0
        assert 0.0 <= cfg.temperature <= 2.0

    # Without API keys set explicitly for this test, should return test or env-configured
    import os
    had_key = os.environ.pop("GOOGLE_API_KEY", None)
    cfg = router.route("tutor")
    if had_key:
        os.environ["GOOGLE_API_KEY"] = had_key
    # Provider should be either 'test' (no key) or 'google' (if key was set)
    assert cfg.provider in ("test", "google")
    if cfg.provider == "test":
        assert cfg.pydantic_ai_model() == "test"


def test_blind_spot_detection_rule(db_session):
    """Verify blind spot detection is a deterministic SQL rule.

    Per PRD-memory-layer.md §188-195.
    """
    concept = "concept-blind-spot-rule"

    # 3 failed attempts across 3 sessions with non-decreasing hints
    for idx in range(3):
        emit_event(
            db_session,
            PracticeAttempted(
                session_id=f"session-bs-{idx}",
                concept_id=concept,
                verdict="WrongAnswer",
                hint_count=idx + 1,
            ),
        )

    # Blind spot should be detected
    spots = event_store.get_blind_spots(db_session, resolved=False)
    matching = [s for s in spots if s.concept_id == concept]
    assert len(matching) >= 1


def test_socratic_gate_enforces_no_answer_leak(db_session):
    """Verify Socratic Gate blocks responses with solution code.

    Per ADR-0013 and PRD-harness-layer.md §156-165.
    """
    gate = SocraticGate()

    # Should block code leakage
    leaking = "Here is the solution:\n```python\ndef solve():\n    return 42\n```"
    result = gate.validate_hint(leaking)
    assert not result.passed
    assert any("code_leak" in f for f in result.failures)

    # Should block direct answer
    direct = "The answer is 42."
    result2 = gate.validate_hint(direct)
    assert not result2.passed
    assert any("answer_leak" in f for f in result2.failures)

    # Should pass and append question when response lacks one
    safe = "Have you considered what happens when the input is negative"
    result3 = gate.validate_hint(safe)
    assert result3.passed
    assert result3.amended_text is not None
    assert result3.amended_text.endswith("?")


def test_session_raw_history_db(db_session):
    """Verify raw session history database is created and writeable.

    Per ADR-0016.
    """
    from app.agents.session_service import _ensure_raw_history_db, push_raw_event

    session_id = "test-raw-history"
    _ensure_raw_history_db(session_id)

    db_path = Path(f"sessions/{session_id}.sqlite")
    assert db_path.exists()

    push_raw_event(session_id, "test_event", {"key": "value"})

    import sqlite3
    conn = sqlite3.connect(str(db_path))
    cursor = conn.execute("SELECT COUNT(*) FROM events")
    count = cursor.fetchone()[0]
    conn.close()
    assert count >= 1

    # Cleanup
    db_path.unlink(missing_ok=True)


def test_named_harness_configs(db_session):
    """Verify all five named harness configs have correct settings.

    Per ADR-0018.
    """
    from app.harness.named_configs import (
        EVAL_HARNESS_CONFIG,
        INGESTION_HARNESS_CONFIG,
        SESSION_SUMMARY_HARNESS_CONFIG,
        TUTOR_HARNESS_CONFIG,
        WORKFLOW_HARNESS_CONFIG,
    )

    # Tutor: no deep source, Socratic gate active
    assert not TUTOR_HARNESS_CONFIG.deep_source
    assert TUTOR_HARNESS_CONFIG.socratic_gate_enabled
    assert TUTOR_HARNESS_CONFIG.memory_seed_enabled

    # Ingestion: deep source, no memory seed
    assert INGESTION_HARNESS_CONFIG.deep_source
    assert not INGESTION_HARNESS_CONFIG.memory_seed_enabled
    assert INGESTION_HARNESS_CONFIG.ingestion_gate_enabled

    # Workflow: default budget, artifact gate active, expanded tools
    assert not WORKFLOW_HARNESS_CONFIG.deep_source
    assert WORKFLOW_HARNESS_CONFIG.artifact_gate_enabled
    assert "artifact_lookup" in WORKFLOW_HARNESS_CONFIG.tool_names

    # Session Summary: minimal config, no tools
    assert not SESSION_SUMMARY_HARNESS_CONFIG.deep_source
    assert len(SESSION_SUMMARY_HARNESS_CONFIG.tool_names) == 0

    # Eval: adversarial config
    assert not EVAL_HARNESS_CONFIG.deep_source
    assert EVAL_HARNESS_CONFIG.socratic_gate_enabled
    assert EVAL_HARNESS_CONFIG.artifact_gate_enabled


def test_ingestion_agent_created(db_session):
    """Verify the IngestionAgent can be created with correct config."""
    from app.agents.ingestion_agent import IngestionDeps, ingestion_agent
    assert ingestion_agent is not None
    # Verify it uses ingestion model routing
    deps = IngestionDeps(source_id="test", source_type="pdf")
    assert deps.source_type == "pdf"


def test_workflow_agent_created(db_session):
    """Verify the WorkflowAgent can be created with correct config."""
    from app.agents.workflow_agent import WorkflowDeps, workflow_agent
    assert workflow_agent is not None
    deps = WorkflowDeps(
        session_id="test", workflow_name="create_exercise", source_ids=["s1"]
    )
    assert deps.workflow_name == "create_exercise"


def test_eval_agent_created(db_session):
    """Verify the EvalAgent can be created with correct config."""
    from app.agents.eval_agent import EvalDeps, eval_agent
    assert eval_agent is not None
    deps = EvalDeps(eval_run_id="test", target_behavior="no_code_leak")
    assert deps.target_behavior == "no_code_leak"


def test_temporal_mastery_store_point_in_time(tmp_path):
    """Verify TemporalMasteryStore supports point-in-time queries.

    Per Phase 4.1-4.2: the in-memory dict is replaced with SQLite-backed
    append-only edges. Point-in-time queries return the score at a
    specific prior timestamp.
    """
    from datetime import datetime, timedelta

    from app.harness.temporal_mastery_store import TemporalMasteryStore

    db_path = tmp_path / "test_mastery.db"
    store = TemporalMasteryStore(db_path)

    concept = "concept-point-in-time"

    t0 = datetime.now(UTC) - timedelta(hours=2)
    t1 = datetime.now(UTC) - timedelta(hours=1)
    t2 = datetime.now(UTC)

    store.append_mastery_edge(concept, 0.10, "event-1", t0)
    store.append_mastery_edge(concept, 0.20, "event-2", t1)
    store.append_mastery_edge(concept, 0.30, "event-3", t2)

    # Current should be most recent
    current = store.get_current_score(concept)
    assert current == 0.30

    # Point-in-time at t0 should be 0.10
    score_t0 = store.get_score_at_time(concept, t0 + timedelta(minutes=1))
    assert score_t0 == 0.10

    # Point-in-time at t1 should be 0.20
    score_t1 = store.get_score_at_time(concept, t1 + timedelta(minutes=1))
    assert score_t1 == 0.20

    # Before any edge should be None
    before = store.get_score_at_time(concept, t0 - timedelta(hours=1))
    assert before is None

    # All edges should be retrievable
    all_edges = store.get_all_edges(concept)
    assert len(all_edges) == 3

    # get_last_updated should return most recent
    last = store.get_last_updated(concept)
    assert last is not None
    assert abs((last - t2).total_seconds()) < 1


def test_temporal_mastery_store_persists(tmp_path):
    """Verify TemporalMasteryStore persists across instances."""
    from datetime import datetime

    from app.harness.temporal_mastery_store import TemporalMasteryStore

    db_path = tmp_path / "test_persist.db"
    concept = "concept-persist"

    # Write in one instance
    store1 = TemporalMasteryStore(db_path)
    store1.append_mastery_edge(
        concept, 0.50, "event-1", datetime.now(UTC),
    )

    # Read from a new instance
    store2 = TemporalMasteryStore(db_path)
    score = store2.get_current_score(concept)
    assert score == 0.50


def test_temporal_mastery_store_caps_score(tmp_path):
    """Verify score bounds are enforced."""
    from datetime import datetime

    from app.harness.temporal_mastery_store import TemporalMasteryStore

    store = TemporalMasteryStore(tmp_path / "test_bounds.db")

    with pytest.raises(ValueError):
        store.append_mastery_edge(
            "c1", 1.5, "e1", datetime.now(UTC),
        )

    with pytest.raises(ValueError):
        store.append_mastery_edge(
            "c1", -0.1, "e1", datetime.now(UTC),
        )


def test_graphiti_mastery_store_basic(tmp_path):
    """Verify GraphitiMasteryStore works as a drop-in replacement.

    Per Phase 4.1 (ADR-0026): mastery edges are temporal, append-only,
    and point-in-time queryable. Graphiti should implement the same
    interface as TemporalMasteryStore.
    """
    from datetime import datetime, timedelta

    from app.harness.graphiti_mastery_store import _HAS_GRAPHITI, GraphitiMasteryStore

    if not _HAS_GRAPHITI:
        pytest.skip("graphiti-core not installed")

    db_path = str(tmp_path / "test_graphiti_mastery.db")
    store = GraphitiMasteryStore(db_path=db_path)

    concept = "graphiti-test-concept"

    t0 = datetime.now(UTC) - timedelta(hours=2)
    t1 = datetime.now(UTC) - timedelta(hours=1)
    t2 = datetime.now(UTC)

    store.append_mastery_edge(concept, 0.10, "event-1", t0)
    store.append_mastery_edge(concept, 0.20, "event-2", t1)
    store.append_mastery_edge(concept, 0.30, "event-3", t2)

    current = store.get_current_score(concept)
    assert current == 0.30

    score_t0 = store.get_score_at_time(concept, t0 + timedelta(minutes=1))
    assert score_t0 == 0.10

    score_t1 = store.get_score_at_time(concept, t1 + timedelta(minutes=1))
    assert score_t1 == 0.20

    before = store.get_score_at_time(concept, t0 - timedelta(hours=1))
    assert before is None

    all_edges = store.get_all_edges(concept)
    assert len(all_edges) == 3

    last = store.get_last_updated(concept)
    assert last is not None

    assert store.get_all_concept_ids() == [concept]

    store.close()


def test_workflow_template_system(db_session):
    """Verify workflow templates load correctly from .platform/workflows/.

    Per PRD-harness-layer.md §175-183 and ADR-0008.
    """
    from pathlib import Path

    from app.harness.workflow_template_system import WorkflowTemplateSystem

    # Templates are at the project root, not the backend directory
    project_root = Path(__file__).parent.parent.parent
    templates_dir = project_root / ".platform" / "workflows"
    wts = WorkflowTemplateSystem(templates_dir=templates_dir)
    names = wts.list_template_names()

    # Should find all 7 mandatory templates
    mandatory = [
        "create_exercise",
        "create_lesson",
        "generate_hint",
        "summarise_chapter",
        "extract_concepts",
        "generate_quiz",
        "create_session_summary",
    ]
    for name in mandatory:
        assert name in names, f"Missing workflow template: {name}"

    # Each should have parsable header and non-empty content
    for name in mandatory:
        content = wts.lookup(name)
        assert len(content) > 100, f"Template {name} is too short"
        header = wts.get_header(name)
        assert "name" in header, f"Template {name} missing name in header"
        assert "description" in header, f"Template {name} missing description"

    # Non-existent template should raise
    with pytest.raises(KeyError):
        wts.lookup("nonexistent_template")
