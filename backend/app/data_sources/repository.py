from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.data_sources.models import DataSource, DataSourceFile
from app.secrets.models import EncryptedSecret


class DataSourceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, data_source: DataSource) -> None:
        self.session.add(data_source)

    def add_file(self, file: DataSourceFile) -> None:
        self.session.add(file)

    async def get_for_org(
        self, data_source_id: uuid.UUID, organization_id: uuid.UUID
    ) -> DataSource | None:
        result = await self.session.execute(
            select(DataSource).where(
                DataSource.id == data_source_id,
                DataSource.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def lock_for_org(
        self, data_source_id: uuid.UUID, organization_id: uuid.UUID
    ) -> DataSource | None:
        result = await self.session.execute(
            select(DataSource)
            .where(
                DataSource.id == data_source_id,
                DataSource.organization_id == organization_id,
            )
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def list_for_org(self, organization_id: uuid.UUID) -> list[DataSource]:
        result = await self.session.execute(
            select(DataSource)
            .where(DataSource.organization_id == organization_id)
            .order_by(DataSource.created_at.desc())
        )
        return list(result.scalars().all())

    async def find_by_name(
        self, organization_id: uuid.UUID, name: str
    ) -> DataSource | None:
        result = await self.session.execute(
            select(DataSource).where(
                DataSource.organization_id == organization_id,
                DataSource.name == name,
            )
        )
        return result.scalar_one_or_none()

    async def get_file(self, file_id: uuid.UUID) -> DataSourceFile | None:
        return await self.session.get(DataSourceFile, file_id)

    async def get_file_for_org(
        self, file_id: uuid.UUID, organization_id: uuid.UUID
    ) -> tuple[DataSourceFile, DataSource] | None:
        result = await self.session.execute(
            select(DataSourceFile, DataSource)
            .join(DataSource, DataSource.id == DataSourceFile.data_source_id)
            .where(
                DataSourceFile.id == file_id,
                DataSource.organization_id == organization_id,
            )
        )
        row = result.first()
        return None if row is None else (row[0], row[1])

    async def active_file(self, data_source_id: uuid.UUID) -> DataSourceFile | None:
        result = await self.session.execute(
            select(DataSourceFile).where(
                DataSourceFile.data_source_id == data_source_id,
                DataSourceFile.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def list_files(self, data_source_id: uuid.UUID) -> list[DataSourceFile]:
        result = await self.session.execute(
            select(DataSourceFile)
            .where(DataSourceFile.data_source_id == data_source_id)
            .order_by(DataSourceFile.created_at.desc())
        )
        return list(result.scalars().all())

    async def activate_file(self, data_source_id: uuid.UUID, file_id: uuid.UUID) -> None:
        await self.session.execute(
            update(DataSourceFile)
            .where(
                DataSourceFile.data_source_id == data_source_id,
                DataSourceFile.is_active.is_(True),
                DataSourceFile.id != file_id,
            )
            .values(is_active=False, status="superseded")
        )
        file = await self.get_file(file_id)
        if file is not None:
            file.is_active = True
            file.status = "ready"

    async def delete_data_source(self, data_source: DataSource) -> None:
        await self.session.delete(data_source)

    async def delete_secret_if_unreferenced(self, secret_id: uuid.UUID | None) -> None:
        if secret_id is None:
            return
        count = await self.session.scalar(
            select(DataSource.id).where(DataSource.secret_id == secret_id).limit(1)
        )
        if count is None:
            secret = await self.session.get(EncryptedSecret, secret_id)
            if secret is not None:
                await self.session.delete(secret)
