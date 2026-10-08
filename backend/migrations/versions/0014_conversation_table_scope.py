"""Persist optional conversation table selection."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0014_conversation_table_scope"
down_revision = "0013_answer_verification"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "conversations",
        sa.Column("table_scope", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )


def downgrade():
    op.drop_column("conversations", "table_scope")
