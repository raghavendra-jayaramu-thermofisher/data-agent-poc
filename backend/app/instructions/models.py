from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.models import TimestampMixin


class AgentInstruction(TimestampMixin, Base):
    __tablename__ = "agent_instructions"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "name", name="uq_agent_instructions_org_name"
        ),
        Index("ix_agent_instructions_org_enabled", "organization_id", "enabled"),
        Index(
            "uq_agent_instructions_one_default_per_org",
            "organization_id",
            unique=True,
            postgresql_where=text("is_default = true"),
        ),
        Index(
            "uq_agent_instructions_command_per_org",
            "organization_id",
            "command",
            unique=True,
            postgresql_where=text("command IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    command: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prompt_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
