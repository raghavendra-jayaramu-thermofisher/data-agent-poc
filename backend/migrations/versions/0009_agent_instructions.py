"""Create agent_instructions table for default instructions and slash commands.

Revision ID: 0009_agent_instructions
Revises: 0008_simple_html_artifact
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0009_agent_instructions"
down_revision: str | None = "0008_simple_html_artifact"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "agent_instructions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("command", sa.String(64), nullable=True),
        sa.Column("prompt_template", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("organization_id", "name", name="uq_agent_instructions_org_name"),
    )
    op.create_index(
        "ix_agent_instructions_org_enabled",
        "agent_instructions",
        ["organization_id", "enabled"],
    )
    op.create_index(
        "uq_agent_instructions_one_default_per_org",
        "agent_instructions",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
    )
    op.create_index(
        "uq_agent_instructions_command_per_org",
        "agent_instructions",
        ["organization_id", "command"],
        unique=True,
        postgresql_where=sa.text("command IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_table("agent_instructions")
