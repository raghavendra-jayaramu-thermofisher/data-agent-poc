"""Include the id tie-breaker in conversation and message list indexes for keyset paging.

Revision ID: 0017_keyset_list_indexes
Revises: 0016_combo_chart
"""

from alembic import op

revision = "0017_keyset_list_indexes"
down_revision = "0016_combo_chart"
branch_labels = None
depends_on = None

INDEXES = (
    ("ix_conversations_org_updated", "conversations", ["organization_id", "updated_at"]),
    ("ix_messages_conversation_created", "messages", ["conversation_id", "created_at"]),
)


def upgrade() -> None:
    for name, table, columns in INDEXES:
        op.drop_index(name, table_name=table)
        op.create_index(name, table, [*columns, "id"])


def downgrade() -> None:
    for name, table, columns in INDEXES:
        op.drop_index(name, table_name=table)
        op.create_index(name, table, columns)
