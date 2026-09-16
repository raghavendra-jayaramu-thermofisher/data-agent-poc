from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.models import JobArtifact, ModelExecution, SQLExecution, ToolExecution


class AgentExecutionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add_tool(self, item: ToolExecution) -> None:
        self.session.add(item)

    def add_sql(self, item: SQLExecution) -> None:
        self.session.add(item)

    def add_model(self, item: ModelExecution) -> None:
        self.session.add(item)

    def add_artifact(self, item: JobArtifact) -> None:
        self.session.add(item)

    async def next_tool_sequence(self, job_id: uuid.UUID) -> int:
        value = await self.session.scalar(
            select(func.coalesce(func.max(ToolExecution.sequence), 0)).where(ToolExecution.job_id == job_id)
        )
        return int(value or 0) + 1

    async def next_model_sequence(self, job_id: uuid.UUID) -> int:
        value = await self.session.scalar(
            select(func.coalesce(func.max(ModelExecution.sequence), 0)).where(ModelExecution.job_id == job_id)
        )
        return int(value or 0) + 1


    async def count_tools(self, job_id: uuid.UUID, *, tool_name: str | None = None) -> int:
        statement = select(func.count(ToolExecution.id)).where(ToolExecution.job_id == job_id)
        if tool_name is not None:
            statement = statement.where(ToolExecution.tool_name == tool_name)
        value = await self.session.scalar(statement)
        return int(value or 0)

    async def get_sql_for_job(
        self, sql_execution_id: uuid.UUID, job_id: uuid.UUID
    ) -> SQLExecution | None:
        result = await self.session.execute(
            select(SQLExecution)
            .join(ToolExecution, ToolExecution.id == SQLExecution.tool_execution_id)
            .where(SQLExecution.id == sql_execution_id, ToolExecution.job_id == job_id)
        )
        return result.scalar_one_or_none()

    async def get_table_artifact_for_sql(
        self, job_id: uuid.UUID, sql_execution_id: uuid.UUID
    ) -> JobArtifact | None:
        result = await self.session.execute(
            select(JobArtifact)
            .where(
                JobArtifact.job_id == job_id,
                JobArtifact.kind == "table",
                JobArtifact.source_sql_execution_id == sql_execution_id,
            )
            .order_by(JobArtifact.created_at.asc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_tools(self, job_id: uuid.UUID) -> list[ToolExecution]:
        result = await self.session.execute(
            select(ToolExecution)
            .where(ToolExecution.job_id == job_id)
            .order_by(ToolExecution.sequence.asc())
        )
        return list(result.scalars().all())

    async def list_sql(self, job_id: uuid.UUID) -> list[SQLExecution]:
        result = await self.session.execute(
            select(SQLExecution)
            .join(ToolExecution, ToolExecution.id == SQLExecution.tool_execution_id)
            .where(ToolExecution.job_id == job_id)
            .order_by(ToolExecution.sequence.asc())
        )
        return list(result.scalars().all())

    async def list_model(self, job_id: uuid.UUID) -> list[ModelExecution]:
        result = await self.session.execute(
            select(ModelExecution)
            .where(ModelExecution.job_id == job_id)
            .order_by(ModelExecution.sequence.asc())
        )
        return list(result.scalars().all())

    async def list_artifacts(self, job_id: uuid.UUID) -> list[JobArtifact]:
        result = await self.session.execute(
            select(JobArtifact)
            .where(JobArtifact.job_id == job_id)
            .order_by(JobArtifact.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_artifact_for_job(
        self, job_id: uuid.UUID, artifact_id: uuid.UUID
    ) -> JobArtifact | None:
        result = await self.session.execute(
            select(JobArtifact).where(
                JobArtifact.job_id == job_id,
                JobArtifact.id == artifact_id,
            )
        )
        return result.scalar_one_or_none()
