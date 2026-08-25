from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.models import TimestampMixin


class ModelConnection(TimestampMixin, Base):
    __tablename__ = "model_connections"
    __table_args__ = (
        CheckConstraint(
            "status IN ('untested','active','error','disabled')",
            name="valid_status",
        ),
        UniqueConstraint("organization_id", "name", name="uq_model_connections_org_name"),
        Index("ix_model_connections_org_status", "organization_id", "status"),
        Index("ix_model_connections_org_created", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    secret_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encrypted_secrets.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="untested", server_default="untested")
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )


class ModelProfile(TimestampMixin, Base):
    __tablename__ = "model_profiles"
    __table_args__ = (
        UniqueConstraint("organization_id", "display_name", name="uq_model_profiles_org_display_name"),
        Index("ix_model_profiles_org_enabled", "organization_id", "enabled"),
        Index("ix_model_profiles_connection", "connection_id"),
        Index(
            "uq_model_profiles_one_default_per_org",
            "organization_id",
            unique=True,
            postgresql_where=text("is_default = true"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("model_connections.id", ondelete="CASCADE"), nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(180), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    settings: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
