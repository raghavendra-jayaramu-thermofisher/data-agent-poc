from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.models import TimestampMixin


class KnowledgeBase(TimestampMixin, Base):
    __tablename__ = "knowledge_bases"
    __table_args__ = (
        CheckConstraint("status IN ('empty','generating','ready','error')", name="valid_status"),
        UniqueConstraint("data_source_id", name="uq_knowledge_bases_data_source"),
        Index("ix_knowledge_bases_org_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    data_source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="empty", server_default="empty")
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "knowledge_versions.id",
            name="fk_knowledge_bases_current_version",
            ondelete="SET NULL",
            use_alter=True,
        ),
        nullable=True,
    )
    last_error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)


class KnowledgeVersion(Base):
    __tablename__ = "knowledge_versions"
    __table_args__ = (
        UniqueConstraint("knowledge_base_id", "version_number", name="uq_knowledge_versions_number"),
        Index("ix_knowledge_versions_base_created", "knowledge_base_id", "created_at"),
        Index("ix_knowledge_versions_fingerprint", "knowledge_base_id", "schema_fingerprint"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    schema_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    generated_by_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"
    __table_args__ = (
        CheckConstraint("document_type IN ('index','table_schema')", name="valid_document_type"),
        UniqueConstraint(
            "knowledge_version_id", "document_type", "document_key", name="uq_knowledge_documents_key"
        ),
        Index("ix_knowledge_documents_version_type", "knowledge_version_id", "document_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    knowledge_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_versions.id", ondelete="CASCADE"), nullable=False
    )
    document_type: Mapped[str] = mapped_column(String(30), nullable=False)
    document_key: Mapped[str] = mapped_column(String(600), nullable=False)
    title: Mapped[str] = mapped_column(String(600), nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict[str, object]] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    estimated_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class KnowledgeAnnotation(TimestampMixin, Base):
    __tablename__ = "knowledge_annotations"
    __table_args__ = (
        CheckConstraint(
            "scope_type IN ('datasource','table','column','metric')", name="valid_scope_type"
        ),
        Index("ix_knowledge_annotations_base_scope", "knowledge_base_id", "scope_type", "scope_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False
    )
    scope_type: Mapped[str] = mapped_column(String(30), nullable=False)
    scope_key: Mapped[str | None] = mapped_column(String(600), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
