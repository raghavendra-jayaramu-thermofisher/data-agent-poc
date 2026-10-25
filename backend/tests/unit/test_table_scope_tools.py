import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.agent import tools
from app.agent.tools import AgentToolContext
from app.conversations.table_scope import SourceTableScope
from app.core.config import Settings

INDEX = SimpleNamespace(
    content_markdown=(
        "# Database schema index\n\n- `dbo.orders`\n- `dbo.customers`\n- `dbo.regions`\n"
    ),
    metadata_json={"object_count": 3},
)
ORDERS = SimpleNamespace(
    metadata_json={
        "schema": "dbo",
        "table": "orders",
        "object_type": "table",
        "column_count": 4,
        "primary_key": ["order_id"],
    }
)


@pytest.fixture
def selected_tools(monkeypatch):
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
                tables=[{"schema": "dbo", "name": "orders"}, {"schema": "dbo", "name": "gone"}],
            ),
        ),
    )

    @asynccontextmanager
    async def factory():
        yield AsyncMock()

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
    monkeypatch.setattr(tools.KnowledgeRepository, "list_annotations", AsyncMock(return_value=[]))
    return context, source_id, version_id


def documents(monkeypatch):
    by_key = {("index", "index"): INDEX, ("table_schema", "dbo.orders"): ORDERS}
    get_document = AsyncMock(side_effect=lambda _version, kind, key: by_key.get((kind, key)))
    monkeypatch.setattr(tools.KnowledgeRepository, "get_document", get_document)
    return get_document


async def test_index_lists_selected_tables_and_counts_the_rest(selected_tools, monkeypatch):
    context, source_id, version_id = selected_tools
    get_document = documents(monkeypatch)
    result = await tools.read_knowledge_index(
        context, {"data_source_id": str(source_id)}, uuid.uuid4()
    )
    markdown = result["index_markdown"]
    assert "# Tables selected by the user" in markdown
    assert (
        "- `dbo.orders` — table; 4 columns; PK: order_id; schema document key: `dbo.orders`"
    ) in markdown
    assert "dbo.gone" not in markdown
    assert "dbo.customers" not in markdown
    assert "2 other tables and views exist" in markdown
    assert result["knowledge_version_id"] == str(version_id)
    get_document.assert_any_await(version_id, "table_schema", "dbo.orders")


async def test_index_can_list_every_table_after_the_selection(selected_tools, monkeypatch):
    context, source_id, _ = selected_tools
    documents(monkeypatch)
    result = await tools.read_knowledge_index(
        context, {"data_source_id": str(source_id), "include_all_tables": True}, uuid.uuid4()
    )
    markdown = result["index_markdown"]
    assert markdown.index("# Tables selected by the user") < markdown.index("dbo.customers")
    assert "other tables and views exist" not in markdown


async def test_index_without_selection_is_the_full_index(selected_tools, monkeypatch):
    context, source_id, _ = selected_tools
    documents(monkeypatch)
    context = AgentToolContext(
        **{**{field: getattr(context, field) for field in context.__dataclass_fields__},
           "table_scope": ()}
    )
    result = await tools.read_knowledge_index(
        context, {"data_source_id": str(source_id)}, uuid.uuid4()
    )
    assert result["index_markdown"] == INDEX.content_markdown


async def test_unselected_table_schema_can_be_read(selected_tools, monkeypatch):
    context, source_id, version_id = selected_tools
    customers = SimpleNamespace(content_markdown="# dbo.customers", estimated_tokens=3)
    get_document = AsyncMock(return_value=customers)
    monkeypatch.setattr(tools.KnowledgeRepository, "get_document", get_document)
    result = await tools.read_table_schema(
        context, {"data_source_id": str(source_id), "table_key": "dbo.customers"}, uuid.uuid4()
    )
    assert result["schema_markdown"] == "# dbo.customers"
    get_document.assert_awaited_once_with(version_id, "table_schema", "dbo.customers")


async def test_unselected_table_sql_is_validated_without_a_scope(selected_tools, monkeypatch):
    context, source_id, _ = selected_tools
    monkeypatch.setattr(
        tools.DataSourceService,
        "require_for_org",
        AsyncMock(return_value=SimpleNamespace(status="active", kind="mssql")),
    )
    monkeypatch.setattr(tools.DataSourceService, "resolve_adapter", AsyncMock())
    validate = Mock(side_effect=tools.SQLSafetyViolation("STOP", "stop"))
    monkeypatch.setattr(tools, "validate_read_only_sql", validate)
    with pytest.raises(tools.AgentToolError) as error:
        await tools.execute_sql(
            context,
            {"data_source_id": str(source_id), "sql": "SELECT * FROM dbo.customers"},
            uuid.uuid4(),
        )
    assert error.value.code == "STOP"
    validate.assert_called_once_with("SELECT * FROM dbo.customers", source_kind="mssql")
