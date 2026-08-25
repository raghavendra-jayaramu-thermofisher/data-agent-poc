from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.repository import AgentExecutionRepository
from app.agent.schemas import (
    JobArtifactResponse,
    JobExecutionTraceResponse,
    ModelExecutionResponse,
    SQLExecutionResponse,
    ToolExecutionResponse,
)
from app.auth.dependencies import get_current_organization
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.redis import get_redis
from app.jobs.service import JobService
from app.organizations.models import Organization, OrganizationMembership

router = APIRouter(prefix="/jobs", tags=["job execution"])


@router.get("/{job_id}/execution", response_model=JobExecutionTraceResponse)
async def get_job_execution_trace(
    job_id: uuid.UUID,
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> JobExecutionTraceResponse:
    organization, _ = context
    # Authorization is against the durable job's organization before exposing any trace rows.
    await JobService(session, get_redis(), settings).get_for_org(job_id, organization.id)
    repo = AgentExecutionRepository(session)
    return JobExecutionTraceResponse(
        tools=[ToolExecutionResponse.model_validate(item) for item in await repo.list_tools(job_id)],
        sql=[SQLExecutionResponse.model_validate(item) for item in await repo.list_sql(job_id)],
        models=[ModelExecutionResponse.model_validate(item) for item in await repo.list_model(job_id)],
        artifacts=[JobArtifactResponse.model_validate(item) for item in await repo.list_artifacts(job_id)],
    )
