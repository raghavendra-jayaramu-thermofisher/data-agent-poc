"""Store model prices on profiles and the priced cost of each model call.

Revision ID: 0018_model_pricing
Revises: 0017_keyset_list_indexes
"""

import sqlalchemy as sa
from alembic import op

revision = "0018_model_pricing"
down_revision = "0017_keyset_list_indexes"
branch_labels = None
depends_on = None

PRICE_COLUMNS = (
    "input_price_per_million",
    "cached_input_price_per_million",
    "output_price_per_million",
)


def upgrade() -> None:
    for name in PRICE_COLUMNS:
        op.add_column("model_profiles", sa.Column(name, sa.Numeric(12, 6), nullable=True))
        op.add_column("model_executions", sa.Column(name, sa.Numeric(12, 6), nullable=True))
    op.add_column("model_executions", sa.Column("cached_input_tokens", sa.Integer(), nullable=True))
    op.add_column("model_executions", sa.Column("cost", sa.Numeric(18, 8), nullable=True))
    for name in PRICE_COLUMNS:
        op.create_check_constraint(
            op.f(f"ck_model_profiles_{name}_nonnegative"), "model_profiles", f"{name} >= 0"
        )


def downgrade() -> None:
    for name in PRICE_COLUMNS:
        op.drop_constraint(
            op.f(f"ck_model_profiles_{name}_nonnegative"), "model_profiles", type_="check"
        )
    op.drop_column("model_executions", "cost")
    op.drop_column("model_executions", "cached_input_tokens")
    for name in PRICE_COLUMNS:
        op.drop_column("model_executions", name)
        op.drop_column("model_profiles", name)
