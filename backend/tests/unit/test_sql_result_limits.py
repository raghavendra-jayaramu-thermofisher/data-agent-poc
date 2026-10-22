import json
import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agent import tools
from app.agent.deep_agent import SYSTEM_PROMPT
from app.agent.serialization import model_result_preview
from app.agent.tools import AgentToolContext
from app.core.config import Settings
from app.data_sources.types import QueryResult

# A row shaped like the backlog order-line listing: 27 columns, about 420 bytes as JSON.
WIDE_ROW = [f"value-{index:02d}-" + "x" * 10 for index in range(27)]


def test_defaults_keep_the_model_preview_small_and_stored_tables_large():
    settings = Settings(_env_file=None)
    assert (settings.agent_model_result_max_rows, settings.agent_model_result_max_bytes) == (
        200,
        32_768,
    )
    assert (settings.agent_result_max_rows, settings.agent_result_max_bytes) == (
        50_000,
        30_000_000,
    )


def test_byte_cap_limits_wide_rows_before_the_row_cap():
    columns = [f"c{index}" for index in range(27)]
    preview = model_result_preview(
        columns=columns, rows=[WIDE_ROW] * 1000, truncated=False, max_rows=200, max_bytes=32_768
    )
    size = len(json.dumps(preview["rows"], separators=(",", ":")).encode())
    assert 50 <= len(preview["rows"]) < 200
    assert size <= 32_768 and preview["truncated"] is True and preview["row_count"] == 1000

    narrow = model_result_preview(
        columns=["region", "value"], rows=[["Japan", 1]] * 150, truncated=False,
        max_rows=200, max_bytes=32_768,
    )
    assert len(narrow["rows"]) == 150 and narrow["truncated"] is False


def test_prompt_asks_for_one_query_per_listing():
    assert "Never split one listing across several" in SYSTEM_PROMPT
    assert "stored_row_limit" in SYSTEM_PROMPT


@pytest.fixture
def sql_tool(monkeypatch):
    source_id = uuid.uuid4()
    settings = Settings(
        _env_file=None, agent_result_max_rows=1000, agent_model_result_max_rows=200,
        agent_model_result_max_bytes=32_768,
    )
    context = AgentToolContext(
        job_id=uuid.uuid4(), organization_id=uuid.uuid4(), conversation_id=uuid.uuid4(),
        allowed_data_source_ids=frozenset([source_id]), settings=settings,
    )
    added = []
    session = AsyncMock()
    session.add = MagicMock(side_effect=added.append)
    session.get = AsyncMock(return_value=SimpleNamespace())

    @asynccontextmanager
    async def factory():
        yield session

    def adapter_with(row_count):
        async def execute_read_query(sql, *, max_rows):
            count = min(row_count, max_rows)
            return QueryResult(
                columns=tuple(f"c{index}" for index in range(27)),
                rows=tuple(tuple(WIDE_ROW) for _ in range(count)),
                truncated=row_count > max_rows,
            )
        return SimpleNamespace(execute_read_query=execute_read_query)

    monkeypatch.setattr(tools, "get_session_factory", lambda: factory)
    monkeypatch.setattr(tools, "append_agent_event", AsyncMock())
    monkeypatch.setattr(
        tools.DataSourceService, "require_for_org",
        AsyncMock(return_value=SimpleNamespace(status="active", kind="mssql")),
    )
    return context, source_id, adapter_with, added, monkeypatch


@pytest.mark.asyncio
@pytest.mark.parametrize("row_count, capped", [(800, False), (5000, True)])
async def test_sql_result_reports_limits_and_forbids_paging_when_capped(
    sql_tool, row_count, capped
):
    context, source_id, adapter_with, added, monkeypatch = sql_tool
    monkeypatch.setattr(
        tools.DataSourceService, "resolve_adapter", AsyncMock(return_value=adapter_with(row_count))
    )
    result = await tools.execute_sql(
        context,
        {"data_source_id": str(source_id), "sql": "SELECT * FROM dbo.orders"},
        uuid.uuid4(),
    )
    stored = next(item for item in added if getattr(item, "kind", None) == "table")
    assert result["stored_row_limit"] == 1000
    assert result["stored_row_count"] == len(stored.payload["rows"]) == min(row_count, 1000)
    assert result["stored_result_truncated"] is capped
    assert (result["listing_guidance"] is not None) is capped
    assert result["preview_truncated"] is True and len(result["rows"]) < 200
