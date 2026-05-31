"""Model Router Contract — Layer Contract for model provider selection.

Maps task types, budgets, context length, privacy constraints, and provider
availability to model calls. The harness must stay model-agnostic; model-specific
prompts and adapters may improve performance, but core product behaviour should
not depend on any single provider or require a gateway service in local BYOK mode.

(CONTEXT.md, all four PRDs)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Protocol


class ModelConfig:
    """Resolved model configuration for a single call."""

    def __init__(
        self,
        provider: str,
        model_name: str,
        max_tokens: int = 8192,
        temperature: float = 0.0,
        adapter: str | None = None,
    ) -> None:
        self.provider = provider
        self.model_name = model_name
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.adapter = adapter

    def pydantic_ai_model(self) -> str:
        """Return the Pydantic AI model string for this config."""
        if self.provider == "test":
            return "test"
        return f"{self.provider}:{self.model_name}"

    def __repr__(self) -> str:
        return f"ModelConfig({self.provider}:{self.model_name})"


class ModelRouter(Protocol):
    """Select model provider and configuration for a task type."""

    def route(
        self,
        task_type: str,
        *,
        task_budget: int | None = None,
        privacy_mode: bool = False,
    ) -> ModelConfig: ...


@dataclass
class ProviderConfig:
    """Configuration for a single model provider."""

    model_name: str = "gemini-2.5-flash"
    api_key_env: str = "GOOGLE_API_KEY"
    base_url: str | None = None
    max_tokens: int = 8192
    temperature: float = 0.0
    adapter: str | None = None


_TASK_DEFAULTS: dict[str, ProviderConfig] = {
    "tutor": ProviderConfig(
        model_name="gemini-2.5-flash",
        api_key_env="GOOGLE_API_KEY",
        max_tokens=4096,
        temperature=0.0,
    ),
    "session_summary": ProviderConfig(
        model_name="gemini-2.5-flash",
        api_key_env="GOOGLE_API_KEY",
        max_tokens=2048,
        temperature=0.0,
    ),
    "ingestion": ProviderConfig(
        model_name="gemini-2.5-flash",
        api_key_env="GOOGLE_API_KEY",
        max_tokens=16384,
        temperature=0.0,
    ),
    "workflow": ProviderConfig(
        model_name="gemini-2.5-flash",
        api_key_env="GOOGLE_API_KEY",
        max_tokens=8192,
        temperature=0.0,
    ),
    "eval": ProviderConfig(
        model_name="gemini-2.5-flash",
        api_key_env="GOOGLE_API_KEY",
        max_tokens=4096,
        temperature=0.0,
    ),
}


def _provider_from_env(cfg: ProviderConfig) -> str:
    """Determine the provider string based on available API keys."""
    if os.environ.get(cfg.api_key_env):
        # provider portion of the Pydantic AI identifier
        provider_map = {
            "GOOGLE_API_KEY": "google",
            "ANTHROPIC_API_KEY": "anthropic",
            "OPENAI_API_KEY": "openai",
        }
        # Try the exact env var; fall back to google
        for env_var, provider in provider_map.items():
            if env_var == cfg.api_key_env:
                return provider
        return "google"
    return "test"


class DefaultModelRouter:
    """Concrete ModelRouter using environment-based provider selection.

    Resolution order:
      1. Check for ``PRACDA_OVERRIDE_MODEL`` env var (for testing).
      2. Check for task-specific API key in environment.
      3. Fall back to ``test`` (Pydantic AI TestModel for local dev).
    """

    def __init__(
        self,
        task_defaults: dict[str, ProviderConfig] | None = None,
    ) -> None:
        self._task_defaults = task_defaults or dict(_TASK_DEFAULTS)

    def route(
        self,
        task_type: str,
        *,
        task_budget: int | None = None,
        privacy_mode: bool = False,
    ) -> ModelConfig:
        """Resolve the model config for a given task type."""
        override = os.environ.get("PRACDA_OVERRIDE_MODEL")
        if override:
            parts = override.split(":", 1)
            provider = parts[0]
            model_name = parts[1] if len(parts) > 1 else "gemini-2.5-flash"
            return ModelConfig(
                provider=provider,
                model_name=model_name,
            )

        cfg = self._task_defaults.get(task_type)
        if cfg is None:
            cfg = ProviderConfig()

        provider = _provider_from_env(cfg)
        if provider == "test":
            return ModelConfig(
                provider="test",
                model_name="test",
                max_tokens=512,
                temperature=0.0,
            )

        return ModelConfig(
            provider=provider,
            model_name=cfg.model_name,
            max_tokens=task_budget or cfg.max_tokens,
            temperature=cfg.temperature,
            adapter=cfg.adapter,
        )
