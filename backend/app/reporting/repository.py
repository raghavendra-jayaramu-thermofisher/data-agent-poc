from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.models import JobArtifact, SQLExecution, ToolExecution
from app.reporting.models import Dashboard, DashboardWidget


class ReportingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add_dashboard(self, item: Dashboard) -> None:
        self.session.add(item)

    def add_widget(self, item: DashboardWidget) -> None:
        self.session.add(item)

    async def get_dashboard_for_org(self, dashboard_id: uuid.UUID, organization_id: uuid.UUID) -> Dashboard | None:
        result = await self.session.execute(
            select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.organization_id == organization_id)
        )
        return result.scalar_one_or_none()

    async def list_dashboards(self, organization_id: uuid.UUID) -> list[tuple[Dashboard, int]]:
        result = await self.session.execute(
            select(Dashboard, func.count(DashboardWidget.id))
            .outerjoin(DashboardWidget, DashboardWidget.dashboard_id == Dashboard.id)
            .where(Dashboard.organization_id == organization_id)
            .group_by(Dashboard.id)
            .order_by(Dashboard.updated_at.desc())
        )
        return [(row[0], int(row[1])) for row in result.all()]

    async def list_widgets(self, dashboard_id: uuid.UUID) -> list[DashboardWidget]:
        result = await self.session.execute(
            select(DashboardWidget)
            .where(DashboardWidget.dashboard_id == dashboard_id)
            .order_by(DashboardWidget.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_widget_for_org(self, widget_id: uuid.UUID, organization_id: uuid.UUID) -> DashboardWidget | None:
        result = await self.session.execute(
            select(DashboardWidget)
            .join(Dashboard, Dashboard.id == DashboardWidget.dashboard_id)
            .where(DashboardWidget.id == widget_id, Dashboard.organization_id == organization_id)
        )
        return result.scalar_one_or_none()

    async def source_sql_for_job(self, sql_execution_id: uuid.UUID, job_id: uuid.UUID) -> SQLExecution | None:
        result = await self.session.execute(
            select(SQLExecution)
            .join(ToolExecution, ToolExecution.id == SQLExecution.tool_execution_id)
            .where(SQLExecution.id == sql_execution_id, ToolExecution.job_id == job_id)
        )
        return result.scalar_one_or_none()

    async def latest_artifact(self, widget: DashboardWidget) -> JobArtifact | None:
        job_id = widget.last_refresh_job_id or widget.created_from_job_id
        if job_id is None:
            return None
        result = await self.session.execute(
            select(JobArtifact)
            .where(JobArtifact.job_id == job_id)
            .order_by(JobArtifact.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
