"""Workflow Template System — harness primitive for on-demand template loading.

Templates live at ``.platform/workflows/{name}.md`` with a YAML front matter
header block (machine-readable) and prompt text (human-editable).

Per PRD-harness-layer.md §175-183:
  - Injecting the full prompt into every context assembly is not permitted.
  - ``workflow_lookup(name)`` returns the full template content on demand.
  - The header block is machine-read by the Artifact Gate.
  - Editing prompt text below the header does not require a code change.
"""

from __future__ import annotations

from pathlib import Path

import logfire


class WorkflowNotFoundError(KeyError):
    """Raised when a workflow template is not found."""


class WorkflowTemplateSystem:
    """Load and serve workflow templates from ``.platform/workflows/``.

    Templates use a YAML front matter header block (between ``---``
    delimiters) followed by the prompt text.  The header contains:
      name, description, input_source_types, context_slots_needed,
      output_schema, eval_checks, artifact_type.
    """

    def __init__(self, templates_dir: Path | None = None) -> None:
        self._templates_dir = templates_dir or Path(".platform/workflows")
        self._cache: dict[str, str] = {}
        logfire.info(
            "Workflow template system initialised from {path}",
            path=str(self._templates_dir),
        )

    def list_template_names(self) -> list[str]:
        """Return all available workflow template names."""
        if not self._templates_dir.is_dir():
            return []
        return sorted(
            path.stem for path in self._templates_dir.glob("*.md")
        )

    def lookup(self, name: str) -> str:
        """Return the full template content for a workflow.

        Raises ``WorkflowNotFoundError`` if the template does not exist.
        """
        if name in self._cache:
            return self._cache[name]

        path = self._templates_dir / f"{name}.md"
        if not path.is_file():
            raise WorkflowNotFoundError(
                f"Workflow template '{name}' not found at {path}. "
                f"Available: {', '.join(self.list_template_names())}"
            )

        content = path.read_text(encoding="utf-8")
        self._cache[name] = content
        logfire.debug("Loaded workflow template '{name}' ({size} chars)", name=name, size=len(content))
        return content

    def get_header(self, name: str) -> dict:
        """Parse and return the YAML-like front matter header.

        Returns a dict with keys: name, description, input_source_types,
        context_slots_needed, output_schema, eval_checks, artifact_type.
        Returns an empty dict if the header cannot be parsed.
        """
        content = self.lookup(name)
        parts = content.split("---", 2)
        if len(parts) < 3:
            return {}

        header_lines = parts[1].strip().split("\n")
        header: dict = {}
        for line in header_lines:
            if ":" in line:
                key, _, value = line.partition(":")
                key = key.strip()
                value = value.strip()
                # Parse list values
                if value.startswith("[") and value.endswith("]"):
                    inner = value[1:-1]
                    items = [item.strip().strip('"').strip("'") for item in inner.split(",")]
                    header[key] = items
                else:
                    header[key] = value
        return header

    def reload(self) -> None:
        """Clear the cache and rescan the templates directory."""
        self._cache.clear()
        logfire.info("Workflow template cache cleared")
