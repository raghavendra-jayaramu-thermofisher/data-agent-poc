from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.models.schemas import (
    ModelConnectionCreate,
    ModelConnectionUpdate,
    ModelProfileCreate,
)


def test_connection_normalizes_openai_compatible_base_url_and_hides_key() -> None:
    payload = ModelConnectionCreate(
        name=" Local Gateway ",
        base_url="http://localhost:8000/v1/",
        api_key="secret-key",
    )
    assert payload.name == "Local Gateway"
    assert payload.base_url == "http://localhost:8000/v1"
    assert "secret-key" not in repr(payload)


def test_connection_rejects_embedded_url_credentials() -> None:
    with pytest.raises(ValidationError):
        ModelConnectionCreate(
            name="Bad",
            base_url="https://user:password@example.com/v1",
            api_key="secret-key",
        )


def test_update_only_allows_user_controlled_connection_statuses() -> None:
    assert ModelConnectionUpdate(status="disabled").status == "disabled"
    with pytest.raises(ValidationError):
        ModelConnectionUpdate(status="error")


def test_profile_settings_validate_common_fields_and_allow_provider_specific_generation_options() -> None:
    profile = ModelProfileCreate(
        connection_id=uuid.uuid4(),
        display_name="Fast model",
        model_name="gpt-compatible",
        settings={"temperature": 0.2, "max_tokens": 500, "seed": 7, "reasoning_effort": "medium"},
    )
    assert profile.settings["max_tokens"] == 500
    assert profile.settings["reasoning_effort"] == "medium"

    with pytest.raises(ValidationError):
        ModelProfileCreate(
            connection_id=uuid.uuid4(),
            display_name="Bad",
            model_name="bad",
            settings={"api_key": "must-not-be-here"},
        )


def test_disabled_profile_cannot_be_explicitly_declared_default_at_schema_level_only_service_enforces() -> None:
    payload = ModelProfileCreate(
        connection_id=uuid.uuid4(),
        display_name="Disabled",
        model_name="model",
        enabled=False,
        is_default=True,
    )
    assert payload.is_default is True
    assert payload.enabled is False


def test_connection_rejects_empty_key_and_query_string_in_api_root() -> None:
    with pytest.raises(ValidationError):
        ModelConnectionCreate(
            name="Empty key",
            base_url="https://example.com/v1",
            api_key="",
        )
    with pytest.raises(ValidationError):
        ModelConnectionCreate(
            name="Query root",
            base_url="https://example.com/v1?token=unsafe",
            api_key=None,
        )
    with pytest.raises(ValidationError):
        ModelConnectionUpdate(api_key="")
