"""Named Harness Configurations — one per Agent Role (ADR-0018).

Each config defines the correct Context Gate settings, tool set, eval gates,
memory access pattern, and deep_source mode for one of the five Agent Roles:
  - Ingestion
  - Tutor
  - Workflow
  - Session Summary
  - Eval

These are not instantiated here — they are constants that main.py or the
agent factory reads to construct harness primitives correctly.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class HarnessConfig:
    """Configuration for one Agent Role's harness primitives."""

    deep_source: bool = False
    tool_names: list[str] = field(default_factory=list)
    memory_seed_enabled: bool = True
    socratic_gate_enabled: bool = False
    artifact_gate_enabled: bool = False
    ingestion_gate_enabled: bool = False
    graph_seed_enabled: bool = True
    compaction_enabled: bool = False
    system_prompt: str = ""


# ── Tutor Role ───────────────────────────────────────────────────────
# Default conservative budget, full Memory Seed, Socratic Gate active,
# Retrieval Router and Graph Layer both wired, no deep_source.

TUTOR_TOOLS = [
    "source_search",
    "source_search_exact",
    "get_concept_context",
    "memory_read",
    "memory_write",
    "skill_lookup",
    "tool_lookup",
    "file_read",
    "sandbox_run",
    "workflow_lookup",
]

TUTOR_HARNESS_CONFIG = HarnessConfig(
    deep_source=False,
    tool_names=TUTOR_TOOLS,
    memory_seed_enabled=True,
    socratic_gate_enabled=True,
    artifact_gate_enabled=False,
    ingestion_gate_enabled=False,
    graph_seed_enabled=True,
    compaction_enabled=True,
    system_prompt=(
        "You are a Socratic tutor for the Adaptive Practice Workspace. "
        "Guide learners through technical concepts using questions and "
        "hints. Never give direct answers or solution code."
    ),
)

# ── Ingestion Role ───────────────────────────────────────────────────
# Deep source mode enabled, no memory or graph seed slots, Ingestion
# Gate active, extractor-focused tool set.

INGESTION_TOOLS = [
    "tool_lookup",
    "file_read",
    "sandbox_run",
]

INGESTION_HARNESS_CONFIG = HarnessConfig(
    deep_source=True,
    tool_names=INGESTION_TOOLS,
    memory_seed_enabled=False,
    socratic_gate_enabled=False,
    artifact_gate_enabled=True,
    ingestion_gate_enabled=True,
    graph_seed_enabled=False,
    compaction_enabled=False,
    system_prompt=(
        "You are the Ingestion Agent for the Adaptive Practice Workspace. "
        "Extract structured content, concepts, and relationships from "
        "learning sources."
    ),
)

# ── Workflow Role ────────────────────────────────────────────────────
# Default budget + expanded source_chunks, reads mastery + active sources,
# Artifact Gate active, workflow-focused tool set.

WORKFLOW_TOOLS = [
    "source_search",
    "source_search_exact",
    "get_concept_context",
    "memory_read",
    "tool_lookup",
    "file_read",
    "sandbox_run",
    "artifact_lookup",
    "dedup_check",
    "workflow_lookup",
]

WORKFLOW_HARNESS_CONFIG = HarnessConfig(
    deep_source=False,
    tool_names=WORKFLOW_TOOLS,
    memory_seed_enabled=True,
    socratic_gate_enabled=False,
    artifact_gate_enabled=True,
    ingestion_gate_enabled=False,
    graph_seed_enabled=True,
    compaction_enabled=False,
    system_prompt=(
        "You are a Workflow Agent for the Adaptive Practice Workspace. "
        "Generate structured learning artifacts from source material "
        "following the specified workflow template."
    ),
)

# ── Session Summary Role ─────────────────────────────────────────────
# Minimal seed context. Event list is the only input. No retrieval,
# no graph, no memory. No eval gates. No compaction.

SESSION_SUMMARY_HARNESS_CONFIG = HarnessConfig(
    deep_source=False,
    tool_names=[],
    memory_seed_enabled=False,
    socratic_gate_enabled=False,
    artifact_gate_enabled=False,
    ingestion_gate_enabled=False,
    graph_seed_enabled=False,
    compaction_enabled=False,
    system_prompt=(
        "Summarize the practice session into a compressed pedagogical "
        "record. Identify concepts covered, mastery changes, and key "
        "learning moments. Keep the summary under 200 words."
    ),
)

# ── Eval Role ────────────────────────────────────────────────────────
# Adversarial config for red-teaming. No Memory Seed. No Retrieval.
# No compaction. Writes JSONL logs.

EVAL_HARNESS_CONFIG = HarnessConfig(
    deep_source=False,
    tool_names=[],
    memory_seed_enabled=False,
    socratic_gate_enabled=True,
    artifact_gate_enabled=True,
    ingestion_gate_enabled=True,
    graph_seed_enabled=False,
    compaction_enabled=False,
    system_prompt=(
        "You are an Eval Agent for the Adaptive Practice Workspace. "
        "Generate adversarial test cases to validate the platform's "
        "pedagogical safety and content quality."
    ),
)
