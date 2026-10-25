"""Record each model call's reasoning effort; effort is no longer a model profile setting.

The effort is chosen per question, so any `reasoning_effort` saved in profile settings is removed:
the API now rejects it there.

Revision ID: 0021_reasoning_effort
Revises: 0020_langgraph_checkpoints
"""

import sqlalchemy as sa
from alembic import op

revision = "0021_reasoning_effort"
down_revision = "0020_langgraph_checkpoints"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No check constraint: OpenAI keeps adding effort values, and the API validates them.
    op.add_column("model_executions", sa.Column("reasoning_effort", sa.String(20), nullable=True))
    op.execute(
        "UPDATE model_profiles SET settings = settings - 'reasoning_effort' - 'reasoning' "
        "WHERE settings ?| array['reasoning_effort', 'reasoning']"
    )


def downgrade() -> None:
    op.drop_column("model_executions", "reasoning_effort")
