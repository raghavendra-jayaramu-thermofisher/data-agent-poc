"""Lightweight, versioned table catalog from stored schema knowledge."""

from __future__ import annotations

import uuid

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.table_scope import TableIdentifier
from app.core.errors import AppError
from app.knowledge.models import KnowledgeDocument
from app.knowledge.repository import KnowledgeRepository


class TableCatalogItem(TableIdentifier):
    object_type: str
    column_count: int


class TableCatalogResponse(BaseModel):
    knowledge_version_id: uuid.UUID
    items: list[TableCatalogItem]
    next_cursor: str | None


async def table_catalog(
    session: AsyncSession,
    organization_id: uuid.UUID,
    source_id: uuid.UUID,
    *,
    search: str,
    cursor: str | None,
    limit: int,
    version_id: uuid.UUID | None,
) -> TableCatalogResponse:
    base = await KnowledgeRepository(session).get_base_for_source(source_id, organization_id)
    if base is None or base.status != "ready" or base.current_version_id is None:
        raise AppError(
            "KNOWLEDGE_NOT_READY",
            "Schema knowledge is not ready. Generate it in Data sources.",
            409,
        )
    if version_id is not None and version_id != base.current_version_id:
        raise AppError(
            "TABLE_CATALOG_CHANGED", "Schema knowledge changed. Refresh the table list.", 409
        )
    statement = select(KnowledgeDocument.document_key, KnowledgeDocument.metadata_json).where(
        KnowledgeDocument.knowledge_version_id == base.current_version_id,
        KnowledgeDocument.document_type == "table_schema",
    )
    if search.strip():
        # Escape SQL LIKE wildcards: the search is literal text.
        literal = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        statement = statement.where(
            KnowledgeDocument.document_key.ilike(f"%{literal}%", escape="\\")
        )
    if cursor is not None:
        statement = statement.where(KnowledgeDocument.document_key > cursor)
    rows = (
        await session.execute(statement.order_by(KnowledgeDocument.document_key).limit(limit + 1))
    ).all()
    items = [
        TableCatalogItem(
            schema=metadata.get("schema"),
            name=metadata["table"],
            object_type=metadata.get("object_type", "table"),
            column_count=metadata.get("column_count", 0),
        )
        for _, metadata in rows[:limit]
    ]
    return TableCatalogResponse(
        knowledge_version_id=base.current_version_id,
        items=items,
        next_cursor=rows[limit - 1][0] if len(rows) > limit else None,
    )
