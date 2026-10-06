"""Persist manual answer verification."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
revision = "0013_answer_verification"
down_revision = "0012_provider_error_response"
branch_labels = None
depends_on = None

def upgrade():
    for name, kind in [("verification_status", sa.String(30)), ("verification_percentage", sa.Integer()), ("verification_summary", sa.Text()), ("verified_by", UUID(as_uuid=True)), ("verified_by_name", sa.String(255)), ("verified_at", sa.DateTime(timezone=True))]:
        op.add_column("messages", sa.Column(name, kind, nullable=True))
    op.create_foreign_key("fk_messages_verified_by_users", "messages", "users", ["verified_by"], ["id"], ondelete="SET NULL")

def downgrade():
    op.drop_constraint("fk_messages_verified_by_users", "messages", type_="foreignkey")
    for name in ["verified_at", "verified_by_name", "verified_by", "verification_summary", "verification_percentage", "verification_status"]:
        op.drop_column("messages", name)
