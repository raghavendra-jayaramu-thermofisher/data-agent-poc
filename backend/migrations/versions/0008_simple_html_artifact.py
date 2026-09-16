"""Allow one-file HTML artifacts.

Revision ID: 0008_simple_html_artifact
Revises: 0007_fix_conv_timestamps
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008_simple_html_artifact"
down_revision: str | None = "0007_fix_conv_timestamps"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    constraint_name = op.f("ck_job_artifacts_valid_kind")
    op.drop_constraint(constraint_name, "job_artifacts", type_="check")
    op.create_check_constraint(
        constraint_name,
        "job_artifacts",
        "kind IN ('text','table','chart','html')",
    )


def downgrade() -> None:
    constraint_name = op.f("ck_job_artifacts_valid_kind")
    op.drop_constraint(constraint_name, "job_artifacts", type_="check")
    op.create_check_constraint(
        constraint_name,
        "job_artifacts",
        "kind IN ('text','table','chart')",
    )
