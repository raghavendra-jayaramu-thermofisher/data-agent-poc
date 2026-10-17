"""Opt-in local PostgreSQL smoke test; every test record is rolled back.

Uses synthetic fixture data and the selected source's existing organization/user foreign keys.
Never uses the destructive integration-suite fixtures or connects to the business datasource.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from unittest.mock import AsyncMock, patch

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.agent.evidence import collect_evidence
from app.agent.models import JobArtifact, SQLExecution, ToolExecution
from app.agent.tools import AgentToolContext, create_matrix
from app.core.config import get_settings
from app.core.database import close_database, get_engine
from app.core.time import utc_now
from app.data_sources.models import DataSource
from app.jobs.models import Job
from app.main import app  # noqa: F401 -- register ORM models
from tests.unit.test_matrix import example


async def check(source_id: uuid.UUID) -> None:
    settings = get_settings()
    if make_url(settings.database_url).host not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Smoke test is restricted to a loopback application database")
    job_id, tool_id = uuid.uuid4(), uuid.uuid4()
    engine = get_engine()
    async with engine.connect() as connection:
        transaction = await connection.begin()
        factory = async_sessionmaker(
            connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )
        try:
            async with factory() as session:
                source = await session.get(DataSource, source_id)
                if source is None:
                    raise ValueError("Specified datasource is unavailable")
                org_id, user_id = source.organization_id, source.created_by
                spec, columns, rows = example()
                spec = spec.model_copy(update={"sql_execution_id": uuid.uuid4()})
                session.add(
                    Job(
                        id=job_id,
                        organization_id=org_id,
                        requested_by=user_id,
                        job_type="chat_query",
                        status="running",
                        input={},
                        created_at=utc_now(),
                    )
                )
                await session.flush()
                session.add(
                    ToolExecution(
                        id=tool_id,
                        job_id=job_id,
                        sequence=1,
                        tool_name="execute_sql",
                        status="succeeded",
                        started_at=utc_now(),
                        output_summary={"source_kind": source.kind},
                    )
                )
                await session.flush()
                session.add(
                    SQLExecution(
                        id=spec.sql_execution_id,
                        tool_execution_id=tool_id,
                        data_source_id=source.id,
                        sql_text="SELECT SUM(amount) FROM synthetic_fixture",
                        status="succeeded",
                        columns=columns,
                        row_count=len(rows),
                        truncated=False,
                        started_at=utc_now(),
                    )
                )
                await session.flush()
                session.add(
                    JobArtifact(
                        job_id=job_id,
                        kind="table",
                        name="Synthetic fixture",
                        source_sql_execution_id=spec.sql_execution_id,
                        created_at=utc_now(),
                        payload={
                            "schema_version": 1,
                            "columns": columns,
                            "rows": rows,
                            "row_count": len(rows),
                            "truncated": False,
                            "data_source_id": str(source.id),
                            "display": "auto",
                        },
                    )
                )
                await session.commit()  # Releases a SAVEPOINT, never the outer transaction.
            context = AgentToolContext(
                job_id, org_id, uuid.uuid4(), frozenset([source_id]), settings
            )
            with (
                patch("app.agent.tools.get_session_factory", return_value=factory),
                patch("app.agent.tools.append_agent_event", AsyncMock()),
            ):
                first = await create_matrix(context, spec.model_dump(mode="json"), uuid.uuid4())
                second = await create_matrix(context, spec.model_dump(mode="json"), uuid.uuid4())
                assert first["matrix_artifact_id"] == second["matrix_artifact_id"]
            async with factory() as session:
                bundle = await collect_evidence(
                    session, job_id=job_id, question="Compare synthetic measures", analyst_notes=""
                )
                assert [item.kind for item in bundle.visible_artifacts] == ["matrix"]
                assert bundle.visible_artifacts[0].valid
                assert "9007199254740993.12" in json.dumps(bundle.visible_artifacts[0].payload)
        finally:
            if transaction.is_active:
                await transaction.rollback()
    async with async_sessionmaker(engine)() as session:
        assert await session.get(Job, job_id) is None
    print(
        "PostgreSQL matrix persistence, JSONB precision, evidence and idempotency passed; "
        "records rolled back."
    )


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-id", type=uuid.UUID, required=True)
    args = parser.parse_args()
    try:
        await check(args.source_id)
    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(main())
