"""Tool Registry — harness primitive for on-demand tool schema loading.

The Context Gate injects only tool names (~200 tokens total); full schemas
are served on demand via tool_lookup(name). Changing a tool's schema does
not change the seed context token count (CONTEXT.md).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Protocol

import logfire


class ToolRegistry(Protocol):
    """Store and serve tool names and JSON schemas."""

    def list_tool_names(self) -> list[str]: ...

    def get_tool_schema(self, name: str) -> dict: ...  # type: ignore

    def register(self, name: str, schema: dict[str, Any]) -> None: ...


class FileToolRegistry:
    """Concrete registry that loads JSON schemas from a directory.

    Each file in ``registry_dir`` named ``{tool_name}.json`` is a tool.
    Schemas are loaded once at construction; call ``reload()`` to rescan.
    """

    def __init__(self, registry_dir: Path | None = None) -> None:
        if registry_dir is None:
            registry_dir = Path(__file__).parent / "tool_registry"
        self._dir = registry_dir
        self._schemas: dict[str, dict] = {}  # type: ignore
        self._load()

    def _load(self) -> None:
        self._schemas.clear()
        if not self._dir.is_dir():
            logfire.warning(
                "Tool registry directory not found: {path}",
                path=str(self._dir),
            )
            return
        for path in sorted(self._dir.glob("*.json")):
            try:
                schema = json.loads(path.read_text(encoding="utf-8"))
                name = schema.get("name", path.stem)
                self._schemas[name] = schema
            except (json.JSONDecodeError, OSError) as exc:
                logfire.error(
                    "Failed to load tool schema {path}: {error}",
                    path=str(path),
                    error=str(exc),
                )
        logfire.info(
            "Loaded {count} tool schemas from {path}",
            count=len(self._schemas),
            path=str(self._dir),
        )

    def reload(self) -> None:
        """Rescan the registry directory for schema changes."""
        self._load()

    def list_tool_names(self) -> list[str]:
        """Return all registered tool names."""
        return list(self._schemas.keys())

    def list_tools_with_descriptions(self) -> list[str]:
        """Return all tools as ``"{name}: {description}"`` strings.

        Phase 6 — the Context Gate renders this into the
        ``tool_names`` slot so the LLM sees what each tool does
        without needing a separate ``tool_lookup`` call. Falls
        back to the bare name when a schema is missing the
        ``description`` key (legacy / hand-written schemas).
        """
        out: list[str] = []
        for name, schema in self._schemas.items():
            description = (schema.get("description") or "").strip()
            if description:
                out.append(f"{name}: {description}")
            else:
                out.append(name)
        return out

    def get_tool_schema(self, name: str) -> dict:  # type: ignore
        """Return the full JSON schema for a tool.

        Raises ``KeyError`` if the tool name is not registered.
        """
        try:
            return self._schemas[name]
        except KeyError as err:
            raise KeyError(
                f"Tool '{name}' not found. Available: {', '.join(self._schemas)}"
            ) from err

    def register(self, name: str, schema: dict[str, Any]) -> None:
        """Register a new tool schema dynamically."""
        self._schemas[name] = schema


class DefaultToolRegistry(FileToolRegistry):
    """Concrete registry that loads JSON schemas and filters by agent role (ADR-0018)."""

    def get_role_tools(self, role: str) -> list[str]:
        """Return the tool names mapped to a specific agent role."""
        role_map = {
            "ingestion": ["file_read", "source_search", "graph_lookup", "memory_write"],
            "tutor": [
                "memory_read",
                "memory_write",
                "graph_lookup",
                "source_search",
                "source_search_exact",
                "session_history",
            ],
            "workflow": ["source_search_exact", "source_search", "sandbox_run"],
            "summary": [],
            "eval": ["sandbox_run"],
        }
        allowed = role_map.get(role)
        if allowed is not None:
            return [name for name in allowed if name in self._schemas]
        return self.list_tool_names()
