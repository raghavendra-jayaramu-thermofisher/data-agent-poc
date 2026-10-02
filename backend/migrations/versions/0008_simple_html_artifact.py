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


def _drop_kind_constraints() -> None:
    # 0005 passed an already-prefixed name through the naming convention,
    # producing the doubled name. Also support databases created from models.
    for name in (
        "ck_job_artifacts_ck_job_artifacts_valid_kind",
        "ck_job_artifacts_valid_kind",
    ):
        op.execute(f'ALTER TABLE job_artifacts DROP CONSTRAINT IF EXISTS "{name}"')


def upgrade() -> None:
    constraint_name = op.f("ck_job_artifacts_valid_kind")
    _drop_kind_constraints()
    op.create_check_constraint(
        constraint_name,
        "job_artifacts",
        "kind IN ('text','table','chart','html')",
    )


def downgrade() -> None:
    constraint_name = op.f("ck_job_artifacts_valid_kind")
    _drop_kind_constraints()
    op.create_check_constraint(
        constraint_name,
        "job_artifacts",
        "kind IN ('text','table','chart')",
    )
