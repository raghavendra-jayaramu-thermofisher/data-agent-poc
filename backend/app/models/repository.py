from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ModelConnection, ModelProfile


class ModelRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add_connection(self, item: ModelConnection) -> None:
        self.session.add(item)

    def add_profile(self, item: ModelProfile) -> None:
        self.session.add(item)

    async def list_connections(self, organization_id: uuid.UUID) -> list[ModelConnection]:
        result = await self.session.execute(
            select(ModelConnection)
            .where(ModelConnection.organization_id == organization_id)
            .order_by(ModelConnection.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_connection(self, connection_id: uuid.UUID, organization_id: uuid.UUID) -> ModelConnection | None:
        result = await self.session.execute(
            select(ModelConnection).where(
                ModelConnection.id == connection_id,
                ModelConnection.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def find_connection_name(self, organization_id: uuid.UUID, name: str) -> ModelConnection | None:
        result = await self.session.execute(
            select(ModelConnection).where(
                ModelConnection.organization_id == organization_id,
                ModelConnection.name == name,
            )
        )
        return result.scalar_one_or_none()

    async def list_profiles(self, organization_id: uuid.UUID) -> list[ModelProfile]:
        result = await self.session.execute(
            select(ModelProfile)
            .where(ModelProfile.organization_id == organization_id)
            .order_by(ModelProfile.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_profile(self, profile_id: uuid.UUID, organization_id: uuid.UUID) -> ModelProfile | None:
        result = await self.session.execute(
            select(ModelProfile).where(
                ModelProfile.id == profile_id,
                ModelProfile.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def find_profile_name(self, organization_id: uuid.UUID, display_name: str) -> ModelProfile | None:
        result = await self.session.execute(
            select(ModelProfile).where(
                ModelProfile.organization_id == organization_id,
                ModelProfile.display_name == display_name,
            )
        )
        return result.scalar_one_or_none()

    async def current_default(self, organization_id: uuid.UUID) -> ModelProfile | None:
        result = await self.session.execute(
            select(ModelProfile).where(
                ModelProfile.organization_id == organization_id,
                ModelProfile.is_default.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def clear_default(self, organization_id: uuid.UUID) -> None:
        await self.session.execute(
            update(ModelProfile)
            .where(ModelProfile.organization_id == organization_id, ModelProfile.is_default.is_(True))
            .values(is_default=False)
        )

    async def enabled_profiles_excluding(
        self, organization_id: uuid.UUID, excluded_profile_id: uuid.UUID | None = None
    ) -> list[ModelProfile]:
        statement = (
            select(ModelProfile)
            .join(ModelConnection, ModelConnection.id == ModelProfile.connection_id)
            .where(
                ModelProfile.organization_id == organization_id,
                ModelProfile.enabled.is_(True),
                ModelConnection.status != "disabled",
            )
            .order_by(ModelProfile.created_at.asc())
        )
        if excluded_profile_id is not None:
            statement = statement.where(ModelProfile.id != excluded_profile_id)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def profiles_for_connection(self, connection_id: uuid.UUID) -> list[ModelProfile]:
        result = await self.session.execute(
            select(ModelProfile).where(ModelProfile.connection_id == connection_id)
        )
        return list(result.scalars().all())
