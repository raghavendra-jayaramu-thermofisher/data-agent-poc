"""Conversation table scope: the tables the agent starts with, not a restriction."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.knowledge.models import KnowledgeDocument
from app.knowledge.repository import KnowledgeRepository


class TableIdentifier(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    schema_name: str | None = Field(default=None, alias="schema", max_length=600)
    name: str = Field(min_length=1, max_length=600)


class SourceTableScope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data_source_id: uuid.UUID
    mode: Literal["all", "selected"] = "all"
    tables: list[TableIdentifier] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def validate_tables(self) -> SourceTableScope:
        if self.mode == "selected" and not self.tables:
            raise ValueError("Select at least one table in selected tables mode.")
        if self.mode == "all" and self.tables:
            raise ValueError("All tables mode cannot contain a selected table list.")
        identities = [(table.schema_name, table.name) for table in self.tables]
        if len(set(identities)) != len(identities):
            raise ValueError("Selected tables must not contain duplicates.")
        return self


async def resolve_table_scope(
    session: AsyncSession,
    organization_id: uuid.UUID,
    source_ids: list[uuid.UUID],
    requested: list[SourceTableScope],
) -> list[dict[str, object]]:
    """Drop selected tables missing from current knowledge; none left means all tables."""
    by_source = {item.data_source_id: item for item in requested}
    if len(by_source) != len(requested) or not set(by_source).issubset(source_ids):
        raise AppError(
            "TABLE_SCOPE_INVALID", "Table scope must use unique selected data sources.", 422
        )
    repo = KnowledgeRepository(session)
    result = []
    for source_id in source_ids:
        scope = by_source.get(source_id, SourceTableScope(data_source_id=source_id))
        if scope.mode == "selected":
            base = await repo.get_base_for_source(source_id, organization_id)
            if base is not None and base.status == "ready" and base.current_version_id is not None:
                docs = (
                    await session.execute(
                        select(KnowledgeDocument.metadata_json).where(
                            KnowledgeDocument.knowledge_version_id == base.current_version_id,
                            KnowledgeDocument.document_type == "table_schema",
                        )
                    )
                ).scalars().all()
                available = {(doc.get("schema"), doc.get("table")) for doc in docs}
                tables = [
                    table for table in scope.tables
                    if (table.schema_name, table.name) in available
                ]
                scope = (
                    scope.model_copy(update={"tables": tables})
                    if tables
                    else SourceTableScope(data_source_id=source_id)
                )
        result.append(scope.model_dump(mode="json", by_alias=True))
    return result
