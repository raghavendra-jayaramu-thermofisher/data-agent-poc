from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


_FORBIDDEN_MODEL_SETTINGS = {
    "api_key",
    "authorization",
    "headers",
    "base_url",
    "model",
    "messages",
    "tools",
    "tool_choice",
}


class ModelConnectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=180)
    base_url: str = Field(min_length=1, max_length=2048)
    api_key: SecretStr | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Connection name is required")
        return cleaned

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and not value.get_secret_value():
            raise ValueError("api_key must not be empty")
        return value

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        cleaned = value.strip().rstrip("/")
        parsed = urlparse(cleaned)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("base_url must be an absolute HTTP(S) URL")
        if parsed.username or parsed.password:
            raise ValueError("base_url must not contain embedded credentials")
        if parsed.query or parsed.fragment:
            raise ValueError("base_url must not contain a query string or fragment")
        return cleaned


class ModelConnectionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=180)
    base_url: str | None = Field(default=None, min_length=1, max_length=2048)
    api_key: SecretStr | None = None
    clear_api_key: bool = False
    status: str | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Connection name is required")
        return cleaned

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, value: SecretStr | None) -> SecretStr | None:
        return ModelConnectionCreate.validate_api_key(value)

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return ModelConnectionCreate.validate_base_url(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is not None and value not in {"active", "disabled"}:
            raise ValueError("status must be active or disabled")
        return value


class ModelConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    base_url: str
    status: str
    has_api_key: bool = False
    last_tested_at: datetime | None
    last_error_code: str | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ModelConnectionTestResponse(BaseModel):
    ok: bool
    model_count: int
    sample_models: list[str]
    tested_at: datetime


class ModelProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connection_id: uuid.UUID
    display_name: str = Field(min_length=1, max_length=180)
    model_name: str = Field(min_length=1, max_length=255)
    settings: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    is_default: bool = False

    @field_validator("display_name", "model_name")
    @classmethod
    def strip_nonempty(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value is required")
        return cleaned

    @field_validator("settings")
    @classmethod
    def validate_settings(cls, value: dict[str, Any]) -> dict[str, Any]:
        forbidden = sorted(set(value) & _FORBIDDEN_MODEL_SETTINGS)
        if forbidden:
            raise ValueError(f"Reserved/sensitive model setting(s): {', '.join(forbidden)}")
        for key, item in value.items():
            if item is None:
                continue
            if key in {"temperature", "top_p", "frequency_penalty", "presence_penalty"} and not isinstance(item, (int, float)):
                raise ValueError(f"{key} must be numeric")
            if key in {"max_tokens", "max_completion_tokens"} and (not isinstance(item, int) or item <= 0):
                raise ValueError(f"{key} must be a positive integer")
            if key == "seed" and not isinstance(item, int):
                raise ValueError("seed must be an integer")
            if key == "stop":
                if isinstance(item, str):
                    continue
                if not isinstance(item, list) or not all(isinstance(part, str) for part in item):
                    raise ValueError("stop must be a string or list of strings")
        return value


class ModelProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connection_id: uuid.UUID | None = None
    display_name: str | None = Field(default=None, min_length=1, max_length=180)
    model_name: str | None = Field(default=None, min_length=1, max_length=255)
    settings: dict[str, Any] | None = None
    enabled: bool | None = None

    @field_validator("display_name", "model_name")
    @classmethod
    def strip_nonempty(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value is required")
        return cleaned

    @field_validator("settings")
    @classmethod
    def validate_settings(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return None if value is None else ModelProfileCreate.validate_settings(value)


class ModelProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    connection_id: uuid.UUID
    display_name: str
    model_name: str
    settings: dict[str, Any]
    is_default: bool
    enabled: bool
    created_at: datetime
    updated_at: datetime
