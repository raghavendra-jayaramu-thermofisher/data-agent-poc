from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.html_artifacts import HTML_CONTENT_SECURITY_POLICY, HtmlArtifactStorage
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
from app.core.errors import AppError
from app.core.redis import get_redis
from app.jobs.service import JobService
from app.organizations.models import Organization, OrganizationMembership

router = APIRouter(prefix="/jobs", tags=["job execution"])


@router.get(
    "/{job_id}/artifacts/{artifact_id}/html",
    response_class=FileResponse,
    responses={200: {"content": {"text/html": {}}}},
)
async def get_html_artifact(
    job_id: uuid.UUID,
    artifact_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    """Serve a shareable POC HTML artifact; UUIDs are the public capability URL."""

    artifact = await AgentExecutionRepository(session).get_artifact_for_job(job_id, artifact_id)
    if artifact is None or artifact.kind != "html":
        raise AppError("HTML_ARTIFACT_NOT_FOUND", "HTML artifact not found.", 404)
    payload = artifact.payload
    if payload.get("schema_version") != 1 or payload.get("file_name") != "index.html":
        raise AppError("HTML_ARTIFACT_INVALID", "HTML artifact metadata is invalid.", 500)
    path = HtmlArtifactStorage(
        settings.data_directory,
        settings.agent_html_artifact_max_bytes,
    ).path_for(job_id, artifact_id)
    if not path.is_file():
        raise AppError("HTML_ARTIFACT_FILE_MISSING", "HTML artifact file is unavailable.", 404)
    return FileResponse(
        path,
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Security-Policy": HTML_CONTENT_SECURITY_POLICY,
            "Cache-Control": "public, max-age=300",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
        },
    )


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
