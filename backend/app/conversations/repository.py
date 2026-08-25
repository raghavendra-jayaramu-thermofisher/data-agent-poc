from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.models import Conversation, ConversationDataSource, Message


class ConversationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add_conversation(self, item: Conversation) -> None:
        self.session.add(item)

    def add_source(self, item: ConversationDataSource) -> None:
        self.session.add(item)

    def add_message(self, item: Message) -> None:
        self.session.add(item)

    async def get_for_org(
        self, conversation_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Conversation | None:
        result = await self.session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def lock_for_org(
        self, conversation_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Conversation | None:
        result = await self.session.execute(
            select(Conversation)
            .where(
                Conversation.id == conversation_id,
                Conversation.organization_id == organization_id,
            )
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def list_for_org(self, organization_id: uuid.UUID, limit: int = 100) -> list[Conversation]:
        result = await self.session.execute(
            select(Conversation)
            .where(Conversation.organization_id == organization_id)
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def source_ids(self, conversation_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.session.execute(
            select(ConversationDataSource.data_source_id)
            .where(ConversationDataSource.conversation_id == conversation_id)
            .order_by(ConversationDataSource.data_source_id)
        )
        return list(result.scalars().all())

    async def list_messages(
        self, conversation_id: uuid.UUID, *, limit: int = 200
    ) -> list[Message]:
        # Keep chronological ordering for the UI/agent. The backend bounds history sent to the model separately.
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def recent_messages(self, conversation_id: uuid.UUID, limit: int) -> list[Message]:
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        rows.reverse()
        return rows

    async def message_for_job(self, job_id: uuid.UUID, role: str) -> Message | None:
        result = await self.session.execute(
            select(Message).where(Message.job_id == job_id, Message.role == role)
        )
        return result.scalar_one_or_none()
