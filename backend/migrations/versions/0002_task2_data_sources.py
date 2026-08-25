"""Task 2 datasource subsystem and encrypted local file metadata.

Revision ID: 0002_task2
Revises: 0001_task1
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_task2"
down_revision = "0001_task1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "encrypted_secrets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("purpose", sa.String(80), nullable=False),
        sa.Column("encrypted_payload", sa.LargeBinary(), nullable=False),
        sa.Column("key_version", sa.String(40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_encrypted_secrets_org_purpose",
        "encrypted_secrets",
        ["organization_id", "purpose"],
    )

    op.create_table(
        "data_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("kind", sa.String(80), nullable=False),
        sa.Column("display_type", sa.String(80), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
        sa.Column("secret_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_code", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["secret_id"], ["encrypted_secrets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('pending','preparing','active','error','disabled')",
            name="valid_status",
        ),
        sa.UniqueConstraint("organization_id", "name", name="uq_data_sources_org_name"),
    )
    op.create_index("ix_data_sources_kind", "data_sources", ["kind"])
    op.create_index(
        "ix_data_sources_org_created", "data_sources", ["organization_id", "created_at"]
    )
    op.create_index(
        "ix_data_sources_org_status", "data_sources", ["organization_id", "status"]
    )

    op.create_table(
        "data_source_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("data_source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("source_path", sa.Text(), nullable=False),
        sa.Column("materialized_database_path", sa.Text(), nullable=True),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="uploaded"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "sheet_mapping", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column("error_code", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["data_source_id"], ["data_sources.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "status IN ('uploaded','materializing','ready','error','superseded')",
            name="valid_status",
        ),
    )
    op.create_index(
        "ix_data_source_files_datasource_created",
        "data_source_files",
        ["data_source_id", "created_at"],
    )
    op.create_index(
        "uq_data_source_files_one_active",
        "data_source_files",
        ["data_source_id"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )


def downgrade() -> None:
    op.drop_table("data_source_files")
    op.drop_table("data_sources")
    op.drop_table("encrypted_secrets")
