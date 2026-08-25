from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime

from redis.asyncio import Redis


@dataclass(frozen=True, slots=True)
class LiveJobEvent:
    job_id: uuid.UUID
    sequence: int
    event_type: str
    level: str
    payload: dict[str, object]
    created_at: datetime

    def to_json(self) -> str:
        payload = asdict(self)
        payload["job_id"] = str(self.job_id)
        payload["created_at"] = self.created_at.isoformat()
        return json.dumps(payload, separators=(",", ":"), default=str)


class RedisJobEventBus:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    @staticmethod
    def channel(job_id: uuid.UUID) -> str:
        return f"dbassistant:job:{job_id}:events"

    async def publish(self, event: LiveJobEvent) -> None:
        await self.redis.publish(self.channel(event.job_id), event.to_json())
