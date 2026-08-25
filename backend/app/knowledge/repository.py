from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.knowledge.models import KnowledgeAnnotation, KnowledgeBase, KnowledgeDocument, KnowledgeVersion


class KnowledgeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add_base(self, item: KnowledgeBase) -> None:
        self.session.add(item)

    def add_version(self, item: KnowledgeVersion) -> None:
        self.session.add(item)

    def add_document(self, item: KnowledgeDocument) -> None:
        self.session.add(item)

    def add_annotation(self, item: KnowledgeAnnotation) -> None:
        self.session.add(item)

    async def get_base_for_source(
        self, data_source_id: uuid.UUID, organization_id: uuid.UUID
    ) -> KnowledgeBase | None:
        result = await self.session.execute(
            select(KnowledgeBase).where(
                KnowledgeBase.data_source_id == data_source_id,
                KnowledgeBase.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def lock_base(self, knowledge_base_id: uuid.UUID) -> KnowledgeBase | None:
        result = await self.session.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == knowledge_base_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def get_base_for_org(
        self, knowledge_base_id: uuid.UUID, organization_id: uuid.UUID
    ) -> KnowledgeBase | None:
        result = await self.session.execute(
            select(KnowledgeBase).where(
                KnowledgeBase.id == knowledge_base_id,
                KnowledgeBase.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def next_version_number(self, knowledge_base_id: uuid.UUID) -> int:
        value = await self.session.scalar(
            select(func.coalesce(func.max(KnowledgeVersion.version_number), 0)).where(
                KnowledgeVersion.knowledge_base_id == knowledge_base_id
            )
        )
        return int(value or 0) + 1

    async def get_version(self, version_id: uuid.UUID) -> KnowledgeVersion | None:
        return await self.session.get(KnowledgeVersion, version_id)

    async def list_versions(self, knowledge_base_id: uuid.UUID, limit: int = 50) -> list[KnowledgeVersion]:
        result = await self.session.execute(
            select(KnowledgeVersion)
            .where(KnowledgeVersion.knowledge_base_id == knowledge_base_id)
            .order_by(KnowledgeVersion.version_number.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_document(
        self, version_id: uuid.UUID, document_type: str, document_key: str
    ) -> KnowledgeDocument | None:
        result = await self.session.execute(
            select(KnowledgeDocument).where(
                KnowledgeDocument.knowledge_version_id == version_id,
                KnowledgeDocument.document_type == document_type,
                KnowledgeDocument.document_key == document_key,
            )
        )
        return result.scalar_one_or_none()

    async def get_document_by_id_for_base(
        self, document_id: uuid.UUID, knowledge_base_id: uuid.UUID
    ) -> KnowledgeDocument | None:
        result = await self.session.execute(
            select(KnowledgeDocument)
            .join(KnowledgeVersion, KnowledgeVersion.id == KnowledgeDocument.knowledge_version_id)
            .where(
                KnowledgeDocument.id == document_id,
                KnowledgeVersion.knowledge_base_id == knowledge_base_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_documents(
        self, version_id: uuid.UUID, *, document_type: str | None = None, limit: int = 500
    ) -> list[KnowledgeDocument]:
        statement = select(KnowledgeDocument).where(KnowledgeDocument.knowledge_version_id == version_id)
        if document_type is not None:
            statement = statement.where(KnowledgeDocument.document_type == document_type)
        result = await self.session.execute(
            statement.order_by(KnowledgeDocument.document_type, KnowledgeDocument.document_key).limit(limit)
        )
        return list(result.scalars().all())

    async def get_annotation_for_org(
        self, annotation_id: uuid.UUID, organization_id: uuid.UUID
    ) -> KnowledgeAnnotation | None:
        result = await self.session.execute(
            select(KnowledgeAnnotation)
            .join(KnowledgeBase, KnowledgeBase.id == KnowledgeAnnotation.knowledge_base_id)
            .where(
                KnowledgeAnnotation.id == annotation_id,
                KnowledgeBase.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_annotations(
        self,
        knowledge_base_id: uuid.UUID,
        *,
        scope_type: str | None = None,
        scope_key: str | None = None,
    ) -> list[KnowledgeAnnotation]:
        statement = select(KnowledgeAnnotation).where(
            KnowledgeAnnotation.knowledge_base_id == knowledge_base_id
        )
        if scope_type is not None:
            statement = statement.where(KnowledgeAnnotation.scope_type == scope_type)
        if scope_key is not None:
            statement = statement.where(KnowledgeAnnotation.scope_key == scope_key)
        result = await self.session.execute(statement.order_by(KnowledgeAnnotation.created_at.asc()))
        return list(result.scalars().all())
