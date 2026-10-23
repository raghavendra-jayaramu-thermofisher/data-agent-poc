"""Let analytical jobs pause while they wait for the user's answers.

Revision ID: 0019_job_waiting_for_input
Revises: 0018_model_pricing
"""

import sqlalchemy as sa
from alembic import op

revision = "0019_job_waiting_for_input"
down_revision = "0018_model_pricing"
branch_labels = None
depends_on = None

STATUSES = "'queued','running','waiting_for_input','succeeded','failed','cancelled'"
PREVIOUS = "'queued','running','succeeded','failed','cancelled'"


def upgrade() -> None:
    op.drop_constraint(op.f("ck_jobs_valid_status"), "jobs", type_="check")
    op.create_check_constraint(op.f("ck_jobs_valid_status"), "jobs", f"status IN ({STATUSES})")


def downgrade() -> None:
    # Paused analyses cannot resume on the older code, so they end as cancelled.
    op.execute(sa.text(
        "UPDATE jobs SET status = 'cancelled', finished_at = now() "
        "WHERE status = 'waiting_for_input'"
    ))
    op.drop_constraint(op.f("ck_jobs_valid_status"), "jobs", type_="check")
    op.create_check_constraint(op.f("ck_jobs_valid_status"), "jobs", f"status IN ({PREVIOUS})")
