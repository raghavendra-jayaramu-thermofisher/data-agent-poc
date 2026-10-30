import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.conversations.schemas import ConversationCreate, ConversationTableScopeUpdate
from app.conversations.service import ConversationService
from app.conversations.table_scope import SourceTableScope, resolve_table_scope
from app.core.config import Settings
from app.core.errors import AppError
from app.knowledge.repository import KnowledgeRepository


def scope(source_id, *names):
    return SourceTableScope(
        data_source_id=source_id,
        mode="selected",
        tables=[{"schema": "dbo", "name": name} for name in names or ("orders",)],
    )


def catalog_session(*tables):
    session = AsyncMock()
    session.execute.return_value = SimpleNamespace(
        scalars=lambda: SimpleNamespace(
            all=lambda: [{"schema": "dbo", "table": table} for table in tables]
        )
    )
    return session


@pytest.fixture
def ready_knowledge(monkeypatch):
    monkeypatch.setattr(
        KnowledgeRepository,
        "get_base_for_source",
        AsyncMock(return_value=SimpleNamespace(status="ready", current_version_id=uuid.uuid4())),
    )


@pytest.mark.parametrize(
    "value",
    [
        {"mode": "selected", "tables": []},
        {"mode": "all", "tables": [{"name": "orders"}]},
        {"mode": "selected", "tables": [{"name": "orders"}, {"name": "orders"}]},
    ],
)
def test_invalid_modes_and_duplicate_tables_are_rejected(value):
    with pytest.raises(ValidationError):
        SourceTableScope(data_source_id=uuid.uuid4(), **value)


def test_create_request_defaults_to_all_tables():
    assert ConversationCreate(data_source_ids=[uuid.uuid4()]).table_scope == []


async def test_default_scope_is_all_and_needs_no_metadata():
    source_id = uuid.uuid4()
    result = await resolve_table_scope(AsyncMock(), uuid.uuid4(), [source_id], [])
    assert result == [{"data_source_id": str(source_id), "mode": "all", "tables": []}]


async def test_scope_cannot_include_another_source_or_duplicate_source():
    source_id = uuid.uuid4()
    for requested in [[scope(uuid.uuid4())], [scope(source_id), scope(source_id)]]:
        with pytest.raises(AppError) as error:
            await resolve_table_scope(AsyncMock(), uuid.uuid4(), [source_id], requested)
        assert error.value.code == "TABLE_SCOPE_INVALID"


async def test_selected_tables_missing_from_knowledge_are_dropped(ready_knowledge):
    source_id = uuid.uuid4()
    result = await resolve_table_scope(
        catalog_session("orders"), uuid.uuid4(), [source_id], [scope(source_id, "orders", "gone")]
    )
    assert result == [
        {
            "data_source_id": str(source_id),
            "mode": "selected",
            "tables": [{"schema": "dbo", "name": "orders"}],
        }
    ]


async def test_no_remaining_selected_tables_means_all_tables(ready_knowledge):
    source_id = uuid.uuid4()
    result = await resolve_table_scope(
        catalog_session("orders"), uuid.uuid4(), [source_id], [scope(source_id, "gone")]
    )
    assert result[0]["mode"] == "all"
    assert result[0]["tables"] == []


async def test_selection_is_kept_when_knowledge_is_not_ready(monkeypatch):
    monkeypatch.setattr(KnowledgeRepository, "get_base_for_source", AsyncMock(return_value=None))
    source_id = uuid.uuid4()
    result = await resolve_table_scope(AsyncMock(), uuid.uuid4(), [source_id], [scope(source_id)])
    assert result[0]["tables"] == [{"schema": "dbo", "name": "orders"}]


def test_table_scope_update_requires_a_scope_list():
    with pytest.raises(ValidationError):
        ConversationTableScopeUpdate()
    with pytest.raises(ValidationError):
        ConversationTableScopeUpdate(table_scope=[], title="Other")


async def test_update_table_scope_saves_the_resolved_scope(ready_knowledge):
    source_id = uuid.uuid4()
    session = catalog_session("orders", "customers")
    service = ConversationService(session, Settings(_env_file=None))
    item = SimpleNamespace(
        id=uuid.uuid4(), organization_id=uuid.uuid4(), table_scope=[], updated_at=None
    )
    service.repo.lock_for_org = AsyncMock(return_value=item)
    service.repo.source_ids = AsyncMock(return_value=[source_id])

    result = await service.update_table_scope(
        item.id,
        item.organization_id,
        ConversationTableScopeUpdate(table_scope=[scope(source_id, "customers")]),
    )

    service.repo.lock_for_org.assert_awaited_once_with(item.id, item.organization_id)
    session.commit.assert_awaited_once()
    assert result is item
    assert item.table_scope[0]["tables"] == [{"schema": "dbo", "name": "customers"}]
    assert item.updated_at is not None


async def test_update_table_scope_rejects_a_source_outside_the_conversation():
    session = AsyncMock()
    service = ConversationService(session, Settings(_env_file=None))
    service.repo.lock_for_org = AsyncMock(return_value=SimpleNamespace(id=uuid.uuid4()))
    service.repo.source_ids = AsyncMock(return_value=[uuid.uuid4()])

    with pytest.raises(AppError) as error:
        await service.update_table_scope(
            uuid.uuid4(),
            uuid.uuid4(),
            ConversationTableScopeUpdate(table_scope=[scope(uuid.uuid4())]),
        )

    assert error.value.code == "TABLE_SCOPE_INVALID"
    session.commit.assert_not_awaited()


async def test_update_table_scope_cannot_access_another_workspace():
    session = AsyncMock()
    service = ConversationService(session, Settings(_env_file=None))
    service.repo.lock_for_org = AsyncMock(return_value=None)

    with pytest.raises(AppError) as error:
        await service.update_table_scope(
            uuid.uuid4(), uuid.uuid4(), ConversationTableScopeUpdate(table_scope=[])
        )

    assert error.value.code == "CONVERSATION_NOT_FOUND"
    session.commit.assert_not_awaited()
