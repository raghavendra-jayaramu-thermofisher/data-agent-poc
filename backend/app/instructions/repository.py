from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.instructions.models import AgentInstruction


class InstructionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, item: AgentInstruction) -> None:
        self.session.add(item)

    async def get(
        self, instruction_id: uuid.UUID, organization_id: uuid.UUID
    ) -> AgentInstruction | None:
        result = await self.session.execute(
            select(AgentInstruction).where(
                AgentInstruction.id == instruction_id,
                AgentInstruction.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_org(self, organization_id: uuid.UUID) -> list[AgentInstruction]:
        result = await self.session.execute(
            select(AgentInstruction)
            .where(AgentInstruction.organization_id == organization_id)
            .order_by(AgentInstruction.is_default.desc(), AgentInstruction.name.asc())
        )
        return list(result.scalars().all())

    async def get_default(self, organization_id: uuid.UUID) -> AgentInstruction | None:
        result = await self.session.execute(
            select(AgentInstruction).where(
                AgentInstruction.organization_id == organization_id,
                AgentInstruction.is_default.is_(True),
                AgentInstruction.enabled.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_command(
        self, organization_id: uuid.UUID, command: str
    ) -> AgentInstruction | None:
        result = await self.session.execute(
            select(AgentInstruction).where(
                AgentInstruction.organization_id == organization_id,
                AgentInstruction.command == command,
            )
        )
        return result.scalar_one_or_none()

    async def find_by_name(
        self, organization_id: uuid.UUID, name: str
    ) -> AgentInstruction | None:
        result = await self.session.execute(
            select(AgentInstruction).where(
                AgentInstruction.organization_id == organization_id,
                AgentInstruction.name == name,
            )
        )
        return result.scalar_one_or_none()

    async def clear_default(
        self, organization_id: uuid.UUID, exclude_id: uuid.UUID | None = None
    ) -> None:
        query = (
            update(AgentInstruction)
            .where(
                AgentInstruction.organization_id == organization_id,
                AgentInstruction.is_default.is_(True),
            )
            .values(is_default=False)
        )
        if exclude_id is not None:
            query = query.where(AgentInstruction.id != exclude_id)
        await self.session.execute(query)

    async def delete(self, item: AgentInstruction) -> None:
        await self.session.delete(item)
