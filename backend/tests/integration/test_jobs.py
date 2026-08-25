from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.auth.repository import AuthRepository
from app.core.config import get_settings
from app.core.database import get_session_factory
from app.core.redis import get_redis
from app.jobs.handlers import JobHandlerRegistry
from app.jobs.queue import RedisJobQueue
from app.jobs.service import JobService
from app.jobs.sse import stream_job_events
from app.jobs.worker import Worker
from app.organizations.repository import OrganizationRepository


async def identity(client: AsyncClient, email: str) -> tuple[dict[str, object], uuid.UUID, uuid.UUID]:
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "StrongPassword1"},
    )
    assert response.status_code == 201
    tokens = response.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    org = await client.get("/api/v1/organizations/current", headers=headers)
    assert org.status_code == 200
    org_id = uuid.UUID(org.json()["id"])
    async with get_session_factory()() as session:
        user = await AuthRepository(session).get_user_by_email(email)
        assert user is not None
        user_id = user.id
    return tokens, user_id, org_id


@pytest.mark.asyncio
async def test_job_access_cancel_and_event_replay(client: AsyncClient) -> None:
    first, user_id, org_id = await identity(client, "jobs@example.com")
    second, _, second_org_id = await identity(client, "other@example.com")
    settings = get_settings()
    redis = get_redis()

    async with get_session_factory()() as session:
        service = JobService(session, redis, settings)
        job = await service.create_job(
            organization_id=org_id,
            requested_by=user_id,
            job_type="test_job",
            input_data={"hello": "world"},
        )
        await service.append_event(job.id, "test.progress", {"step": 1})

    first_headers = {"Authorization": f"Bearer {first['access_token']}"}
    get_job = await client.get(f"/api/v1/jobs/{job.id}", headers=first_headers)
    assert get_job.status_code == 200
    assert get_job.json()["status"] == "queued"

    second_headers = {
        "Authorization": f"Bearer {second['access_token']}",
        "X-Organization-ID": str(second_org_id),
    }
    hidden = await client.get(f"/api/v1/jobs/{job.id}", headers=second_headers)
    assert hidden.status_code == 404
    hidden_events = await client.get(f"/api/v1/jobs/{job.id}/events", headers=second_headers)
    assert hidden_events.status_code == 404

    generator = stream_job_events(
        job_id=job.id,
        organization_id=org_id,
        after_sequence=1,
        session_factory=get_session_factory(),
        redis=redis,
        settings=settings,
    )
    event = await anext(generator)
    await generator.aclose()
    assert "id: 2" in event
    assert "test.progress" in event

    cancelled = await client.post(f"/api/v1/jobs/{job.id}/cancel", headers=first_headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_redis_stream_acknowledgement(client: AsyncClient) -> None:
    _, user_id, org_id = await identity(client, "queue@example.com")
    settings = get_settings()
    redis = get_redis()
    queue = RedisJobQueue(redis, settings)
    await queue.ensure_group()

    async with get_session_factory()() as session:
        job = await JobService(session, redis, settings).create_job(
            organization_id=org_id,
            requested_by=user_id,
            job_type="queue_test",
        )

    messages = await queue.read("integration-consumer", count=1)
    assert len(messages) == 1
    assert messages[0].job_id == job.id
    await queue.ack(messages[0].message_id)
    pending = await redis.xpending(settings.redis_job_stream, settings.redis_job_group)
    assert int(pending["pending"]) == 0


@pytest.mark.asyncio
async def test_retry_then_successful_worker_ack(client: AsyncClient) -> None:
    _, user_id, org_id = await identity(client, "worker@example.com")
    settings = get_settings()
    redis = get_redis()
    queue = RedisJobQueue(redis, settings)
    await queue.ensure_group()

    attempts = 0

    async def handler(job_id: uuid.UUID) -> dict[str, object]:
        nonlocal attempts
        attempts += 1
        return {"job": str(job_id), "attempts": attempts}

    handlers = JobHandlerRegistry()
    handlers.register("worker_test", handler)

    async with get_session_factory()() as session:
        service = JobService(session, redis, settings)
        job = await service.create_job(
            organization_id=org_id,
            requested_by=user_id,
            job_type="worker_test",
        )

    message = (await queue.read("worker-test-consumer", count=1))[0]
    worker = Worker(settings, handlers)
    worker.worker_id = "worker-test-consumer"
    await worker._process_message(message)

    async with get_session_factory()() as session:
        completed = await JobService(session, redis, settings).get_for_org(job.id, org_id)
        assert completed.status == "succeeded"
        assert completed.attempt_count == 1

@pytest.mark.asyncio
async def test_retryable_failure_is_bounded_and_requeued(client: AsyncClient) -> None:
    _, user_id, org_id = await identity(client, "retry@example.com")
    settings = get_settings()
    redis = get_redis()

    async with get_session_factory()() as session:
        service = JobService(session, redis, settings)
        job = await service.create_job(
            organization_id=org_id,
            requested_by=user_id,
            job_type="retry_test",
            max_attempts=2,
        )
        claimed = await service.claim(job.id, "retry-worker")
        assert claimed is not None
        requeued = await service.fail(
            job.id,
            code="TEMPORARY_REDIS_FAILURE",
            message="Temporary infrastructure failure.",
            retryable=True,
        )
        assert requeued is True
        again = await service.claim(job.id, "retry-worker")
        assert again is not None
        requeued_again = await service.fail(
            job.id,
            code="TEMPORARY_REDIS_FAILURE",
            message="Temporary infrastructure failure.",
            retryable=True,
        )
        assert requeued_again is False
        final = await service.get_for_org(job.id, org_id)
        assert final.status == "failed"
        assert final.attempt_count == 2
