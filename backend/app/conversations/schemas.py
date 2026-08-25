from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConversationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=240)
    data_source_ids: list[uuid.UUID] = Field(min_length=1, max_length=10)
    model_profile_id: uuid.UUID | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("data_source_ids")
    @classmethod
    def unique_sources(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(set(value)) != len(value):
            raise ValueError("data_source_ids must not contain duplicates")
        return value


class ConversationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=240)
    model_profile_id: uuid.UUID | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    title: str | None
    created_by: uuid.UUID
    model_profile_id: uuid.UUID | None
    data_source_ids: list[uuid.UUID] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=50_000)
    model_profile_id: uuid.UUID | None = None

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message content is required")
        return cleaned


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    job_id: uuid.UUID | None
    metadata: dict[str, object] = Field(validation_alias="metadata_json")
    created_at: datetime


class MessageAcceptedResponse(BaseModel):
    message_id: uuid.UUID
    job_id: uuid.UUID


class ConversationDetailResponse(ConversationResponse):
    messages: list[MessageResponse] = Field(default_factory=list)
