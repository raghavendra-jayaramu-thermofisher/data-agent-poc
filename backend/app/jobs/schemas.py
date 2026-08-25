from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class JobEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sequence: int
    event_type: str
    level: str
    payload: dict[str, object]
    created_at: datetime


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    job_type: str
    status: str
    requested_by: uuid.UUID
    conversation_id: uuid.UUID | None
    input: dict[str, object]
    result: dict[str, object] | None
    attempt_count: int
    max_attempts: int
    cancel_requested_at: datetime | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
