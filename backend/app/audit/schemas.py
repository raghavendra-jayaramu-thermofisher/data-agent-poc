from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    resource_type: str
    resource_id: uuid.UUID | None
    metadata: dict[str, object] = Field(validation_alias="metadata_json")
    created_at: datetime
