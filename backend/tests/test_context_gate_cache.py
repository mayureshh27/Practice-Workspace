import os
import time
from unittest.mock import patch

from app.harness.context_gate import DefaultContextGate


def test_context_gate_mtime_invalidation(tmp_path):
    """Verify context gate invalidates cache when directory mtime changes."""
    memories_dir = tmp_path / "memories"
    memories_dir.mkdir()

    mastery_file = memories_dir / "mastery.md"
    mastery_file.write_text("initial mastery", encoding="utf-8")

    gate = DefaultContextGate(memories_dir=memories_dir)

    # Initial read
    ctx = gate.build_seed_context(task_intent="Test", source_ids=[])
    assert ctx.memory_seed == "initial mastery"

    # Sleep slightly to ensure distinct mtime if filesystem resolution is coarse
    time.sleep(0.01)

    mastery_file.write_text("updated mastery", encoding="utf-8")
    # Touch directory to guarantee mtime update
    os.utime(str(memories_dir), None)

    ctx2 = gate.build_seed_context(task_intent="Test", source_ids=[])
    assert ctx2.memory_seed == "updated mastery"


def test_context_gate_same_call_short_circuit(tmp_path):
    """Verify that stat() is only called once per build_seed_context call."""
    memories_dir = tmp_path / "memories"
    memories_dir.mkdir()
    (memories_dir / "mastery.md").write_text("some memory", encoding="utf-8")

    gate = DefaultContextGate(memories_dir=memories_dir)

    with patch("os.stat", wraps=os.stat) as mock_stat:
        # Reset call mtime context
        gate._call_mtime = None
        # Call multiple times within the same logical call context
        gate._read_memory_seed()
        gate._read_memory_seed()

        # stat should only be called once on the directory
        stat_calls = [
            call for call in mock_stat.call_args_list if str(call[0][0]) == str(memories_dir)
        ]
        assert len(stat_calls) == 1
