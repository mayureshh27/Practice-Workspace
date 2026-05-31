"""Tests for Pydantic AI agent stubs running under TestModel."""

import pytest
from pydantic_ai.models.test import TestModel


@pytest.mark.asyncio
async def test_tutor_agent_runs_under_test_model():
    """Tutor agent can run under TestModel without external API keys."""
    from app.agents.tutor import TutorDeps, tutor_agent

    m = TestModel()
    with tutor_agent.override(model=m):
        result = await tutor_agent.run(
            "What is a rotation matrix?",
            deps=TutorDeps(
                session_id="test-session",
                concept_ids=["rot-matrices"],
                source_ids=["res-pdf"],
            ),
        )
        assert result.output is not None
        assert isinstance(result.output, str)


@pytest.mark.asyncio
async def test_session_summary_agent_runs_under_test_model():
    """Session summary agent produces structured output under TestModel."""
    from app.agents.session_summary import (
        SessionSummaryDeps,
        SessionSummaryOutput,
        session_summary_agent,
    )

    m = TestModel()
    with session_summary_agent.override(model=m):
        result = await session_summary_agent.run(
            "Summarize the session events: ...",
            deps=SessionSummaryDeps(session_id="test-session"),
        )
        assert result.output is not None
        assert isinstance(result.output, SessionSummaryOutput)
