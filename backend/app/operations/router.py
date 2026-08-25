from __future__ import annotations

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_organization
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.errors import AppError
from app.core.redis import get_redis
from app.jobs.repository import JobRepository
from app.organizations.models import Organization, OrganizationMembership

router = APIRouter(prefix="/ops", tags=["operations"])


@router.get("/status")
async def operational_status(
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    organization, membership = context
    if membership.role not in {"owner", "admin"}:
        raise AppError("FORBIDDEN", "You do not have permission for this action.", 403)
    counts = await JobRepository(session).status_counts_for_organization(organization.id)
    try:
        queue_length = int(await redis.xlen(settings.redis_job_stream))
    except Exception:
        queue_length = -1
    return {
        "jobs": counts,
        "queue_stream_length": queue_length,
        "limits": {
            "active_jobs_per_user": settings.max_active_jobs_per_user,
            "active_jobs_per_organization": settings.max_active_jobs_per_organization,
            "worker_concurrency": settings.worker_concurrency,
            "query_timeout_seconds": settings.agent_query_timeout_seconds,
            "result_max_rows": settings.agent_result_max_rows,
            "result_max_bytes": settings.agent_result_max_bytes,
        },
    }
