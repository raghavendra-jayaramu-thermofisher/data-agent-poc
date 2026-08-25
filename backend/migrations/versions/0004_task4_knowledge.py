"""Task 4: versioned datasource knowledge and business annotations.

Revision ID: 0004_task4_knowledge
Revises: 0003_task3
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_task4_knowledge"
down_revision = "0003_task3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_bases",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("data_source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="empty", nullable=False),
        sa.Column("current_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_error_code", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('empty','generating','ready','error')", name="ck_knowledge_bases_valid_status"),
        sa.ForeignKeyConstraint(["data_source_id"], ["data_sources.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("data_source_id", name="uq_knowledge_bases_data_source"),
    )
    op.create_index("ix_knowledge_bases_org_status", "knowledge_bases", ["organization_id", "status"])

    op.create_table(
        "knowledge_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("knowledge_base_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("schema_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("generated_by_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["generated_by_job_id"], ["jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["knowledge_base_id"], ["knowledge_bases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("knowledge_base_id", "version_number", name="uq_knowledge_versions_number"),
    )
    op.create_index(
        "ix_knowledge_versions_base_created", "knowledge_versions", ["knowledge_base_id", "created_at"]
    )
    op.create_index(
        "ix_knowledge_versions_fingerprint", "knowledge_versions", ["knowledge_base_id", "schema_fingerprint"]
    )
    op.create_foreign_key(
        "fk_knowledge_bases_current_version",
        "knowledge_bases",
        "knowledge_versions",
        ["current_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "knowledge_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("knowledge_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_type", sa.String(length=30), nullable=False),
        sa.Column("document_key", sa.String(length=600), nullable=False),
        sa.Column("title", sa.String(length=600), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("estimated_tokens", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("document_type IN ('index','table_schema')", name="ck_knowledge_documents_valid_type"),
        sa.ForeignKeyConstraint(["knowledge_version_id"], ["knowledge_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "knowledge_version_id", "document_type", "document_key", name="uq_knowledge_documents_key"
        ),
    )
    op.create_index(
        "ix_knowledge_documents_version_type", "knowledge_documents", ["knowledge_version_id", "document_type"]
    )

    op.create_table(
        "knowledge_annotations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("knowledge_base_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scope_type", sa.String(length=30), nullable=False),
        sa.Column("scope_key", sa.String(length=600), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "scope_type IN ('datasource','table','column','metric')", name="ck_knowledge_annotations_valid_scope"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["knowledge_base_id"], ["knowledge_bases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_knowledge_annotations_base_scope",
        "knowledge_annotations",
        ["knowledge_base_id", "scope_type", "scope_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_knowledge_annotations_base_scope", table_name="knowledge_annotations")
    op.drop_table("knowledge_annotations")
    op.drop_index("ix_knowledge_documents_version_type", table_name="knowledge_documents")
    op.drop_table("knowledge_documents")
    op.drop_constraint("fk_knowledge_bases_current_version", "knowledge_bases", type_="foreignkey")
    op.drop_index("ix_knowledge_versions_fingerprint", table_name="knowledge_versions")
    op.drop_index("ix_knowledge_versions_base_created", table_name="knowledge_versions")
    op.drop_table("knowledge_versions")
    op.drop_index("ix_knowledge_bases_org_status", table_name="knowledge_bases")
    op.drop_table("knowledge_bases")
