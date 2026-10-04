from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.models import TimestampMixin


from app.secrets.models import EncryptedSecret
class DataSource(TimestampMixin, Base):
    __tablename__ = "data_sources"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','preparing','active','error','disabled')",
            name="valid_status",
        ),
        Index("ix_data_sources_org_created", "organization_id", "created_at"),
        Index("ix_data_sources_org_status", "organization_id", "status"),
        UniqueConstraint("organization_id", "name", name="uq_data_sources_org_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    # Deliberately not a PostgreSQL enum/check: datasource kinds must remain adapter-extensible.
    kind: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    # User-facing origin. Excel materializes to kind=duckdb while display_type=excel.
    display_type: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    config: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    secret_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encrypted_secrets.id", ondelete="SET NULL"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_connection_diagnostics: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)


class DataSourceFile(TimestampMixin, Base):
    __tablename__ = "data_source_files"
    __table_args__ = (
        CheckConstraint(
            "status IN ('uploaded','materializing','ready','error','superseded')",
            name="valid_status",
        ),
        Index("ix_data_source_files_datasource_created", "data_source_id", "created_at"),
        Index(
            "uq_data_source_files_one_active",
            "data_source_id",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data_source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_path: Mapped[str] = mapped_column(Text, nullable=False)
    materialized_database_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="uploaded")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sheet_mapping: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
