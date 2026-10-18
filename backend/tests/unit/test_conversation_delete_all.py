import uuid
from unittest.mock import AsyncMock

import pytest

from app.conversations.service import ConversationService
from app.core.config import Settings


@pytest.mark.asyncio
async def test_delete_all_deletes_all_conversations_for_organization():
    session = AsyncMock()
    service = ConversationService(session, Settings())
    organization_id = uuid.uuid4()
    service.repo.delete_all_for_org = AsyncMock(return_value=5)

    count = await service.delete_all(organization_id)

    service.repo.delete_all_for_org.assert_awaited_once_with(organization_id)
    session.commit.assert_awaited_once()
    assert count == 5
