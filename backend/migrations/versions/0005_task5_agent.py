"""Task 5 conversations, execution audit and artifacts.

Revision ID: 0005_task5_agent
Revises: 0004_task4_knowledge
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_task5_agent"
down_revision: str | None = "0004_task4_knowledge"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["model_profile_id"], ["model_profiles.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_conversations_org_updated", "conversations", ["organization_id", "updated_at"])
    op.create_index("ix_conversations_created_by", "conversations", ["created_by", "updated_at"])

    op.add_column(
        "jobs",
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_jobs_conversation_id_conversations",
        "jobs",
        "conversations",
        ["conversation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_jobs_conversation_created",
        "jobs",
        ["conversation_id", "created_at"],
    )

    op.create_table(
        "conversation_data_sources",
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("data_source_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["data_source_id"], ["data_sources.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("conversation_id", "data_source_id", name="uq_conversation_data_sources_pair"),
    )
    op.create_index("ix_conversation_data_sources_source", "conversation_data_sources", ["data_source_id"])

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("role IN ('user','assistant')", name="ck_messages_valid_role"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_messages_conversation_created", "messages", ["conversation_id", "created_at"])
    op.create_index("ix_messages_job", "messages", ["job_id"])

    op.create_table(
        "tool_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("tool_name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("input_summary", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("output_summary", postgresql.JSONB(), nullable=True),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('started','succeeded','failed','cancelled')", name="ck_tool_executions_valid_status"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("job_id", "sequence", name="uq_tool_executions_job_sequence"),
    )
    op.create_index("ix_tool_executions_job_started", "tool_executions", ["job_id", "started_at"])

    op.create_table(
        "sql_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tool_execution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("data_source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sql_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("truncated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("columns", postgresql.JSONB(), nullable=True),
        sa.Column("result_bytes", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('started','succeeded','failed','cancelled')", name="ck_sql_executions_valid_status"),
        sa.ForeignKeyConstraint(["tool_execution_id"], ["tool_executions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["data_source_id"], ["data_sources.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("tool_execution_id", name="uq_sql_executions_tool"),
    )
    op.create_index("ix_sql_executions_datasource_started", "sql_executions", ["data_source_id", "started_at"])

    op.create_table(
        "model_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("model_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("phase", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('started','succeeded','failed')", name="ck_model_executions_valid_status"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["model_profile_id"], ["model_profiles.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("job_id", "sequence", name="uq_model_executions_job_sequence"),
    )
    op.create_index("ix_model_executions_job_started", "model_executions", ["job_id", "started_at"])

    op.create_table(
        "job_artifacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=240), nullable=True),
        sa.Column("source_sql_execution_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('text','table','chart')", name="ck_job_artifacts_valid_kind"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_sql_execution_id"], ["sql_executions.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_job_artifacts_job_created", "job_artifacts", ["job_id", "created_at"])
    op.create_index("ix_job_artifacts_source_sql", "job_artifacts", ["source_sql_execution_id"])


def downgrade() -> None:
    op.drop_index("ix_job_artifacts_source_sql", table_name="job_artifacts")
    op.drop_index("ix_job_artifacts_job_created", table_name="job_artifacts")
    op.drop_table("job_artifacts")
    op.drop_index("ix_model_executions_job_started", table_name="model_executions")
    op.drop_table("model_executions")
    op.drop_index("ix_sql_executions_datasource_started", table_name="sql_executions")
    op.drop_table("sql_executions")
    op.drop_index("ix_tool_executions_job_started", table_name="tool_executions")
    op.drop_table("tool_executions")
    op.drop_index("ix_messages_job", table_name="messages")
    op.drop_index("ix_messages_conversation_created", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_conversation_data_sources_source", table_name="conversation_data_sources")
    op.drop_table("conversation_data_sources")
    op.drop_index("ix_jobs_conversation_created", table_name="jobs")
    op.drop_constraint("fk_jobs_conversation_id_conversations", "jobs", type_="foreignkey")
    op.drop_column("jobs", "conversation_id")
    op.drop_index("ix_conversations_created_by", table_name="conversations")
    op.drop_index("ix_conversations_org_updated", table_name="conversations")
    op.drop_table("conversations")
