"""Give business knowledge notes an optional title, used by Markdown import and export.

Revision ID: 0022_annotation_title
Revises: 0021_reasoning_effort
"""

import sqlalchemy as sa
from alembic import op

revision = "0022_annotation_title"
down_revision = "0021_reasoning_effort"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("knowledge_annotations", sa.Column("title", sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column("knowledge_annotations", "title")
