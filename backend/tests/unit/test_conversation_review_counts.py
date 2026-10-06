import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import Column, MetaData, String, Table, Uuid, create_engine

from app.conversations.repository import ConversationRepository


@pytest.mark.asyncio
async def test_counts_all_assistant_answers_without_counting_other_roles_or_conversations():
    engine = create_engine('sqlite://')
    metadata = MetaData()
    messages = Table(
        'messages', metadata,
        Column('conversation_id', Uuid, nullable=False),
        Column('role', String), Column('verification_status', String),
    )
    metadata.create_all(engine)
    target, other, empty = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    rows = [dict(conversation_id=target, role='assistant', verification_status=None) for _ in range(205)]
    rows += [dict(conversation_id=target, role='assistant', verification_status=status)
             for status in ('CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT')]
    rows += [dict(conversation_id=target, role=role, verification_status=None)
             for role in ('user', 'tool', 'system')]
    rows += [dict(conversation_id=other, role='assistant', verification_status='CORRECT')]
    with engine.begin() as connection:
        connection.execute(messages.insert(), rows)
        session = AsyncMock()
        session.execute.side_effect = lambda statement: connection.execute(statement)
        result = await ConversationRepository(session).answer_review_counts([target, empty])
        assert set(result) == {target}
        assert result[target].model_dump() == dict(
            total=208, correct=1, partially_correct=1, incorrect=1, unreviewed=205,
        )
        session.execute.assert_awaited_once()
    engine.dispose()


@pytest.mark.asyncio
async def test_empty_conversation_list_does_not_query_messages():
    session = AsyncMock()
    assert await ConversationRepository(session).answer_review_counts([]) == {}
    session.execute.assert_not_awaited()
