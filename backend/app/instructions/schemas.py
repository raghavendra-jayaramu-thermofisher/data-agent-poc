from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

_COMMAND_PATTERN = re.compile(r"^[a-z0-9_-]+$")


def _normalize_command(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().lstrip("/").lower()
    if not cleaned:
        return None
    if not _COMMAND_PATTERN.match(cleaned):
        raise ValueError("Command must contain only lowercase letters, numbers, underscores, and hyphens.")
    return cleaned


class InstructionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: str | None = None
    command: str | None = None
    prompt_template: str | None = None
    content: str
    is_default: bool
    enabled: bool
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class InstructionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=500)
    command: str | None = Field(default=None, max_length=64)
    prompt_template: str | None = Field(default=None, max_length=5000)
    content: str = Field(min_length=1, max_length=20000)
    is_default: bool = False
    enabled: bool = True

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Instruction name is required.")
        return cleaned

    @field_validator("command")
    @classmethod
    def clean_command(cls, value: str | None) -> str | None:
        return _normalize_command(value)

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Instruction content is required.")
        return cleaned


class InstructionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=500)
    command: str | None = Field(default=None, max_length=64)
    prompt_template: str | None = Field(default=None, max_length=5000)
    content: str | None = Field(default=None, min_length=1, max_length=20000)
    is_default: bool | None = None
    enabled: bool | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Instruction name cannot be empty.")
        return cleaned

    @field_validator("command")
    @classmethod
    def clean_command(cls, value: str | None) -> str | None:
        return _normalize_command(value)

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Instruction content cannot be empty.")
        return cleaned
