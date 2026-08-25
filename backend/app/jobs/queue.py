from __future__ import annotations

import uuid
from dataclasses import dataclass

from redis.asyncio import Redis
from redis.exceptions import ResponseError

from app.core.config import Settings


@dataclass(frozen=True, slots=True)
class QueueMessage:
    message_id: str
    job_id: uuid.UUID


class RedisJobQueue:
    def __init__(self, redis: Redis, settings: Settings) -> None:
        self.redis = redis
        self.stream = settings.redis_job_stream
        self.group = settings.redis_job_group
        self.block_ms = settings.worker_block_ms
        self.stale_idle_ms = settings.worker_stale_idle_ms

    async def ensure_group(self) -> None:
        try:
            await self.redis.xgroup_create(self.stream, self.group, id="0", mkstream=True)
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def enqueue(self, job_id: uuid.UUID) -> str:
        return str(await self.redis.xadd(self.stream, {"job_id": str(job_id)}))

    async def read(self, consumer: str, count: int = 1) -> list[QueueMessage]:
        response = await self.redis.xreadgroup(
            groupname=self.group,
            consumername=consumer,
            streams={self.stream: ">"},
            count=count,
            block=self.block_ms,
        )
        return self._parse(response)

    async def claim_stale(self, consumer: str, count: int = 10) -> list[QueueMessage]:
        response = await self.redis.xautoclaim(
            self.stream,
            self.group,
            consumer,
            min_idle_time=self.stale_idle_ms,
            start_id="0-0",
            count=count,
        )
        messages = response[1] if len(response) >= 2 else []
        parsed: list[QueueMessage] = []
        for message_id, fields in messages:
            job_id = fields.get("job_id")
            if job_id:
                parsed.append(QueueMessage(str(message_id), uuid.UUID(str(job_id))))
        return parsed

    async def ack(self, message_id: str) -> None:
        await self.redis.xack(self.stream, self.group, message_id)
        # Delete only after acknowledgement so the work stream does not grow forever.
        await self.redis.xdel(self.stream, message_id)

    @staticmethod
    def _parse(response: object) -> list[QueueMessage]:
        if not response:
            return []
        parsed: list[QueueMessage] = []
        for _, messages in response:  # type: ignore[union-attr]
            for message_id, fields in messages:
                job_id = fields.get("job_id")
                if job_id:
                    parsed.append(QueueMessage(str(message_id), uuid.UUID(str(job_id))))
        return parsed
