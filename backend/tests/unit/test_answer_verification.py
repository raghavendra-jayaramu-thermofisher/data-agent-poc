import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from pydantic import ValidationError
from app.conversations.schemas import MessageVerificationUpdate
from app.conversations.service import ConversationService
from app.core.config import Settings
from app.core.errors import AppError

@pytest.mark.parametrize('payload', [
    {'verification_status': 'PARTIALLY_CORRECT', 'verification_summary': 'Review'},
    {'verification_status': 'PARTIALLY_CORRECT', 'verification_summary': 'Review', 'verification_percentage': 100},
    {'verification_status': 'CORRECT', 'verification_summary': '  '},
    {'verification_status': 'CORRECT', 'verification_summary': 'Review', 'verification_percentage': 80},
    {'verification_status': 'UNKNOWN', 'verification_summary': 'Review'},
    {'verification_status': None, 'verification_summary': 'Review'},
    {'verification_status': 'PARTIALLY_CORRECT', 'verification_summary': 'Review', 'verification_percentage': 80.5},
])
def test_invalid_reviews(payload):
    with pytest.raises(ValidationError): MessageVerificationUpdate(**payload)

@pytest.mark.asyncio
async def test_save_update_and_clear():
    session = AsyncMock()
    service = ConversationService(session, Settings())
    conversation = uuid.uuid4()
    item = SimpleNamespace(conversation_id=conversation, role='assistant', content='Original answer')
    session.get.return_value = item
    service.require_for_org = AsyncMock()
    user = SimpleNamespace(id=uuid.uuid4(), display_name='Reviewer')
    for status, percentage in [('PARTIALLY_CORRECT',80), ('CORRECT',None), (None,None)]:
        payload = MessageVerificationUpdate(verification_status=status, verification_summary='  Checked data  ' if status else None, verification_percentage=percentage)
        await service.verify_message(conversation, uuid.uuid4(), uuid.uuid4(), user, 'admin', payload)
        assert item.verification_status == status
        assert item.verification_percentage == percentage
        assert item.verified_by == (user.id if status else None)
        assert bool(item.verified_at) == bool(status)
        assert item.content == 'Original answer'
    assert session.commit.await_count == 3

@pytest.mark.asyncio
@pytest.mark.parametrize('role,message_role,same_conversation,code', [('member','assistant',True,403),('admin','user',True,422),('owner','assistant',False,404)])
async def test_permissions_and_target(role,message_role,same_conversation,code):
    session = AsyncMock(); service = ConversationService(session, Settings())
    conversation = uuid.uuid4()
    session.get.return_value = SimpleNamespace(conversation_id=conversation if same_conversation else uuid.uuid4(), role=message_role)
    service.require_for_org = AsyncMock()
    with pytest.raises(AppError) as error:
        await service.verify_message(conversation, uuid.uuid4(), uuid.uuid4(), SimpleNamespace(id=uuid.uuid4(),display_name='Reviewer'), role, MessageVerificationUpdate(verification_status='CORRECT', verification_summary='Checked'))
    assert error.value.status_code == code
    session.commit.assert_not_awaited()
