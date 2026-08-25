from __future__ import annotations

import time
import uuid

from pydantic import ValidationError

from app.agent.models import JobArtifact, SQLExecution, ToolExecution
from app.agent.repository import AgentExecutionRepository
from app.agent.serialization import bound_query_result
from app.agent.sql_safety import SQLSafetyViolation, validate_read_only_sql
from app.agent.tool_schemas import ChartSeriesInput, CreateChartArgs
from app.agent.tools import (
    AgentCancelledError,
    AgentToolError,
    append_agent_event,
    build_frontend_chart_payload,
    run_cancellable,
)
from app.audit.service import AuditService
from app.core.config import Settings, get_settings
from app.core.database import get_session_factory
from app.core.time import utc_now
from app.data_sources.errors import DataSourceOperationError
from app.data_sources.service import DataSourceService
from app.jobs.handlers import JobHandlerRegistry
from app.jobs.repository import JobRepository
from app.jobs.worker import JobFailureError
from app.reporting.repository import ReportingRepository


def _chart_args(
    widget_type: str,
    title: str,
    sql_execution_id: uuid.UUID,
    config: dict[str, object],
) -> CreateChartArgs:
    try:
        if widget_type == "pie":
            return CreateChartArgs(
                sql_execution_id=sql_execution_id,
                chart_type="pie",
                title=title,
                category_field=config.get("category_field"),
                value_field=config.get("value_field"),
                value_label=config.get("value_label"),
            )
        raw_series = config.get("series") or []
        series = (
            [ChartSeriesInput.model_validate(item) for item in raw_series]
            if isinstance(raw_series, list)
            else []
        )
        return CreateChartArgs(
            sql_execution_id=sql_execution_id,
            chart_type=widget_type,  # type: ignore[arg-type]
            title=title,
            x_field=config.get("x_field"),
            x_label=config.get("x_label"),
            series=series,
        )
    except ValidationError as exc:
        raise JobFailureError(
            "WIDGET_CONFIG_INVALID", "The saved widget configuration is invalid."
        ) from exc


def _optional_uuid(value: object) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


async def run_dashboard_refresh_job(job_id: uuid.UUID) -> dict[str, object]:
    """Refresh one widget or every enabled widget in a dashboard.

    Dashboard refresh deliberately reuses already-reviewed SQL rather than invoking an LLM. New
    analytical questions continue to use the Deep Agents/LangGraph `chat_query` runtime. This keeps
    recurring refresh deterministic, inexpensive, and fully covered by the same SQL safety layer.
    """

    settings = get_settings()
    async with get_session_factory()() as session:
        job = await JobRepository(session).get(job_id)
        if job is None or job.job_type != "dashboard_refresh":
            raise JobFailureError("JOB_INPUT_INVALID", "The dashboard refresh job is invalid.")
        organization_id = job.organization_id
        requested_by = job.requested_by
        widget_id = _optional_uuid(job.input.get("widget_id"))
        dashboard_id = _optional_uuid(job.input.get("dashboard_id"))
        if (widget_id is None) == (dashboard_id is None):
            raise JobFailureError("JOB_INPUT_INVALID", "The dashboard refresh job is invalid.")

        repo = ReportingRepository(session)
        if dashboard_id is not None:
            dashboard = await repo.get_dashboard_for_org(dashboard_id, organization_id)
            if dashboard is None:
                raise JobFailureError("DASHBOARD_NOT_FOUND", "The dashboard is unavailable.")
            widgets = await repo.list_widgets(dashboard.id)
            widget_ids = [item.id for item in widgets if item.enabled]
            if not widget_ids:
                raise JobFailureError(
                    "DASHBOARD_HAS_NO_ENABLED_WIDGETS",
                    "The dashboard has no enabled widgets to refresh.",
                )
        else:
            assert widget_id is not None
            widget_ids = [widget_id]

    if dashboard_id is not None:
        await append_agent_event(
            job_id,
            "dashboard.refresh.started",
            {"dashboard_id": str(dashboard_id), "widget_count": len(widget_ids)},
        )

    results: list[dict[str, object]] = []
    for current_widget_id in widget_ids:
        results.append(
            await _refresh_widget(
                job_id=job_id,
                organization_id=organization_id,
                requested_by=requested_by,
                widget_id=current_widget_id,
                settings=settings,
            )
        )

    if dashboard_id is not None:
        await append_agent_event(
            job_id,
            "dashboard.refresh.completed",
            {"dashboard_id": str(dashboard_id), "widget_count": len(results)},
        )
        return {"dashboard_id": str(dashboard_id), "widgets": results}
    return results[0]


async def _refresh_widget(
    *,
    job_id: uuid.UUID,
    organization_id: uuid.UUID,
    requested_by: uuid.UUID,
    widget_id: uuid.UUID,
    settings: Settings,
) -> dict[str, object]:
    async with get_session_factory()() as session:
        reporting_repo = ReportingRepository(session)
        widget = await reporting_repo.get_widget_for_org(widget_id, organization_id)
        if widget is None or not widget.enabled:
            raise JobFailureError(
                "DASHBOARD_WIDGET_NOT_FOUND", "The dashboard widget is unavailable."
            )
        source_service = DataSourceService(session, settings)
        source = await source_service.require_for_org(widget.data_source_id, organization_id)
        if source.status != "active":
            raise JobFailureError("DATASOURCE_NOT_ACTIVE", "The datasource is not active.")
        try:
            sql = validate_read_only_sql(widget.sql_text, source_kind=source.kind)
        except SQLSafetyViolation as exc:
            raise JobFailureError(exc.code, exc.public_message) from exc
        adapter = await source_service.resolve_adapter(source)
        source_id = source.id
        widget_title = widget.title
        widget_type = widget.widget_type
        visualization_config = dict(widget.visualization_config)

        execution_repo = AgentExecutionRepository(session)
        sequence = await execution_repo.next_tool_sequence(job_id)
        tool = ToolExecution(
            job_id=job_id,
            sequence=sequence,
            tool_name="dashboard_refresh_sql",
            status="started",
            input_summary={"data_source_id": str(source_id), "sql": sql},
            started_at=utc_now(),
        )
        execution_repo.add_tool(tool)
        await session.flush()
        sql_item = SQLExecution(
            tool_execution_id=tool.id,
            data_source_id=source_id,
            sql_text=sql,
            status="started",
            started_at=utc_now(),
        )
        execution_repo.add_sql(sql_item)
        await session.commit()
        tool_execution_id = tool.id
        sql_execution_id = sql_item.id

    await append_agent_event(
        job_id,
        "sql.started",
        {
            "sql_execution_id": str(sql_execution_id),
            "data_source_id": str(source_id),
            "widget_id": str(widget_id),
            "sql": sql,
        },
    )
    started = time.perf_counter()
    try:
        result = await run_cancellable(
            job_id,
            adapter.execute_read_query(sql, max_rows=settings.agent_result_max_rows),
            timeout_seconds=settings.agent_query_timeout_seconds,
        )
        columns, rows, truncated, result_bytes = bound_query_result(
            result, max_bytes=settings.agent_result_max_bytes  # type: ignore[arg-type]
        )
        duration_ms = max(0, int((time.perf_counter() - started) * 1000))
    except AgentCancelledError as exc:
        await _mark_refresh_failed(
            job_id,
            sql_execution_id,
            tool_execution_id,
            "cancelled",
            "JOB_CANCELLED",
            "Dashboard refresh was cancelled.",
        )
        raise JobFailureError("JOB_CANCELLED", "The dashboard refresh was cancelled.") from exc
    except TimeoutError as exc:
        await _mark_refresh_failed(
            job_id,
            sql_execution_id,
            tool_execution_id,
            "failed",
            "SQL_QUERY_TIMEOUT",
            "The dashboard query timed out.",
        )
        raise JobFailureError("SQL_QUERY_TIMEOUT", "The dashboard query timed out.") from exc
    except DataSourceOperationError as exc:
        await _mark_refresh_failed(
            job_id,
            sql_execution_id,
            tool_execution_id,
            "failed",
            exc.code,
            exc.public_message,
        )
        raise JobFailureError(exc.code, exc.public_message, retryable=exc.retryable) from exc

    chart_payload: dict[str, object] | None = None
    if widget_type in {"bar", "line", "area", "pie"}:
        parsed = _chart_args(
            widget_type, widget_title, sql_execution_id, visualization_config
        )
        try:
            chart_payload, _ = build_frontend_chart_payload(parsed, columns, rows)
        except AgentToolError as exc:
            await _mark_query_succeeded_tool_failed(
                job_id=job_id,
                sql_execution_id=sql_execution_id,
                tool_execution_id=tool_execution_id,
                columns=columns,
                rows=rows,
                truncated=truncated,
                result_bytes=result_bytes,
                duration_ms=duration_ms,
                code=exc.code,
                message=exc.public_message,
            )
            await append_agent_event(
                job_id,
                "sql.completed",
                {
                    "sql_execution_id": str(sql_execution_id),
                    "row_count": len(rows),
                    "truncated": truncated,
                    "duration_ms": duration_ms,
                },
            )
            raise JobFailureError(exc.code, exc.public_message) from exc

    async with get_session_factory()() as session:
        sql_row = await session.get(SQLExecution, sql_execution_id)
        tool_row = await session.get(ToolExecution, tool_execution_id)
        widget = await ReportingRepository(session).get_widget_for_org(widget_id, organization_id)
        if sql_row is None or tool_row is None or widget is None:
            raise JobFailureError(
                "DASHBOARD_REFRESH_STATE_MISSING", "Dashboard refresh state is unavailable."
            )
        now = utc_now()
        sql_row.status = "succeeded"
        sql_row.columns = columns
        sql_row.row_count = len(rows)
        sql_row.truncated = truncated
        sql_row.result_bytes = result_bytes
        sql_row.duration_ms = duration_ms
        sql_row.finished_at = now
        tool_row.status = "succeeded"
        tool_row.output_summary = {
            "row_count": len(rows),
            "truncated": truncated,
            "duration_ms": duration_ms,
        }
        tool_row.finished_at = now

        table_artifact = JobArtifact(
            job_id=job_id,
            kind="table",
            name=widget.title,
            source_sql_execution_id=sql_execution_id,
            payload={
                "schema_version": 1,
                "data_source_id": str(widget.data_source_id),
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "truncated": truncated,
            },
            created_at=now,
        )
        session.add(table_artifact)
        artifact: JobArtifact = table_artifact
        if chart_payload is not None:
            chart_artifact = JobArtifact(
                job_id=job_id,
                kind="chart",
                name=widget.title,
                source_sql_execution_id=sql_execution_id,
                payload=chart_payload,
                created_at=now,
            )
            session.add(chart_artifact)
            artifact = chart_artifact
        widget.last_refresh_job_id = job_id
        widget.last_refreshed_at = now
        AuditService(session).record(
            organization_id=organization_id,
            user_id=requested_by,
            action="dashboard_widget.refreshed",
            resource_type="dashboard_widget",
            resource_id=widget.id,
            metadata={"job_id": str(job_id), "sql_execution_id": str(sql_execution_id)},
        )
        await session.flush()
        artifact_id = artifact.id
        await session.commit()

    await append_agent_event(
        job_id,
        "sql.completed",
        {
            "sql_execution_id": str(sql_execution_id),
            "row_count": len(rows),
            "truncated": truncated,
            "duration_ms": duration_ms,
        },
    )
    await append_agent_event(
        job_id,
        "dashboard.widget.refreshed",
        {"widget_id": str(widget_id), "artifact_id": str(artifact_id)},
    )
    return {
        "widget_id": str(widget_id),
        "sql_execution_id": str(sql_execution_id),
        "artifact_id": str(artifact_id),
    }


async def _mark_refresh_failed(
    job_id: uuid.UUID,
    sql_execution_id: uuid.UUID,
    tool_execution_id: uuid.UUID,
    status: str,
    code: str,
    message: str,
) -> None:
    async with get_session_factory()() as session:
        sql_item = await session.get(SQLExecution, sql_execution_id)
        tool_item = await session.get(ToolExecution, tool_execution_id)
        now = utc_now()
        if sql_item is not None:
            sql_item.status = status
            sql_item.error_code = code[:100]
            sql_item.error_message = message[:2000]
            sql_item.finished_at = now
        if tool_item is not None:
            tool_item.status = "cancelled" if status == "cancelled" else "failed"
            tool_item.error_code = code[:100]
            tool_item.error_message = message[:2000]
            tool_item.finished_at = now
        await session.commit()
    await append_agent_event(
        job_id,
        "sql.failed" if status != "cancelled" else "sql.cancelled",
        {"sql_execution_id": str(sql_execution_id), "code": code},
        level="warning",
    )


async def _mark_query_succeeded_tool_failed(
    *,
    job_id: uuid.UUID,
    sql_execution_id: uuid.UUID,
    tool_execution_id: uuid.UUID,
    columns: list[str],
    rows: list[list[object]],
    truncated: bool,
    result_bytes: int,
    duration_ms: int,
    code: str,
    message: str,
) -> None:
    """Record a successful query when only frontend-artifact construction failed."""

    async with get_session_factory()() as session:
        sql_item = await session.get(SQLExecution, sql_execution_id)
        tool_item = await session.get(ToolExecution, tool_execution_id)
        now = utc_now()
        if sql_item is not None:
            sql_item.status = "succeeded"
            sql_item.columns = columns
            sql_item.row_count = len(rows)
            sql_item.truncated = truncated
            sql_item.result_bytes = result_bytes
            sql_item.duration_ms = duration_ms
            sql_item.finished_at = now
        if tool_item is not None:
            tool_item.status = "failed"
            tool_item.error_code = code[:100]
            tool_item.error_message = message[:2000]
            tool_item.finished_at = now
        await session.commit()


def register_reporting_handlers(registry: JobHandlerRegistry) -> None:
    if registry.get("dashboard_refresh") is None:
        registry.register("dashboard_refresh", run_dashboard_refresh_job)
