from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.config import Settings
from app.core.errors import AppError
from app.models.models import ModelConnection, ModelProfile
from app.models.schemas import ModelProfileCreate
from app.models.service import ModelConfigurationService


class FakeModelRepository:
    def __init__(self, connection: ModelConnection) -> None:
        self.connection = connection
        self.profiles: list[ModelProfile] = []

    async def get_connection(self, connection_id: uuid.UUID, organization_id: uuid.UUID):
        if self.connection.id == connection_id and self.connection.organization_id == organization_id:
            return self.connection
        return None

    async def find_profile_name(self, organization_id: uuid.UUID, display_name: str):
        return next(
            (
                item
                for item in self.profiles
                if item.organization_id == organization_id and item.display_name == display_name
            ),
            None,
        )

    async def current_default(self, organization_id: uuid.UUID):
        return next(
            (item for item in self.profiles if item.organization_id == organization_id and item.is_default),
            None,
        )

    async def clear_default(self, organization_id: uuid.UUID) -> None:
        for item in self.profiles:
            if item.organization_id == organization_id:
                item.is_default = False

    def add_profile(self, item: ModelProfile) -> None:
        self.profiles.append(item)


@pytest.mark.asyncio
async def test_first_enabled_profile_becomes_default_and_explicit_disabled_default_is_rejected() -> None:
    organization_id = uuid.uuid4()
    connection = ModelConnection(
        id=uuid.uuid4(),
        organization_id=organization_id,
        name="Gateway",
        base_url="http://localhost:8000/v1",
        secret_id=None,
        status="active",
        last_tested_at=None,
        last_error_code=None,
        created_by=uuid.uuid4(),
    )
    session = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    service = ModelConfigurationService(session, Settings(_env_file=None))
    fake_repo = FakeModelRepository(connection)
    service.repo = fake_repo  # type: ignore[assignment]

    created = await service.create_profile(
        organization_id=organization_id,
        payload=ModelProfileCreate(
            connection_id=connection.id,
            display_name="Primary",
            model_name="model-a",
            settings={},
        ),
    )
    assert created.is_default is True

    with pytest.raises(AppError) as error:
        await service.create_profile(
            organization_id=organization_id,
            payload=ModelProfileCreate(
                connection_id=connection.id,
                display_name="Disabled default",
                model_name="model-b",
                enabled=False,
                is_default=True,
            ),
        )
    assert error.value.code == "MODEL_PROFILE_DEFAULT_DISABLED"

@pytest.mark.asyncio
async def test_connection_test_sets_active_without_persisting_provider_secrets(monkeypatch) -> None:
    organization_id = uuid.uuid4()
    connection = ModelConnection(
        id=uuid.uuid4(),
        organization_id=organization_id,
        name="Gateway",
        base_url="https://models.example/v1",
        secret_id=None,
        status="untested",
        last_tested_at=None,
        last_error_code=None,
        created_by=uuid.uuid4(),
    )
    session = MagicMock()
    session.commit = AsyncMock()
    service = ModelConfigurationService(session, Settings(_env_file=None))
    service.repo = FakeModelRepository(connection)  # type: ignore[assignment]

    class FakeClient:
        def __init__(self, **kwargs):
            assert kwargs["base_url"] == "https://models.example/v1"
            assert kwargs["api_key"] is None

        async def list_models(self):
            return ["model-a", "model-b"]

    monkeypatch.setattr("app.models.service.OpenAICompatibleClient", FakeClient)
    result = await service.test_connection(
        connection_id=connection.id,
        organization_id=organization_id,
    )
    assert result.ok is True
    assert result.model_count == 2
    assert connection.status == "active"
    assert connection.last_error_code is None
    # One commit releases the DB transaction before network I/O; one persists result state.
    assert session.commit.await_count == 2
