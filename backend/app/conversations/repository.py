from __future__ import annotations

import uuid

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.models import Conversation, ConversationDataSource, Message
from app.conversations.schemas import AnswerReviewCounts
from app.jobs.models import Job


class ConversationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add_conversation(self, item: Conversation) -> None:
        self.session.add(item)

    def add_source(self, item: ConversationDataSource) -> None:
        self.session.add(item)

    def add_message(self, item: Message) -> None:
        self.session.add(item)

    async def delete_all_for_org(self, organization_id: uuid.UUID) -> int:
        result = await self.session.execute(
            delete(Conversation).where(Conversation.organization_id == organization_id)
        )
        return result.rowcount

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

    async def answer_review_counts(
        self, conversation_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, AnswerReviewCounts]:
        if not conversation_ids:
            return {}
        result = await self.session.execute(
            select(
                Message.conversation_id,
                func.count().label("total"),
                func.count().filter(Message.verification_status == "CORRECT").label("correct"),
                func.count().filter(Message.verification_status == "PARTIALLY_CORRECT").label("partially_correct"),
                func.count().filter(Message.verification_status == "INCORRECT").label("incorrect"),
                func.count().filter(Message.verification_status.is_(None)).label("unreviewed"),
            )
            .where(Message.conversation_id.in_(conversation_ids), Message.role == "assistant")
            .group_by(Message.conversation_id)
        )
        return {
            row.conversation_id: AnswerReviewCounts(
                **{name: getattr(row, name) for name in AnswerReviewCounts.model_fields}
            )
            for row in result.all()
        }

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

    async def recent_messages(
        self, conversation_id: uuid.UUID, limit: int, *,
        through_job: Job | None = None, user_message_id: uuid.UUID | None = None,
    ) -> list[Message]:
        statement = select(Message).where(Message.conversation_id == conversation_id)
        if through_job is not None:
            # A queued question may predate the previous answer. Order by turn, and
            # include earlier answers while excluding all subsequently queued questions.
            statement = statement.outerjoin(Job, Message.job_id == Job.id).where(or_(
                Message.id == user_message_id,
                Message.job_id == through_job.id,
                Job.created_at < through_job.created_at,
                and_(Job.created_at == through_job.created_at, Job.id < through_job.id),
            )).order_by(func.coalesce(Job.created_at, Message.created_at).desc(),
                       func.coalesce(Job.id, Message.id).desc(), Message.created_at.desc())
        else:
            statement = statement.order_by(Message.created_at.desc())
        result = await self.session.execute(statement.limit(limit))
        rows = list(result.scalars().all())
        rows.reverse()
        return rows

    async def first_user_message(self, conversation_id: uuid.UUID) -> Message | None:
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id, Message.role == "user")
            .order_by(Message.created_at.asc(), Message.id.asc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def message_for_job(self, job_id: uuid.UUID, role: str) -> Message | None:
        result = await self.session.execute(
            select(Message).where(Message.job_id == job_id, Message.role == role)
        )
        return result.scalar_one_or_none()
