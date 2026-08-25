from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.jobs.models import Job, JobEvent


class JobRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, job: Job) -> None:
        self.session.add(job)

    async def get(self, job_id: uuid.UUID) -> Job | None:
        return await self.session.get(Job, job_id)

    async def get_for_organization(
        self, job_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Job | None:
        result = await self.session.execute(
            select(Job).where(Job.id == job_id, Job.organization_id == organization_id)
        )
        return result.scalar_one_or_none()


    async def list_for_organization(
        self,
        organization_id: uuid.UUID,
        *,
        status: str | None = None,
        limit: int = 50,
    ) -> list[Job]:
        statement = select(Job).where(Job.organization_id == organization_id)
        if status is not None:
            statement = statement.where(Job.status == status)
        result = await self.session.execute(
            statement.order_by(Job.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())


    async def count_active_for_user(self, organization_id: uuid.UUID, user_id: uuid.UUID) -> int:
        value = await self.session.scalar(
            select(func.count(Job.id)).where(
                Job.organization_id == organization_id,
                Job.requested_by == user_id,
                Job.status.in_(("queued", "running")),
            )
        )
        return int(value or 0)

    async def count_active_for_organization(self, organization_id: uuid.UUID) -> int:
        value = await self.session.scalar(
            select(func.count(Job.id)).where(
                Job.organization_id == organization_id,
                Job.status.in_(("queued", "running")),
            )
        )
        return int(value or 0)

    async def status_counts_for_organization(self, organization_id: uuid.UUID) -> dict[str, int]:
        result = await self.session.execute(
            select(Job.status, func.count(Job.id))
            .where(Job.organization_id == organization_id)
            .group_by(Job.status)
        )
        return {str(status): int(count) for status, count in result.all()}

    async def lock(self, job_id: uuid.UUID) -> Job | None:
        result = await self.session.execute(select(Job).where(Job.id == job_id).with_for_update())
        return result.scalar_one_or_none()

    async def lock_for_organization(
        self, job_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Job | None:
        result = await self.session.execute(
            select(Job)
            .where(Job.id == job_id, Job.organization_id == organization_id)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def next_sequence(self, job_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.max(JobEvent.sequence), 0)).where(JobEvent.job_id == job_id)
        )
        return int(result.scalar_one()) + 1

    def add_event(self, event: JobEvent) -> None:
        self.session.add(event)

    async def list_events(self, job_id: uuid.UUID, after_sequence: int = 0) -> list[JobEvent]:
        result = await self.session.execute(
            select(JobEvent)
            .where(JobEvent.job_id == job_id, JobEvent.sequence > after_sequence)
            .order_by(JobEvent.sequence.asc())
        )
        return list(result.scalars().all())

    async def list_stale_running(self, before: datetime, limit: int = 100) -> list[Job]:
        result = await self.session.execute(
            select(Job)
            .where(
                Job.status == "running",
                Job.lease_expires_at.is_not(None),
                Job.lease_expires_at < before,
            )
            .order_by(Job.lease_expires_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())
