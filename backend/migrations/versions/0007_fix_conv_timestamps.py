"""Fix missing server defaults on conversations.created_at/updated_at.

The Conversation ORM model uses TimestampMixin, which expects the database to
supply created_at/updated_at via server_default=now(). Migration 0005 created
these columns without that default, so any insert that omits them (as the ORM
does) fails with a not-null violation.

Revision ID: 0007_fix_conv_timestamps
Revises: 0006_task6_reporting_hardening
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_fix_conv_timestamps"
down_revision: str | None = "0006_task6_reporting_hardening"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "conversations",
        "created_at",
        server_default=sa.func.now(),
    )
    op.alter_column(
        "conversations",
        "updated_at",
        server_default=sa.func.now(),
    )


def downgrade() -> None:
    op.alter_column(
        "conversations",
        "created_at",
        server_default=None,
    )
    op.alter_column(
        "conversations",
        "updated_at",
        server_default=None,
    )
