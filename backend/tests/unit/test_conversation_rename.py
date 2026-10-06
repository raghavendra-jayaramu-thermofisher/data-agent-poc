import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.conversations.schemas import ConversationRename
from app.conversations.service import ConversationService
from app.core.config import Settings
from app.core.errors import AppError


@pytest.mark.parametrize("title", ["", "   ", None, "x" * 241])
def test_rename_requires_a_nonblank_bounded_title(title):
    with pytest.raises(ValidationError):
        ConversationRename(title=title)


def test_rename_accepts_a_trimmed_title_and_rejects_other_changes():
    assert ConversationRename(title="  Monthly analysis  ").title == "Monthly analysis"
    with pytest.raises(ValidationError):
        ConversationRename(title="Monthly analysis", model_profile_id=uuid.uuid4())


@pytest.mark.asyncio
async def test_rename_preserves_conversation_identity_and_model():
    session = AsyncMock()
    service = ConversationService(session, Settings())
    item = SimpleNamespace(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        title="Old title",
        model_profile_id=uuid.uuid4(),
        updated_at=None,
    )
    profile_id = item.model_profile_id
    service.repo.get_for_org = AsyncMock(return_value=item)

    result = await service.rename(
        item.id, item.organization_id, ConversationRename(title="New title")
    )

    service.repo.get_for_org.assert_awaited_once_with(item.id, item.organization_id)
    session.commit.assert_awaited_once()
    assert result is item
    assert item.title == "New title"
    assert item.model_profile_id == profile_id
    assert item.updated_at is not None


@pytest.mark.asyncio
async def test_rename_cannot_access_a_conversation_outside_the_workspace():
    session = AsyncMock()
    service = ConversationService(session, Settings())
    conversation_id, organization_id = uuid.uuid4(), uuid.uuid4()
    service.repo.get_for_org = AsyncMock(return_value=None)

    with pytest.raises(AppError) as caught:
        await service.rename(conversation_id, organization_id, ConversationRename(title="New"))

    assert caught.value.code == "CONVERSATION_NOT_FOUND"
    service.repo.get_for_org.assert_awaited_once_with(conversation_id, organization_id)
    session.commit.assert_not_awaited()
