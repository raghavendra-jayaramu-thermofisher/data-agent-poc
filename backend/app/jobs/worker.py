from __future__ import annotations

import asyncio
import logging
import os
import socket
import uuid

from app.core.config import Settings
from app.core.database import get_session_factory
from app.core.redis import get_redis
from app.jobs.handlers import JobHandlerRegistry, registry
from app.jobs.queue import QueueMessage, RedisJobQueue
from app.jobs.service import JobService

logger = logging.getLogger(__name__)


class RetryableJobError(Exception):
    """A handler may raise this only for transient infrastructure failures."""


class JobFailureError(Exception):
    """A handler may raise a sanitized, machine-readable job failure."""

    def __init__(self, code: str, message: str, *, retryable: bool = False) -> None:
        self.code = code
        self.public_message = message
        self.retryable = retryable
        super().__init__(message)


class Worker:
    def __init__(self, settings: Settings, handlers: JobHandlerRegistry = registry) -> None:
        self.settings = settings
        self.handlers = handlers
        self.redis = get_redis()
        self.queue = RedisJobQueue(self.redis, settings)
        self.worker_id = settings.worker_id or self._default_worker_id()
        self._stop = asyncio.Event()

    @staticmethod
    def _default_worker_id() -> str:
        return f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"

    async def run(self) -> None:
        await self.queue.ensure_group()
        logger.info(
            "worker_started",
            extra={"worker_id": self.worker_id, "concurrency": self.settings.worker_concurrency},
        )
        active: set[asyncio.Task[None]] = set()
        try:
            while not self._stop.is_set():
                finished = {task for task in active if task.done()}
                if finished:
                    active.difference_update(finished)
                    await asyncio.gather(*finished, return_exceptions=True)

                capacity = self.settings.worker_concurrency - len(active)
                if capacity <= 0:
                    done, _ = await asyncio.wait(active, return_when=asyncio.FIRST_COMPLETED)
                    active.difference_update(done)
                    await asyncio.gather(*done, return_exceptions=True)
                    continue

                stale = await self.queue.claim_stale(self.worker_id, count=capacity)
                messages = stale or await self.queue.read(self.worker_id, count=capacity)
                for message in messages:
                    active.add(asyncio.create_task(self._process_message(message)))
        finally:
            if active:
                await asyncio.gather(*active, return_exceptions=True)

    def stop(self) -> None:
        self._stop.set()

    async def _process_message(self, message: QueueMessage) -> None:
        session_factory = get_session_factory()
        # Claim and persist ownership in a short-lived DB session. Do not hold a PostgreSQL
        # transaction/session while the potentially long handler talks to external systems.
        try:
            async with session_factory() as session:
                service = JobService(session, self.redis, self.settings)
                job = await service.claim(message.job_id, self.worker_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            # An unhandled exception here must not leave the message permanently unacked and
            # silently retried forever (asyncio.gather(..., return_exceptions=True) in run()
            # would otherwise discard it without a trace).
            logger.exception("job_claim_failed", extra={"job_id": str(message.job_id)})
            try:
                async with session_factory() as session:
                    await JobService(session, self.redis, self.settings).fail(
                        message.job_id,
                        code="JOB_CLAIM_FAILED",
                        message="The job failed unexpectedly while being claimed.",
                        retryable=False,
                    )
            except Exception:
                logger.exception(
                    "job_claim_failure_record_failed", extra={"job_id": str(message.job_id)}
                )
            await self.queue.ack(message.message_id)
            return
        if job is None:
            await self.queue.ack(message.message_id)
            return

        handler = self.handlers.get(job.job_type)
        if handler is None:
            async with session_factory() as session:
                await JobService(session, self.redis, self.settings).fail(
                    job.id,
                    code="JOB_HANDLER_NOT_REGISTERED",
                    message="No worker handler is registered for this job type.",
                    retryable=False,
                )
            await self.queue.ack(message.message_id)
            return

        heartbeat_task = asyncio.create_task(self._heartbeat(job.id))
        try:
            result = await handler(job.id)
            async with session_factory() as session:
                await JobService(session, self.redis, self.settings).complete(job.id, result)
            await self.queue.ack(message.message_id)
        except JobFailureError as exc:
            async with session_factory() as session:
                await JobService(session, self.redis, self.settings).fail(
                    job.id,
                    code=exc.code,
                    message=exc.public_message,
                    retryable=exc.retryable,
                )
            await self.queue.ack(message.message_id)
        except RetryableJobError as exc:
            async with session_factory() as session:
                await JobService(session, self.redis, self.settings).fail(
                    job.id,
                    code="TRANSIENT_JOB_FAILURE",
                    message=str(exc) or "Transient job failure.",
                    retryable=True,
                )
            await self.queue.ack(message.message_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("job_handler_failed", extra={"job_id": str(job.id)})
            async with session_factory() as session:
                await JobService(session, self.redis, self.settings).fail(
                    job.id,
                    code="JOB_EXECUTION_FAILED",
                    message="The job failed unexpectedly.",
                    retryable=False,
                )
            await self.queue.ack(message.message_id)
        finally:
            heartbeat_task.cancel()
            await asyncio.gather(heartbeat_task, return_exceptions=True)

    async def _heartbeat(self, job_id: uuid.UUID) -> None:
        session_factory = get_session_factory()
        while True:
            await asyncio.sleep(self.settings.worker_heartbeat_seconds)
            async with session_factory() as session:
                service = JobService(session, self.redis, self.settings)
                alive = await service.heartbeat(job_id, self.worker_id)
                if not alive:
                    return
