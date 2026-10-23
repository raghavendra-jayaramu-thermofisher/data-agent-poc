"""Create LangGraph's checkpoint tables, which hold analyses paused for the user's answers.

The statements are langgraph-checkpoint-postgres 3.1.0's own migrations, applied here without
CONCURRENTLY: the tables are new and empty, and a concurrent index build would wait for every
open transaction in the database. The recorded versions let the saver treat its schema as current.

Revision ID: 0020_langgraph_checkpoints
Revises: 0019_job_waiting_for_input
"""

import sqlalchemy as sa
from alembic import op

revision = "0020_langgraph_checkpoints"
down_revision = "0019_job_waiting_for_input"
branch_labels = None
depends_on = None

# langgraph-checkpoint-postgres 3.1.0 BasePostgresSaver.MIGRATIONS, versions 0-9.
SAVER_MIGRATIONS = (
    "CREATE TABLE IF NOT EXISTS checkpoint_migrations (v INTEGER PRIMARY KEY)",
    """CREATE TABLE IF NOT EXISTS checkpoints (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        parent_checkpoint_id TEXT,
        type TEXT,
        checkpoint JSONB NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
    )""",
    """CREATE TABLE IF NOT EXISTS checkpoint_blobs (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        channel TEXT NOT NULL,
        version TEXT NOT NULL,
        type TEXT NOT NULL,
        blob BYTEA,
        PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
    )""",
    """CREATE TABLE IF NOT EXISTS checkpoint_writes (
        thread_id TEXT NOT NULL,
        checkpoint_ns TEXT NOT NULL DEFAULT '',
        checkpoint_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        channel TEXT NOT NULL,
        type TEXT,
        blob BYTEA NOT NULL,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
    )""",
    "ALTER TABLE checkpoint_blobs ALTER COLUMN blob DROP NOT NULL",
    "SELECT 1",
    "CREATE INDEX IF NOT EXISTS checkpoints_thread_id_idx ON checkpoints(thread_id)",
    "CREATE INDEX IF NOT EXISTS checkpoint_blobs_thread_id_idx ON checkpoint_blobs(thread_id)",
    "CREATE INDEX IF NOT EXISTS checkpoint_writes_thread_id_idx ON checkpoint_writes(thread_id)",
    "ALTER TABLE checkpoint_writes ADD COLUMN IF NOT EXISTS task_path TEXT NOT NULL DEFAULT ''",
)
SAVER_SCHEMA_VERSION = len(SAVER_MIGRATIONS) - 1


def upgrade() -> None:
    for statement in SAVER_MIGRATIONS:
        op.execute(sa.text(statement))
    op.execute(sa.text(
        "INSERT INTO checkpoint_migrations (v) SELECT generate_series(0, :last) "
        "ON CONFLICT (v) DO NOTHING"
    ).bindparams(last=SAVER_SCHEMA_VERSION))


def downgrade() -> None:
    # Paused analyses cannot resume without their checkpoints, so they end as cancelled.
    op.execute(sa.text(
        "UPDATE jobs SET status = 'cancelled', finished_at = now() "
        "WHERE status = 'waiting_for_input'"
    ))
    op.execute(sa.text(
        "DROP TABLE IF EXISTS checkpoint_writes, checkpoint_blobs, checkpoints, "
        "checkpoint_migrations"
    ))
