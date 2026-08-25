"""Task 3 organization-scoped OpenAI-compatible model configuration.

Revision ID: 0003_task3
Revises: 0002_task2
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_task3"
down_revision = "0002_task2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=False),
        sa.Column("secret_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="untested"),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_code", sa.String(100), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["secret_id"], ["encrypted_secrets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('untested','active','error','disabled')",
            name="valid_status",
        ),
        sa.UniqueConstraint("organization_id", "name", name="uq_model_connections_org_name"),
    )
    op.create_index(
        "ix_model_connections_org_status",
        "model_connections",
        ["organization_id", "status"],
    )
    op.create_index(
        "ix_model_connections_org_created",
        "model_connections",
        ["organization_id", "created_at"],
    )

    op.create_table(
        "model_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.String(180), nullable=False),
        sa.Column("model_name", sa.String(255), nullable=False),
        sa.Column(
            "settings",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["connection_id"], ["model_connections.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "organization_id",
            "display_name",
            name="uq_model_profiles_org_display_name",
        ),
    )
    op.create_index(
        "ix_model_profiles_org_enabled",
        "model_profiles",
        ["organization_id", "enabled"],
    )
    op.create_index(
        "ix_model_profiles_connection",
        "model_profiles",
        ["connection_id"],
    )
    op.create_index(
        "uq_model_profiles_one_default_per_org",
        "model_profiles",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
    )


def downgrade() -> None:
    op.drop_table("model_profiles")
    op.drop_table("model_connections")
