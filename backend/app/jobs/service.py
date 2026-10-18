from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.conversations.models import Conversation
from app.core.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.jobs.events import LiveJobEvent, RedisJobEventBus
from app.jobs.models import Job, JobEvent
from app.jobs.queue import RedisJobQueue
from app.jobs.repository import JobRepository
from app.jobs.state import TERMINAL_STATUSES, assert_transition
from app.organizations.models import Organization

logger = logging.getLogger(__name__)


class JobDeferredError(Exception):
    """An accepted question is waiting for an earlier turn in its conversation."""


class JobService:
    def __init__(self, session: AsyncSession, redis: Redis, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.repo = JobRepository(session)
        self.queue = RedisJobQueue(redis, settings)
        self.event_bus = RedisJobEventBus(redis)

    async def create_job(
        self,
        *,
        organization_id: uuid.UUID,
        requested_by: uuid.UUID,
        job_type: str,
        input_data: dict[str, object] | None = None,
        max_attempts: int | None = None,
        conversation_id: uuid.UUID | None = None,
    ) -> Job:
        # Serialize active-limit checks per organization so multiple API replicas cannot race past
        # the configured workspace/user concurrency caps. The internal control DB is PostgreSQL.
        await self.session.execute(
            select(Organization.id).where(Organization.id == organization_id).with_for_update()
        )
        active_user = await self.repo.count_active_for_user(organization_id, requested_by)
        if active_user >= self.settings.max_active_jobs_per_user:
            raise AppError(
                "USER_ACTIVE_JOB_LIMIT_REACHED",
                "You already have the maximum number of active jobs.",
                429,
            )
        active_org = await self.repo.count_active_for_organization(organization_id)
        if active_org >= self.settings.max_active_jobs_per_organization:
            raise AppError(
                "ORGANIZATION_ACTIVE_JOB_LIMIT_REACHED",
                "This workspace already has the maximum number of active jobs.",
                429,
            )
        now = utc_now()
        job = Job(
            organization_id=organization_id,
            requested_by=requested_by,
            job_type=job_type,
            status="queued",
            conversation_id=conversation_id,
            input=input_data or {},
            attempt_count=0,
            max_attempts=max_attempts or self.settings.job_max_attempts,
            created_at=now,
        )
        self.repo.add(job)
        await self.session.flush()
        event = await self._append_event_locked(job, "job.queued", {"job_type": job_type})
        await self.session.commit()
        await self.queue.enqueue(job.id)
        await self._publish_safely(event)
        return job

    async def list_for_org(
        self, organization_id: uuid.UUID, *, status: str | None = None, limit: int = 50
    ) -> list[tuple[Job, datetime | None, datetime | None]]:
        if status is not None and status not in {
            "queued", "running", "succeeded", "failed", "cancelled"
        }:
            raise AppError("INVALID_JOB_STATUS", "Invalid job status filter.", 400)
        return await self.repo.list_for_organization(
            organization_id, status=status, limit=limit
        )

    async def get_for_org(self, job_id: uuid.UUID, organization_id: uuid.UUID) -> Job:
        job = await self.repo.get_for_organization(job_id, organization_id)
        if job is None:
            raise AppError("JOB_NOT_FOUND", "Job not found.", 404)
        return job

    async def list_events(
        self, job_id: uuid.UUID, organization_id: uuid.UUID, after_sequence: int = 0
    ) -> list[JobEvent]:
        await self.get_for_org(job_id, organization_id)
        return await self.repo.list_events(job_id, after_sequence)

    async def request_cancel(self, job_id: uuid.UUID, organization_id: uuid.UUID) -> Job:
        job = await self.repo.lock_for_organization(job_id, organization_id)
        if job is None:
            raise AppError("JOB_NOT_FOUND", "Job not found.", 404)
        if job.status in TERMINAL_STATUSES:
            await self.session.rollback()
            return job
        now = utc_now()
        job.cancel_requested_at = now
        if job.status == "queued":
            assert_transition(job.status, "cancelled")
            job.status = "cancelled"
            job.finished_at = now
            event = await self._append_event_locked(job, "job.cancelled", {})
        else:
            event = await self._append_event_locked(job, "job.cancel_requested", {})
        await self.session.commit()
        await self._publish_safely(event)
        return job

    async def claim(self, job_id: uuid.UUID, worker_id: str) -> Job | None:
        snapshot = await self.repo.get(job_id)
        if snapshot and snapshot.job_type == "chat_query" and snapshot.conversation_id:
            # All workers take the conversation lock before the job lock. No lock is
            # held while analysis runs; the persisted running status gates later turns.
            await self.session.execute(
                select(Conversation.id).where(
                    Conversation.id == snapshot.conversation_id
                ).with_for_update()
            )
        job = await self.repo.lock(job_id)
        if job is None:
            await self.session.rollback()
            return None
        now = utc_now()
        if job.status in TERMINAL_STATUSES:
            await self.session.rollback()
            return None
        if job.cancel_requested_at is not None:
            if job.status != "cancelled":
                assert_transition(job.status, "cancelled")
                job.status = "cancelled"
                job.finished_at = now
                event = await self._append_event_locked(job, "job.cancelled", {})
                await self.session.commit()
                await self._publish_safely(event)
            return None
        if job.status == "running" and job.lease_expires_at and job.lease_expires_at > now:
            await self.session.rollback()
            return None
        if (
            job.job_type == "chat_query"
            and job.conversation_id
            and await self.repo.has_earlier_chat(job)
        ):
            await self.session.rollback()
            raise JobDeferredError()
        if job.status == "running":
            assert_transition("running", "queued")
            job.status = "queued"
        assert_transition(job.status, "running")
        job.status = "running"
        job.claimed_by = worker_id
        job.lease_expires_at = now + timedelta(seconds=self.settings.worker_lease_seconds)
        job.attempt_count += 1
        if job.started_at is None:
            job.started_at = now
        event = await self._append_event_locked(
            job, "job.started", {"attempt": job.attempt_count, "worker_id": worker_id}
        )
        await self.session.commit()
        await self._publish_safely(event)
        return job

    async def heartbeat(self, job_id: uuid.UUID, worker_id: str) -> bool:
        job = await self.repo.lock(job_id)
        if job is None or job.status != "running" or job.claimed_by != worker_id:
            await self.session.rollback()
            return False
        job.lease_expires_at = utc_now() + timedelta(seconds=self.settings.worker_lease_seconds)
        await self.session.commit()
        return True

    async def is_cancel_requested(self, job_id: uuid.UUID) -> bool:
        job = await self.repo.get(job_id)
        return bool(job and job.cancel_requested_at is not None)

    async def complete(self, job_id: uuid.UUID, result: dict[str, object] | None) -> None:
        job = await self.repo.lock(job_id)
        if job is None:
            raise AppError("JOB_NOT_FOUND", "Job not found.", 404)
        if job.cancel_requested_at is not None:
            await self._finish_cancelled(job)
            return
        assert_transition(job.status, "succeeded")
        job.status = "succeeded"
        job.result = result
        job.finished_at = utc_now()
        job.lease_expires_at = None
        event = await self._append_event_locked(job, "job.completed", {})
        await self.session.commit()
        await self._publish_safely(event)

    async def fail(
        self,
        job_id: uuid.UUID,
        *,
        code: str,
        message: str,
        retryable: bool,
    ) -> bool:
        job = await self.repo.lock(job_id)
        if job is None:
            return False
        if job.cancel_requested_at is not None:
            await self._finish_cancelled(job)
            return False
        now = utc_now()
        if retryable and job.attempt_count < job.max_attempts:
            assert_transition(job.status, "queued")
            job.status = "queued"
            job.claimed_by = None
            job.lease_expires_at = None
            event = await self._append_event_locked(
                job,
                "job.retry_scheduled",
                {"attempt": job.attempt_count, "max_attempts": job.max_attempts},
                level="warning",
            )
            await self.session.commit()
            await self.queue.enqueue(job.id)
            await self._publish_safely(event)
            return True
        assert_transition(job.status, "failed")
        job.status = "failed"
        job.error_code = code[:100]
        job.error_message = message[:2000]
        job.finished_at = now
        job.lease_expires_at = None
        event = await self._append_event_locked(
            job, "job.failed", {"code": job.error_code}, level="error"
        )
        await self.session.commit()
        await self._publish_safely(event)
        return False

    async def recover_abandoned_jobs(self, *, before, limit: int = 100) -> int:
        """Requeue jobs whose worker lease expired. Duplicate Redis deliveries are harmless.

        PostgreSQL remains authoritative; the claim transition prevents two workers from owning the
        same live lease even when a stale stream entry and a recovery enqueue both exist.
        """
        rows = await self.repo.list_stale_running(before, limit=limit)
        recovered = 0
        for candidate in rows:
            job = await self.repo.lock(candidate.id)
            if (
                job is None
                or job.status != "running"
                or job.lease_expires_at is None
                or job.lease_expires_at >= before
            ):
                continue
            assert_transition("running", "queued")
            job.status = "queued"
            job.claimed_by = None
            job.lease_expires_at = None
            event = await self._append_event_locked(
                job, "job.recovered", {"reason": "expired_worker_lease"}
            )
            await self.session.commit()
            await self.queue.enqueue(job.id)
            await self._publish_safely(event)
            recovered += 1
        return recovered

    async def append_event(
        self,
        job_id: uuid.UUID,
        event_type: str,
        payload: dict[str, object] | None = None,
        *,
        level: str = "info",
    ) -> JobEvent:
        job = await self.repo.lock(job_id)
        if job is None:
            raise AppError("JOB_NOT_FOUND", "Job not found.", 404)
        event = await self._append_event_locked(job, event_type, payload or {}, level=level)
        await self.session.commit()
        await self._publish_safely(event)
        return event

    async def _finish_cancelled(self, job: Job) -> None:
        if job.status not in TERMINAL_STATUSES:
            assert_transition(job.status, "cancelled")
            job.status = "cancelled"
            job.finished_at = utc_now()
            job.lease_expires_at = None
            event = await self._append_event_locked(job, "job.cancelled", {})
            await self.session.commit()
            await self._publish_safely(event)

    async def _append_event_locked(
        self,
        job: Job,
        event_type: str,
        payload: dict[str, object],
        *,
        level: str = "info",
    ) -> JobEvent:
        sequence = await self.repo.next_sequence(job.id)
        event = JobEvent(
            job_id=job.id,
            sequence=sequence,
            event_type=event_type,
            level=level,
            payload=payload,
            created_at=utc_now(),
        )
        self.repo.add_event(event)
        await self.session.flush()
        return event

    async def _publish_safely(self, event: JobEvent) -> None:
        try:
            await self.event_bus.publish(
                LiveJobEvent(
                    job_id=event.job_id,
                    sequence=event.sequence,
                    event_type=event.event_type,
                    level=event.level,
                    payload=event.payload,
                    created_at=event.created_at,
                )
            )
        except Exception:
            # PostgreSQL is authoritative. A transient realtime publish failure must not roll back
            # already committed job state; clients can recover via durable SSE replay.
            logger.exception("job_event_realtime_publish_failed", extra={"job_id": str(event.job_id)})
