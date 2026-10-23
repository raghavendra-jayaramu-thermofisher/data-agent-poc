"""LangGraph checkpoints, which let an analysis pause for the user's answers and resume later.

Only the worker runs agents, so only the worker opens the checkpointer. It uses LangGraph's
PostgreSQL saver (psycopg) on the application database; Alembic creates its tables.
Rows are removed once a job finishes, so checkpoints hold only paused or running analyses.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings

CHECKPOINT_TABLES = ("checkpoint_writes", "checkpoint_blobs", "checkpoints")

_checkpointer: object | None = None
_pool: object | None = None


def thread_id(job_id: uuid.UUID, run: int) -> str:
    """One LangGraph thread per agent run of a job (evidence retries start a new run)."""
    return f"{job_id}:{run}"


def _psycopg_conninfo(database_url: str) -> str:
    url = make_url(database_url).set(drivername="postgresql")
    return url.render_as_string(hide_password=False)


async def open_checkpointer(settings: Settings) -> object:
    """Open the shared saver once the checkpoint tables are known to be current."""
    global _checkpointer, _pool
    if _checkpointer is None:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from psycopg.rows import dict_row
        from psycopg_pool import AsyncConnectionPool

        pool = AsyncConnectionPool(
            _psycopg_conninfo(settings.database_url),
            min_size=1,
            max_size=max(2, settings.worker_concurrency),
            kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
            open=False,
        )
        await pool.open()
        # The tables come from Alembic (0020), not saver.setup(), whose concurrent index builds
        # wait for every open transaction. Refuse to pause runs against an older schema.
        async with pool.connection() as conn:
            cursor = await conn.execute("SELECT max(v) AS v FROM checkpoint_migrations")
            row = await cursor.fetchone()
        expected = len(AsyncPostgresSaver.MIGRATIONS) - 1
        if row is None or row["v"] is None or row["v"] < expected:
            await pool.close()
            raise RuntimeError(
                "The LangGraph checkpoint tables are missing or out of date; run alembic upgrade."
            )
        _pool, _checkpointer = pool, AsyncPostgresSaver(pool)  # type: ignore[arg-type]
    return _checkpointer


def current_checkpointer() -> object | None:
    """The worker's saver, or None where none was opened (analyses then cannot pause)."""
    return _checkpointer


async def close_checkpointer() -> None:
    global _checkpointer, _pool
    if _pool is not None:
        await _pool.close()  # type: ignore[attr-defined]
    _checkpointer, _pool = None, None


async def delete_job_checkpoints(session: AsyncSession, job_ids: Iterable[uuid.UUID]) -> None:
    """Remove every run thread of the given jobs; a no-op before the saver created its tables."""
    patterns = [f"{job_id}:%" for job_id in job_ids]
    if not patterns:
        return
    exists = await session.scalar(text("SELECT to_regclass('checkpoints') IS NOT NULL"))
    if not exists:
        return
    for table in CHECKPOINT_TABLES:
        await session.execute(
            text(f"DELETE FROM {table} WHERE thread_id LIKE ANY(:patterns)"),
            {"patterns": patterns},
        )
    await session.commit()
