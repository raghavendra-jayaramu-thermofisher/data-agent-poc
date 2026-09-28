from __future__ import annotations

import re
import uuid

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.models import Conversation, ConversationDataSource, Message
from app.conversations.repository import ConversationRepository
from app.conversations.schemas import ConversationCreate, ConversationResponse, MessageCreate
from app.core.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.data_sources.service import DataSourceService
from app.instructions.repository import InstructionRepository
from app.jobs.service import JobService
from app.models.service import ModelConfigurationService


class ConversationService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        *,
        redis: Redis | None = None,
    ) -> None:
        self.session = session
        self.settings = settings
        self.redis = redis
        self.repo = ConversationRepository(session)

    async def create(
        self,
        *,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: ConversationCreate,
    ) -> Conversation:
        source_service = DataSourceService(self.session, self.settings)
        for source_id in payload.data_source_ids:
            source = await source_service.require_for_org(source_id, organization_id)
            if source.status != "active":
                raise AppError(
                    "DATASOURCE_NOT_ACTIVE",
                    "All conversation datasources must be active.",
                    409,
                )

        if payload.model_profile_id is not None:
            profile = await ModelConfigurationService(self.session, self.settings).require_profile(
                payload.model_profile_id, organization_id
            )
            if not profile.enabled:
                raise AppError("MODEL_PROFILE_DISABLED", "Model profile is disabled.", 409)

        conversation = Conversation(
            organization_id=organization_id,
            title=payload.title,
            created_by=user_id,
            model_profile_id=payload.model_profile_id,
        )
        self.repo.add_conversation(conversation)
        await self.session.flush()
        for source_id in payload.data_source_ids:
            self.repo.add_source(
                ConversationDataSource(
                    conversation_id=conversation.id,
                    data_source_id=source_id,
                )
            )
        await self.session.commit()
        return conversation

    async def require_for_org(
        self, conversation_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Conversation:
        item = await self.repo.get_for_org(conversation_id, organization_id)
        if item is None:
            raise AppError("CONVERSATION_NOT_FOUND", "Conversation not found.", 404)
        return item

    async def to_response(self, item: Conversation) -> ConversationResponse:
        response = ConversationResponse.model_validate(item)
        response.data_source_ids = await self.repo.source_ids(item.id)
        return response

    async def list_for_org(self, organization_id: uuid.UUID) -> list[Conversation]:
        return await self.repo.list_for_org(organization_id)

    async def delete(self, conversation_id: uuid.UUID, organization_id: uuid.UUID) -> None:
        item = await self.require_for_org(conversation_id, organization_id)
        await self.session.delete(item)
        await self.session.commit()

    async def resolve_model_profile_id(
        self,
        *,
        conversation: Conversation,
        organization_id: uuid.UUID,
        override_profile_id: uuid.UUID | None,
    ) -> uuid.UUID:
        model_service = ModelConfigurationService(self.session, self.settings)
        requested = override_profile_id or conversation.model_profile_id
        if requested is not None:
            profile = await model_service.require_profile(requested, organization_id)
            if not profile.enabled:
                raise AppError("MODEL_PROFILE_DISABLED", "Model profile is disabled.", 409)
            return profile.id
        default = await model_service.get_default(organization_id)
        if default is None or not default.enabled:
            raise AppError(
                "MODEL_PROFILE_REQUIRED",
                "Configure an enabled default model before asking a question.",
                409,
            )
        return default.id

    async def submit_message(
        self,
        *,
        conversation_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: MessageCreate,
    ) -> tuple[Message, uuid.UUID]:
        if self.redis is None:
            raise RuntimeError("Redis is required to submit analytical messages")
        conversation = await self.require_for_org(conversation_id, organization_id)
        source_ids = await self.repo.source_ids(conversation.id)
        if not source_ids:
            raise AppError(
                "CONVERSATION_DATASOURCE_REQUIRED",
                "The conversation has no datasource.",
                409,
            )
        profile_id = await self.resolve_model_profile_id(
            conversation=conversation,
            organization_id=organization_id,
            override_profile_id=payload.model_profile_id,
        )

        # User message and job are both durable. The job contains only identifiers/content and
        # never credentials. JobService performs the queue publish after PostgreSQL commit.
        metadata: dict[str, object] = {"model_profile_id": str(profile_id)}
        content = payload.content.strip()
        match = re.match(r"^/([a-zA-Z0-9_-]+)(?:\s+(.*))?$", content, re.DOTALL)
        if match:
            cmd = match.group(1).lower()
            extra_prompt = (match.group(2) or "").strip()
            instruction = await InstructionRepository(self.session).get_by_command(
                organization_id, cmd
            )
            if instruction and instruction.enabled:
                metadata["instruction_id"] = str(instruction.id)
                metadata["command"] = instruction.command
                metadata["raw_prompt"] = payload.content
                if instruction.prompt_template:
                    if "{prompt}" in instruction.prompt_template:
                        expanded = instruction.prompt_template.replace("{prompt}", extra_prompt).strip()
                    else:
                        expanded = (
                            f"{instruction.prompt_template}\n\n{extra_prompt}".strip()
                            if extra_prompt
                            else instruction.prompt_template.strip()
                        )
                else:
                    expanded = extra_prompt if extra_prompt else (instruction.description or payload.content)
                metadata["expanded_prompt"] = expanded

        message = Message(
            conversation_id=conversation.id,
            role="user",
            content=payload.content,
            metadata_json=metadata,
            created_at=utc_now(),
        )
        self.repo.add_message(message)
        if conversation.title is None:
            compact = " ".join(payload.content.split())
            conversation.title = compact[:237] + "..." if len(compact) > 240 else compact
        await self.session.flush()

        job = await JobService(self.session, self.redis, self.settings).create_job(
            organization_id=organization_id,
            requested_by=user_id,
            job_type="chat_query",
            input_data={
                "conversation_id": str(conversation.id),
                "user_message_id": str(message.id),
                "model_profile_id": str(profile_id),
            },
            conversation_id=conversation.id,
            # LLM/query mistakes are corrected inside the bounded agent loop; only the generic
            # worker retry path should handle true infrastructure failures.
            max_attempts=self.settings.job_max_attempts,
        )
        message.job_id = job.id
        await self.session.commit()
        return message, job.id
