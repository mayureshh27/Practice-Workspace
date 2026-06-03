from app.harness.tool_registry import DefaultToolRegistry


def test_default_tool_registry_role_filtering(tmp_path):
    registry = DefaultToolRegistry(registry_dir=tmp_path)
    # Register mock tools
    tools = {
        "file_read": {"name": "file_read"},
        "source_search": {"name": "source_search"},
        "sandbox_run": {"name": "sandbox_run"},
        "unknown_tool": {"name": "unknown_tool"},
    }
    for k, v in tools.items():
        registry.register(k, v)

    ingestion_tools = registry.get_role_tools("ingestion")
    assert "file_read" in ingestion_tools
    assert "source_search" in ingestion_tools
    assert "sandbox_run" not in ingestion_tools
    assert "unknown_tool" not in ingestion_tools

    eval_tools = registry.get_role_tools("eval")
    assert "sandbox_run" in eval_tools
    assert "file_read" not in eval_tools

    workflow_tools = registry.get_role_tools("workflow")
    assert "sandbox_run" in workflow_tools
    assert "source_search" in workflow_tools

    unknown_role_tools = registry.get_role_tools("random_role")
    # should return all
    assert "unknown_tool" in unknown_role_tools
