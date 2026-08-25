from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.jobs.events import RedisJobEventBus
from app.jobs.service import JobService


def _encode_sse(*, event_id: int, event_type: str, data: dict[str, object]) -> str:
    return (
        f"id: {event_id}\n"
        f"event: {event_type}\n"
        f"data: {json.dumps(data, separators=(',', ':'), default=str)}\n\n"
    )


async def stream_job_events(
    *,
    job_id: uuid.UUID,
    organization_id: uuid.UUID,
    after_sequence: int,
    session_factory: async_sessionmaker[AsyncSession],
    redis: Redis,
    settings: Settings,
) -> AsyncIterator[str]:
    pubsub = redis.pubsub()
    await pubsub.subscribe(RedisJobEventBus.channel(job_id))
    last_sent = after_sequence
    try:
        # Subscribe before durable replay. Events created during replay are either present in
        # PostgreSQL or buffered in Pub/Sub. The DB session is closed before the long-lived
        # realtime loop, so an SSE client does not consume a PostgreSQL connection indefinitely.
        async with session_factory() as session:
            service = JobService(session, redis, settings)
            durable = await service.list_events(job_id, organization_id, after_sequence)
        for event in durable:
            last_sent = max(last_sent, event.sequence)
            yield _encode_sse(
                event_id=event.sequence,
                event_type=event.event_type,
                data={
                    "sequence": event.sequence,
                    "event_type": event.event_type,
                    "level": event.level,
                    "payload": event.payload,
                    "created_at": event.created_at.isoformat(),
                },
            )

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
            if message is None:
                yield ": keep-alive\n\n"
                await asyncio.sleep(0)
                continue
            payload = json.loads(str(message["data"]))
            sequence = int(payload["sequence"])
            if sequence <= last_sent:
                continue
            last_sent = sequence
            yield _encode_sse(
                event_id=sequence,
                event_type=str(payload["event_type"]),
                data={
                    "sequence": sequence,
                    "event_type": payload["event_type"],
                    "level": payload["level"],
                    "payload": payload["payload"],
                    "created_at": payload["created_at"],
                },
            )
    finally:
        await pubsub.unsubscribe(RedisJobEventBus.channel(job_id))
        await pubsub.aclose()
