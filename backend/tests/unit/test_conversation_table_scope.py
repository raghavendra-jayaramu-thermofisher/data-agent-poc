import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.conversations.schemas import ConversationCreate
from app.conversations.table_scope import SourceTableScope, resolve_table_scope
from app.core.errors import AppError
from app.knowledge.repository import KnowledgeRepository


def scope(source_id, name="orders"):
    return SourceTableScope(
        data_source_id=source_id, mode="selected", tables=[{"schema": "dbo", "name": name}]
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


def test_old_create_request_is_compatible():
    assert ConversationCreate(data_source_ids=[uuid.uuid4()]).table_scope == []


async def test_default_scope_is_all_and_needs_no_metadata():
    source_id = uuid.uuid4()
    result = await resolve_table_scope(AsyncMock(), uuid.uuid4(), [source_id], [])
    assert result == [
        {
            "data_source_id": str(source_id),
            "mode": "all",
            "tables": [],
            "knowledge_version_id": None,
        }
    ]


async def test_scope_cannot_include_another_source_or_duplicate_source():
    source_id = uuid.uuid4()
    for requested in [[scope(uuid.uuid4())], [scope(source_id), scope(source_id)]]:
        with pytest.raises(AppError) as error:
            await resolve_table_scope(AsyncMock(), uuid.uuid4(), [source_id], requested)
        assert error.value.code == "TABLE_SCOPE_INVALID"


async def test_selected_objects_are_validated_and_version_is_snapshotted(monkeypatch):
    source_id, version = uuid.uuid4(), uuid.uuid4()
    monkeypatch.setattr(
        KnowledgeRepository,
        "get_base_for_source",
        AsyncMock(return_value=SimpleNamespace(status="ready", current_version_id=version)),
    )
    session = AsyncMock()
    session.execute.return_value = SimpleNamespace(
        scalars=lambda: SimpleNamespace(all=lambda: [{"schema": "dbo", "table": "orders"}])
    )
    result = await resolve_table_scope(session, uuid.uuid4(), [source_id], [scope(source_id)])
    assert result[0]["knowledge_version_id"] == str(version)
    assert result[0]["tables"] == [{"schema": "dbo", "name": "orders"}]
    with pytest.raises(AppError) as error:
        await resolve_table_scope(session, uuid.uuid4(), [source_id], [scope(source_id, "missing")])
    assert error.value.code == "TABLE_SCOPE_STALE"


async def test_unavailable_schema_does_not_silently_expand_scope(monkeypatch):
    monkeypatch.setattr(KnowledgeRepository, "get_base_for_source", AsyncMock(return_value=None))
    source_id = uuid.uuid4()
    with pytest.raises(AppError) as error:
        await resolve_table_scope(AsyncMock(), uuid.uuid4(), [source_id], [scope(source_id)])
    assert error.value.code == "KNOWLEDGE_NOT_READY"
