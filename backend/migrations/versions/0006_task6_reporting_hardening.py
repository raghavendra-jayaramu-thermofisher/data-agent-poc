"""Task 6 dashboards, reporting and audit log.

Revision ID: 0006_task6_reporting_hardening
Revises: 0005_task5_agent
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_task6_reporting_hardening"
down_revision: str | None = "0005_task5_agent"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dashboards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("organization_id", "title", name="uq_dashboards_org_title"),
    )
    op.create_index("ix_dashboards_org_updated", "dashboards", ["organization_id", "updated_at"])

    op.create_table(
        "dashboard_widgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dashboard_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("data_source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("widget_type", sa.String(length=20), nullable=False),
        sa.Column("question", sa.Text(), nullable=True),
        sa.Column("sql_text", sa.Text(), nullable=False),
        sa.Column("visualization_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("layout_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_from_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_from_sql_execution_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_refresh_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_refreshed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("widget_type IN ('metric','table','bar','line','area','pie')", name="valid_widget_type"),
        sa.ForeignKeyConstraint(["dashboard_id"], ["dashboards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["data_source_id"], ["data_sources.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_from_job_id"], ["jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_from_sql_execution_id"], ["sql_executions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["last_refresh_job_id"], ["jobs.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_dashboard_widgets_dashboard_created", "dashboard_widgets", ["dashboard_id", "created_at"])
    op.create_index("ix_dashboard_widgets_source", "dashboard_widgets", ["data_source_id"])
    op.create_index("ix_dashboard_widgets_refresh_job", "dashboard_widgets", ["last_refresh_job_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("resource_type", sa.String(length=80), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_audit_logs_org_created", "audit_logs", ["organization_id", "created_at"])
    op.create_index("ix_audit_logs_resource", "audit_logs", ["resource_type", "resource_id", "created_at"])
    op.create_index("ix_audit_logs_user_created", "audit_logs", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_user_created", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource", table_name="audit_logs")
    op.drop_index("ix_audit_logs_org_created", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_dashboard_widgets_refresh_job", table_name="dashboard_widgets")
    op.drop_index("ix_dashboard_widgets_source", table_name="dashboard_widgets")
    op.drop_index("ix_dashboard_widgets_dashboard_created", table_name="dashboard_widgets")
    op.drop_table("dashboard_widgets")
    op.drop_index("ix_dashboards_org_updated", table_name="dashboards")
    op.drop_table("dashboards")
