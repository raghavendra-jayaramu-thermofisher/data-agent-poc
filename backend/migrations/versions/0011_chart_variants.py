"""Allow donut dashboard widgets.

Revision ID: 0011_chart_variants
Revises: 0010_connection_diagnostics
"""

from __future__ import annotations

from alembic import op

revision = "0011_chart_variants"
down_revision = "0010_connection_diagnostics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        op.f("ck_dashboard_widgets_valid_widget_type"), "dashboard_widgets", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_dashboard_widgets_valid_widget_type"),
        "dashboard_widgets",
        "widget_type IN ('metric','table','bar','line','area','pie','donut')",
    )


def downgrade() -> None:
    # A donut uses the same category/value mapping as a pie, so preserve saved widgets.
    op.execute("UPDATE dashboard_widgets SET widget_type = 'pie' WHERE widget_type = 'donut'")
    op.drop_constraint(
        op.f("ck_dashboard_widgets_valid_widget_type"), "dashboard_widgets", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_dashboard_widgets_valid_widget_type"),
        "dashboard_widgets",
        "widget_type IN ('metric','table','bar','line','area','pie')",
    )
