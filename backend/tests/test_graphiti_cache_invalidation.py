from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.harness.graphiti_mastery_store import _HAS_GRAPHITI, GraphitiMasteryStore


@pytest.mark.skipif(not _HAS_GRAPHITI, reason="requires graphiti-core")
def test_graphiti_cache_invalidation(tmp_path):
    store = GraphitiMasteryStore(db_path=tmp_path / "test.db")
    store._initialised = True

    # Mocking internal methods
    store._async_ensure_concept_node = AsyncMock(return_value="mock-uuid")

    # Add to cache
    store._concept_nodes["concept1"] = "mock-uuid"

    # Check cache is not empty
    assert len(store._concept_nodes) == 1

    with patch("app.harness.graphiti_mastery_store.EntityEdge") as mock_edge:
        mock_edge.get_by_node_uuid = AsyncMock(return_value=[])
        mock_instance = MagicMock()
        mock_instance.save = AsyncMock()
        mock_edge.return_value = mock_instance

        # Append edge should clear cache
        store.append_mastery_edge("concept1", 0.5, "event-1", datetime.now(UTC))

        # Cache must be empty after appending edge
        assert len(store._concept_nodes) == 0
