from __future__ import annotations

from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.redis import get_redis
from app.jobs.service import JobService


def get_job_service(
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
    settings: Settings = Depends(get_settings),
) -> JobService:
    return JobService(session, redis, settings)
