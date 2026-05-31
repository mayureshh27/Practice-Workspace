"""Tool Registry — harness primitive for on-demand tool schema loading.

The Context Gate injects only tool names (~200 tokens total); full schemas
are served on demand via tool_lookup(name). Changing a tool's schema does
not change the seed context token count (CONTEXT.md).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

import logfire


class ToolRegistry(Protocol):
    """Store and serve tool names and JSON schemas."""

    def list_tool_names(self) -> list[str]: ...

    def get_tool_schema(self, name: str) -> dict: ...


class FileToolRegistry:
    """Concrete registry that loads JSON schemas from a directory.

    Each file in ``registry_dir`` named ``{tool_name}.json`` is a tool.
    Schemas are loaded once at construction; call ``reload()`` to rescan.
    """

    def __init__(self, registry_dir: Path | None = None) -> None:
        if registry_dir is None:
            registry_dir = Path(__file__).parent / "tool_registry"
        self._dir = registry_dir
        self._schemas: dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        self._schemas.clear()
        if not self._dir.is_dir():
            logfire.warn(
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

    def get_tool_schema(self, name: str) -> dict:
        """Return the full JSON schema for a tool.

        Raises ``KeyError`` if the tool name is not registered.
        """
        try:
            return self._schemas[name]
        except KeyError:
            raise KeyError(
                f"Tool '{name}' not found. Available: {', '.join(self._schemas)}"
            )
