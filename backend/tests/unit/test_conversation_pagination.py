import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import JSON, Column, MetaData, Table, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from app.conversations.models import Conversation, ConversationDataSource, Message
from app.conversations.service import ConversationService
from app.core.config import Settings
from app.core.errors import AppError
from app.core.pagination import CursorCodec

BASE = datetime(2026, 1, 1, tzinfo=UTC)
ORG, OTHER_ORG = uuid.uuid4(), uuid.uuid4()


@pytest.fixture
def session():
    # An isolated in-memory database; no application database or runtime data is touched.
    engine = create_engine("sqlite://")
    metadata = MetaData()
    for model in (Conversation, ConversationDataSource, Message):
        Table(model.__tablename__, metadata, *(
            Column(
                column.name,
                JSON() if isinstance(column.type, JSONB) else column.type,
                primary_key=column.primary_key,
                nullable=True,
            )
            for column in model.__table__.columns
        ))
    metadata.create_all(engine)
    with Session(engine) as sync_session:
        db = AsyncMock()
        db.execute.side_effect = lambda statement: sync_session.execute(statement)
        db.insert = lambda table, rows: sync_session.execute(metadata.tables[table].insert(), rows)
        yield db
    engine.dispose()


def service(db, secret="pagination-test-secret-that-is-long-enough-1234"):
    return ConversationService(db, Settings(jwt_secret=secret))


def add_conversations(db, count, *, organization_id=ORG, same_time=False, title="Revenue"):
    items = [
        SimpleNamespace(
            id=uuid.uuid4(), organization_id=organization_id, title=f"{title} {index}",
            created_by=uuid.uuid4(), table_scope=[],
            created_at=BASE, updated_at=BASE if same_time else BASE + timedelta(minutes=index),
        )
        for index in range(count)
    ]
    db.insert("conversations", [vars(item) for item in items])
    return items


async def collect(load):
    seen, cursor, pages = [], None, 0
    while True:
        page = await load(cursor)
        pages += 1
        seen.extend(page.items)
        assert page.has_more is (page.next_cursor is not None)
        if not page.has_more:
            return seen, pages
        cursor = page.next_cursor


@pytest.mark.asyncio
@pytest.mark.parametrize("same_time", [False, True])
async def test_conversation_pages_have_no_duplicates_or_gaps(session, same_time):
    created = add_conversations(session, 23, same_time=same_time)
    add_conversations(session, 5, organization_id=OTHER_ORG)
    svc = service(session)

    seen, pages = await collect(
        lambda cursor: svc.list_page(ORG, search="", cursor=cursor, limit=5)
    )

    expected = sorted(created, key=lambda item: (item.updated_at, item.id), reverse=True)
    assert [item.id for item in seen] == [item.id for item in expected]
    assert pages == 5


@pytest.mark.asyncio
async def test_conversation_search_is_server_side_and_escapes_wildcards(session):
    add_conversations(session, 3, title="Revenue")
    add_conversations(session, 2, title="Margin_%")
    untitled = SimpleNamespace(
        id=uuid.uuid4(), organization_id=ORG, title="  ", created_by=uuid.uuid4(),
        table_scope=[], created_at=BASE, updated_at=BASE,
    )
    session.insert("conversations", [vars(untitled)])
    svc = service(session)

    margin = await svc.list_page(ORG, search="margin_%", cursor=None, limit=10)
    wildcard = await svc.list_page(ORG, search="%", cursor=None, limit=10)
    fallback = await svc.list_page(ORG, search="untitled", cursor=None, limit=10)

    assert len(margin.items) == 2
    assert len(wildcard.items) == 2
    assert [item.id for item in fallback.items] == [untitled.id]


@pytest.mark.asyncio
async def test_conversation_cursor_is_bound_to_organization_and_search(session):
    add_conversations(session, 4)
    add_conversations(session, 4, organization_id=OTHER_ORG)
    svc = service(session)
    first = await svc.list_page(ORG, search="", cursor=None, limit=2)

    with pytest.raises(AppError) as other_org:
        await svc.list_page(OTHER_ORG, search="", cursor=first.next_cursor, limit=2)
    with pytest.raises(AppError) as other_search:
        await svc.list_page(ORG, search="rev", cursor=first.next_cursor, limit=2)

    assert other_org.value.code == other_search.value.code == "INVALID_CURSOR"
    assert {item.organization_id for item in first.items} == {ORG}


@pytest.mark.asyncio
@pytest.mark.parametrize("cursor", ["", "not-base64!", "e30", "A" * 40])
async def test_invalid_or_tampered_cursor_is_rejected(session, cursor):
    add_conversations(session, 3)
    with pytest.raises(AppError) as error:
        await service(session).list_page(ORG, search="", cursor=cursor or "x", limit=2)
    assert (error.value.code, error.value.status_code) == ("INVALID_CURSOR", 400)


@pytest.mark.asyncio
async def test_cursor_signed_with_another_secret_is_rejected(session):
    add_conversations(session, 3)
    other_settings = Settings(jwt_secret="another-secret-that-is-also-long-enough-123456")
    foreign = CursorCodec(other_settings, "conversations", ORG, "").encode([BASE, uuid.uuid4()])
    with pytest.raises(AppError):
        await service(session).list_page(ORG, search="", cursor=foreign, limit=2)


@pytest.mark.asyncio
async def test_messages_page_backwards_from_newest_in_chronological_order(session):
    conversation = add_conversations(session, 1)[0]
    other = add_conversations(session, 1)[0]
    messages = [
        SimpleNamespace(
            id=uuid.uuid4(), conversation_id=conversation.id, role="user", content=str(index),
            metadata={}, created_at=BASE + timedelta(seconds=index // 3),
        )
        for index in range(11)
    ]
    session.insert("messages", [vars(m) for m in messages] + [dict(
        id=uuid.uuid4(), conversation_id=other.id, role="user", content="other",
        metadata={}, created_at=BASE,
    )])
    svc = service(session)
    svc.require_for_org = AsyncMock(return_value=conversation)

    first = await svc.message_page(conversation.id, ORG, cursor=None, limit=4)
    pages, cursor = [first], first.next_cursor
    while cursor:
        page = await svc.message_page(conversation.id, ORG, cursor=cursor, limit=4)
        pages.append(page)
        cursor = page.next_cursor

    expected = [m.id for m in sorted(messages, key=lambda item: (item.created_at, item.id))]
    assert [item.id for item in first.items] == expected[-4:]
    assert [item.id for page in reversed(pages) for item in page.items] == expected
    assert [page.has_more for page in pages] == [True, True, False]
    with pytest.raises(AppError):
        await svc.message_page(other.id, ORG, cursor=first.next_cursor, limit=4)


@pytest.mark.asyncio
async def test_message_page_requires_conversation_in_organization(session):
    svc = service(session)
    svc.require_for_org = AsyncMock(side_effect=AppError("CONVERSATION_NOT_FOUND", "x", 404))
    with pytest.raises(AppError) as error:
        await svc.message_page(uuid.uuid4(), OTHER_ORG, cursor=None, limit=4)
    assert error.value.status_code == 404
    session.execute.assert_not_awaited()
