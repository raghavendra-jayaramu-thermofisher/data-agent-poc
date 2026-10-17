"""Allow saved line and column combo charts.

Revision ID: 0016_combo_chart
Revises: 0015_matrix_artifact
"""

import sqlalchemy as sa
from alembic import op

revision = "0016_combo_chart"
down_revision = "0015_matrix_artifact"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        op.f("ck_dashboard_widgets_valid_widget_type"), "dashboard_widgets", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_dashboard_widgets_valid_widget_type"),
        "dashboard_widgets",
        "widget_type IN ('metric','table','bar','line','area','pie','donut','combo')",
    )


def downgrade() -> None:
    if (
        op.get_bind()
        .execute(sa.text("SELECT COUNT(*) FROM dashboard_widgets WHERE widget_type = 'combo'"))
        .scalar()
    ):
        raise RuntimeError(
            "Convert or remove combo widgets before downgrading; their line/axis mapping cannot be preserved by older versions."
        )
    op.drop_constraint(
        op.f("ck_dashboard_widgets_valid_widget_type"), "dashboard_widgets", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_dashboard_widgets_valid_widget_type"),
        "dashboard_widgets",
        "widget_type IN ('metric','table','bar','line','area','pie','donut')",
    )
