import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.agent import tools
from app.agent.tools import AgentToolContext, AgentToolError
from app.conversations.table_scope import SourceTableScope
from app.core.config import Settings


@pytest.fixture
def restricted_tools(monkeypatch):
    source_id, version_id = uuid.uuid4(), uuid.uuid4()
    context = AgentToolContext(
        job_id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        conversation_id=uuid.uuid4(),
        allowed_data_source_ids=frozenset([source_id]),
        settings=Settings(_env_file=None),
        table_scope=(
            SourceTableScope(
                data_source_id=source_id,
                mode="selected",
                tables=[{"schema": "dbo", "name": "orders"}],
                knowledge_version_id=version_id,
            ),
        ),
    )
    session = AsyncMock()

    @asynccontextmanager
    async def factory():
        yield session

    monkeypatch.setattr(tools, "get_session_factory", lambda: factory)
    monkeypatch.setattr(tools, "append_agent_event", AsyncMock())
    monkeypatch.setattr(
        tools.KnowledgeRepository,
        "get_base_for_source",
        AsyncMock(
            return_value=SimpleNamespace(
                id=uuid.uuid4(), current_version_id=version_id, status="ready"
            )
        ),
    )
    return context, source_id, version_id, session


async def test_unselected_schema_cannot_be_read(restricted_tools, monkeypatch):
    context, source_id, _, _ = restricted_tools
    get_document = AsyncMock()
    monkeypatch.setattr(tools.KnowledgeRepository, "get_document", get_document)
    with pytest.raises(AgentToolError) as error:
        await tools.read_table_schema(
            context, {"data_source_id": str(source_id), "table_key": "dbo.customers"}, uuid.uuid4()
        )
    assert error.value.code == "TABLE_NOT_AUTHORIZED"
    get_document.assert_not_called()


async def test_index_only_lists_selected_objects(restricted_tools, monkeypatch):
    context, source_id, _, _ = restricted_tools
    index = SimpleNamespace(content_markdown="dbo.orders dbo.customers", estimated_tokens=10)
    table = SimpleNamespace(
        metadata_json={"schema": "dbo", "table": "orders", "object_type": "table"}
    )
    monkeypatch.setattr(
        tools.KnowledgeRepository, "get_document", AsyncMock(side_effect=[index, table])
    )
    monkeypatch.setattr(tools.KnowledgeRepository, "list_annotations", AsyncMock(return_value=[]))
    result = await tools.read_knowledge_index(
        context, {"data_source_id": str(source_id)}, uuid.uuid4()
    )
    assert "dbo.orders" in result["index_markdown"]
    assert "customers" not in result["index_markdown"]


async def test_unselected_sql_never_reaches_adapter(restricted_tools, monkeypatch):
    context, source_id, _, session = restricted_tools
    monkeypatch.setattr(
        tools.DataSourceService,
        "require_for_org",
        AsyncMock(return_value=SimpleNamespace(status="active", kind="mssql")),
    )
    adapter = AsyncMock()
    monkeypatch.setattr(tools.DataSourceService, "resolve_adapter", adapter)
    session.execute.return_value = SimpleNamespace(
        scalars=lambda: SimpleNamespace(
            all=lambda: [
                {"schema": "dbo", "table": "orders"},
                {"schema": "dbo", "table": "customers"},
            ]
        )
    )
    with pytest.raises(AgentToolError) as error:
        await tools.execute_sql(
            context,
            {"data_source_id": str(source_id), "sql": "SELECT * FROM dbo.customers"},
            uuid.uuid4(),
        )
    assert error.value.code == "SQL_TABLE_NOT_AUTHORIZED"
    adapter.assert_not_called()


async def test_removed_selected_table_never_reaches_adapter(restricted_tools, monkeypatch):
    context, source_id, _, session = restricted_tools
    monkeypatch.setattr(
        tools.DataSourceService,
        "require_for_org",
        AsyncMock(return_value=SimpleNamespace(status="active", kind="mssql")),
    )
    adapter = AsyncMock()
    monkeypatch.setattr(tools.DataSourceService, "resolve_adapter", adapter)
    session.execute.return_value = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    with pytest.raises(AgentToolError) as error:
        await tools.execute_sql(
            context,
            {"data_source_id": str(source_id), "sql": "SELECT * FROM dbo.orders"},
            uuid.uuid4(),
        )
    assert error.value.code == "TABLE_SCOPE_STALE"
    adapter.assert_not_called()
