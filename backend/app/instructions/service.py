from __future__ import annotations

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.instructions.models import AgentInstruction
from app.instructions.repository import InstructionRepository
from app.instructions.schemas import InstructionCreate, InstructionUpdate


class InstructionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = InstructionRepository(session)

    async def create_instruction(
        self,
        *,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: InstructionCreate,
    ) -> AgentInstruction:
        await self._ensure_name_available(organization_id, payload.name)
        if payload.command:
            await self._ensure_command_available(organization_id, payload.command)

        if payload.is_default and not payload.enabled:
            raise AppError(
                "INSTRUCTION_DEFAULT_DISABLED",
                "A disabled instruction cannot be set as the default.",
                400,
            )

        if payload.is_default:
            await self.repo.clear_default(organization_id)

        item = AgentInstruction(
            organization_id=organization_id,
            name=payload.name,
            description=payload.description,
            command=payload.command,
            prompt_template=payload.prompt_template,
            content=payload.content,
            is_default=payload.is_default,
            enabled=payload.enabled,
            created_by=user_id,
        )
        self.repo.add(item)
        await self._commit_safely(
            duplicate_code="INSTRUCTION_EXISTS",
            duplicate_message="An instruction with this name or command already exists.",
        )
        return item

    async def list_instructions(self, organization_id: uuid.UUID) -> list[AgentInstruction]:
        return await self.repo.list_for_org(organization_id)

    async def require_instruction(
        self, instruction_id: uuid.UUID, organization_id: uuid.UUID
    ) -> AgentInstruction:
        item = await self.repo.get(instruction_id, organization_id)
        if item is None:
            raise AppError("INSTRUCTION_NOT_FOUND", "Instruction not found.", 404)
        return item

    async def update_instruction(
        self,
        *,
        instruction_id: uuid.UUID,
        organization_id: uuid.UUID,
        payload: InstructionUpdate,
    ) -> AgentInstruction:
        item = await self.require_instruction(instruction_id, organization_id)

        if payload.name is not None and payload.name != item.name:
            await self._ensure_name_available(organization_id, payload.name, exclude_id=item.id)
            item.name = payload.name

        if payload.command is not None and payload.command != item.command:
            await self._ensure_command_available(
                organization_id, payload.command, exclude_id=item.id
            )
            item.command = payload.command
        elif payload.command is None and "command" in payload.model_fields_set:
            item.command = None

        if payload.description is not None:
            item.description = payload.description
        elif "description" in payload.model_fields_set:
            item.description = None

        if payload.prompt_template is not None:
            item.prompt_template = payload.prompt_template
        elif "prompt_template" in payload.model_fields_set:
            item.prompt_template = None

        if payload.content is not None:
            item.content = payload.content

        target_enabled = item.enabled if payload.enabled is None else payload.enabled
        target_default = item.is_default if payload.is_default is None else payload.is_default

        if target_default and not target_enabled:
            raise AppError(
                "INSTRUCTION_DEFAULT_DISABLED",
                "A disabled instruction cannot be set as the default.",
                400,
            )

        if payload.is_default is True and not item.is_default:
            await self.repo.clear_default(organization_id, exclude_id=item.id)
            item.is_default = True
        elif payload.is_default is False:
            item.is_default = False

        if payload.enabled is not None:
            item.enabled = payload.enabled

        await self._commit_safely(
            duplicate_code="INSTRUCTION_EXISTS",
            duplicate_message="An instruction with this name or command already exists.",
        )
        return item

    async def delete_instruction(
        self, *, instruction_id: uuid.UUID, organization_id: uuid.UUID
    ) -> None:
        item = await self.require_instruction(instruction_id, organization_id)
        await self.repo.delete(item)
        await self.session.commit()

    async def get_default(self, organization_id: uuid.UUID) -> AgentInstruction | None:
        return await self.repo.get_default(organization_id)

    async def get_by_command(
        self, organization_id: uuid.UUID, command: str
    ) -> AgentInstruction | None:
        return await self.repo.get_by_command(organization_id, command)

    async def _ensure_name_available(
        self, organization_id: uuid.UUID, name: str, exclude_id: uuid.UUID | None = None
    ) -> None:
        existing = await self.repo.find_by_name(organization_id, name)
        if existing is not None and existing.id != exclude_id:
            raise AppError(
                "INSTRUCTION_NAME_EXISTS",
                "An instruction with this name already exists.",
                409,
            )

    async def _ensure_command_available(
        self, organization_id: uuid.UUID, command: str, exclude_id: uuid.UUID | None = None
    ) -> None:
        existing = await self.repo.get_by_command(organization_id, command)
        if existing is not None and existing.id != exclude_id:
            raise AppError(
                "INSTRUCTION_COMMAND_EXISTS",
                f"An instruction with the slash command '/{command}' already exists.",
                409,
            )

    async def _commit_safely(self, duplicate_code: str, duplicate_message: str) -> None:
        try:
            await self.session.commit()
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise AppError(duplicate_code, duplicate_message, 409) from exc
