"""Persist sanitized connection test diagnostics."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010_connection_diagnostics"
down_revision = "0009_agent_instructions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("data_sources", sa.Column("last_connection_diagnostics", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("data_sources", "last_connection_diagnostics")
