"""Store redacted provider error responses alongside model executions."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0012_provider_error_response"
down_revision = "0011_chart_variants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("model_executions", sa.Column("provider_error_response", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("model_executions", "provider_error_response")
