from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    role: str | None = None


class OrganizationUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
