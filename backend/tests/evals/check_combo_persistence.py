"""Opt-in loopback PostgreSQL smoke test using synthetic chart data; all records roll back."""

import argparse
import asyncio
import uuid
from unittest.mock import AsyncMock, patch

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.agent.evidence import collect_evidence
from app.agent.models import JobArtifact, SQLExecution, ToolExecution
from app.agent.tools import AgentToolContext, AgentToolError, create_chart
from app.core.config import get_settings
from app.core.database import close_database, get_engine
from app.core.time import utc_now
from app.data_sources.models import DataSource
from app.jobs.models import Job
from app.main import app  # noqa: F401 -- register ORM models
from app.reporting.models import DashboardWidget
from app.reporting.schemas import DashboardCreate, DashboardWidgetCreate
from app.reporting.service import ReportingService
from tests.unit.test_combo_chart import FIXTURE, config


async def check(source_id: uuid.UUID) -> None:
    settings = get_settings()
    if make_url(settings.database_url).host not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Smoke test is restricted to a loopback application database")
    job_id, sql_id, tool_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    columns = list(FIXTURE["data"][0])
    rows = [[row[column] for column in columns] for row in FIXTURE["data"]]
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
                session.add(
                    Job(
                        id=job_id,
                        organization_id=org_id,
                        requested_by=user_id,
                        job_type="chat_query",
                        status="succeeded",
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
                    )
                )
                await session.flush()
                session.add(
                    SQLExecution(
                        id=sql_id,
                        tool_execution_id=tool_id,
                        data_source_id=source_id,
                        sql_text="SELECT month, online, store, fulfilled, target FROM synthetic_fixture",
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
                        name="Synthetic combo source",
                        source_sql_execution_id=sql_id,
                        created_at=utc_now(),
                        payload={
                            "schema_version": 1,
                            "columns": columns,
                            "rows": rows,
                            "row_count": len(rows),
                            "data_source_id": str(source_id),
                            "truncated": False,
                        },
                    )
                )
                await session.commit()
            arguments = {
                "sql_execution_id": str(sql_id),
                "title": FIXTURE["title"],
                "chart_type": "combo",
                **config(),
            }
            context = AgentToolContext(
                job_id, org_id, uuid.uuid4(), frozenset([source_id]), settings
            )
            with (
                patch("app.agent.tools.get_session_factory", return_value=factory),
                patch("app.agent.tools.append_agent_event", AsyncMock()),
            ):
                result = await create_chart(context, arguments, uuid.uuid4())
                async with factory() as session:
                    sql = await session.get(SQLExecution, sql_id)
                    sql.truncated = True
                    await session.commit()
                try:
                    await create_chart(context, arguments, uuid.uuid4())
                except AgentToolError as error:
                    assert error.code == "CHART_SOURCE_TRUNCATED"
                else:
                    raise AssertionError("Truncated source was accepted")
                async with factory() as session:
                    sql = await session.get(SQLExecution, sql_id)
                    sql.truncated = False
                    await session.commit()
            async with factory() as session:
                artifact = await session.get(JobArtifact, uuid.UUID(result["chart_artifact_id"]))
                assert artifact.payload["encoding"]["series"] == FIXTURE["encoding"]["series"]
                bundle = await collect_evidence(
                    session, job_id=job_id, question="Synthetic combo", analyst_notes=""
                )
                assert any(item.kind == "chart" and item.valid for item in bundle.visible_artifacts)
                service = ReportingService(session, settings)
                dashboard = await service.create_dashboard(
                    organization_id=org_id,
                    user_id=user_id,
                    payload=DashboardCreate(title=f"Combo smoke {job_id}"),
                )
                widget = await service.add_widget(
                    dashboard_id=dashboard.id,
                    organization_id=org_id,
                    user_id=user_id,
                    payload=DashboardWidgetCreate(
                        source_job_id=job_id,
                        source_sql_execution_id=sql_id,
                        widget_type="combo",
                        title=FIXTURE["title"],
                        visualization_config=config(),
                    ),
                )
                widget_id = widget.id
                assert widget.widget_type == "combo"
                assert widget.visualization_config == config()
                assert (await service._artifact_for_widget(widget)).id == artifact.id
            async with factory() as session:
                saved = await session.get(DashboardWidget, widget_id)
                assert saved.visualization_config["secondary_y_label"] == "Fulfilment (%)"
        finally:
            if transaction.is_active:
                await transaction.rollback()
    async with async_sessionmaker(engine)() as session:
        assert await session.get(Job, job_id) is None
    print(
        "Combo chart tool, truncation rejection, evidence and dashboard JSONB persistence passed; records rolled back."
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
