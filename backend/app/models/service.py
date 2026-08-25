from __future__ import annotations

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.models.client import ModelRuntimeConfiguration, OpenAICompatibleClient
from app.models.errors import ModelProviderError
from app.models.models import ModelConnection, ModelProfile
from app.models.repository import ModelRepository
from app.models.schemas import (
    ModelConnectionCreate,
    ModelConnectionResponse,
    ModelConnectionTestResponse,
    ModelConnectionUpdate,
    ModelProfileCreate,
    ModelProfileUpdate,
)
from app.secrets.service import SecretRepository, SecretService


class ModelConfigurationService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.repo = ModelRepository(session)
        self.secrets = SecretService(session, settings)
        self.secret_repo = SecretRepository(session)

    async def create_connection(
        self,
        *,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: ModelConnectionCreate,
    ) -> ModelConnection:
        await self._ensure_connection_name(organization_id, payload.name)
        secret_id: uuid.UUID | None = None
        if payload.api_key is not None and payload.api_key.get_secret_value():
            secret = await self.secrets.create(
                organization_id=organization_id,
                purpose="model_api_key",
                payload={"api_key": payload.api_key.get_secret_value()},
            )
            secret_id = secret.id
        connection = ModelConnection(
            organization_id=organization_id,
            name=payload.name,
            base_url=payload.base_url,
            secret_id=secret_id,
            status="untested",
            last_tested_at=None,
            last_error_code=None,
            created_by=user_id,
        )
        self.repo.add_connection(connection)
        await self._commit_duplicate("MODEL_CONNECTION_NAME_EXISTS", "A model connection with this name already exists.")
        return connection

    async def list_connections(self, organization_id: uuid.UUID) -> list[ModelConnection]:
        return await self.repo.list_connections(organization_id)

    async def require_connection(self, connection_id: uuid.UUID, organization_id: uuid.UUID) -> ModelConnection:
        item = await self.repo.get_connection(connection_id, organization_id)
        if item is None:
            raise AppError("MODEL_CONNECTION_NOT_FOUND", "Model connection not found.", 404)
        return item

    async def connection_response(self, item: ModelConnection) -> ModelConnectionResponse:
        response = ModelConnectionResponse.model_validate(item)
        response.has_api_key = item.secret_id is not None
        return response

    async def update_connection(
        self,
        *,
        connection_id: uuid.UUID,
        organization_id: uuid.UUID,
        payload: ModelConnectionUpdate,
    ) -> ModelConnection:
        item = await self.require_connection(connection_id, organization_id)
        if payload.name is not None and payload.name != item.name:
            await self._ensure_connection_name(organization_id, payload.name, exclude_id=item.id)
            item.name = payload.name
        if payload.base_url is not None and payload.base_url != item.base_url:
            item.base_url = payload.base_url
            item.status = "untested"
            item.last_tested_at = None
            item.last_error_code = None
        if payload.api_key is not None and payload.clear_api_key:
            raise AppError(
                "MODEL_CONNECTION_CREDENTIAL_CONFLICT",
                "Provide a replacement API key or clear the API key, not both.",
                400,
            )
        if payload.api_key is not None:
            value = payload.api_key.get_secret_value()
            if item.secret_id is None:
                secret = await self.secrets.create(
                    organization_id=organization_id,
                    purpose="model_api_key",
                    payload={"api_key": value},
                )
                item.secret_id = secret.id
            else:
                secret = await self.secret_repo.get_for_org(item.secret_id, organization_id)
                if secret is None:
                    raise AppError("SECRET_NOT_FOUND", "Stored credentials are unavailable.", 500)
                await self.secrets.replace(secret, {"api_key": value})
            item.status = "untested"
            item.last_tested_at = None
            item.last_error_code = None
        elif payload.clear_api_key and item.secret_id is not None:
            secret = await self.secret_repo.get_for_org(item.secret_id, organization_id)
            if secret is not None:
                await self.secret_repo.delete(secret)
            item.secret_id = None
            item.status = "untested"
            item.last_tested_at = None
            item.last_error_code = None

        if payload.status is not None:
            if payload.status == "disabled":
                item.status = "disabled"
                for profile in await self.repo.profiles_for_connection(item.id):
                    profile.is_default = False
                await self._promote_default(organization_id)
            elif payload.status == "active":
                # Re-enabling does not claim the provider was re-tested.
                if item.status in {"disabled", "error"}:
                    item.status = "untested"
                await self._promote_default(organization_id)

        try:
            await self.session.commit()
            await self.session.refresh(item)
        except IntegrityError as exc:
            await self.session.rollback()
            raise AppError(
                "MODEL_CONNECTION_NAME_EXISTS",
                "A model connection with this name already exists.",
                409,
            ) from exc
        return item

    async def delete_connection(self, *, connection_id: uuid.UUID, organization_id: uuid.UUID) -> None:
        item = await self.require_connection(connection_id, organization_id)
        profiles = await self.repo.profiles_for_connection(item.id)
        removed_default = any(profile.is_default for profile in profiles)
        secret = None
        if item.secret_id is not None:
            secret = await self.secret_repo.get_for_org(item.secret_id, organization_id)
        await self.session.delete(item)
        await self.session.flush()
        if secret is not None:
            await self.secret_repo.delete(secret)
        if removed_default:
            await self._promote_default(organization_id)
        await self.session.commit()

    async def test_connection(
        self, *, connection_id: uuid.UUID, organization_id: uuid.UUID
    ) -> ModelConnectionTestResponse:
        item = await self.require_connection(connection_id, organization_id)
        if item.status == "disabled":
            raise AppError("MODEL_CONNECTION_DISABLED", "Model connection is disabled.", 409)
        api_key = await self._api_key(item)
        # Release the database connection/transaction before potentially slow provider network I/O.
        # The ORM objects remain usable because the application session factory uses expire_on_commit=False.
        await self.session.commit()
        client = OpenAICompatibleClient(
            base_url=item.base_url,
            api_key=api_key,
            timeout_seconds=float(self.settings.model_provider_timeout_seconds),
        )
        tested_at = utc_now()
        try:
            models = await client.list_models()
        except ModelProviderError as exc:
            item.status = "error"
            item.last_tested_at = tested_at
            item.last_error_code = exc.code
            await self.session.commit()
            raise AppError(exc.code, exc.public_message, 502) from exc

        item.status = "active"
        item.last_tested_at = tested_at
        item.last_error_code = None
        await self.session.commit()
        return ModelConnectionTestResponse(
            ok=True,
            model_count=len(models),
            sample_models=models[:10],
            tested_at=tested_at,
        )

    async def create_profile(
        self,
        *,
        organization_id: uuid.UUID,
        payload: ModelProfileCreate,
    ) -> ModelProfile:
        connection = await self.require_connection(payload.connection_id, organization_id)
        if connection.status == "disabled":
            raise AppError("MODEL_CONNECTION_DISABLED", "Model connection is disabled.", 409)
        await self._ensure_profile_name(organization_id, payload.display_name)
        current_default = await self.repo.current_default(organization_id)
        make_default = payload.is_default or (payload.enabled and current_default is None)
        if make_default and not payload.enabled:
            raise AppError("MODEL_PROFILE_DEFAULT_DISABLED", "A disabled model profile cannot be default.", 400)
        if make_default:
            await self.repo.clear_default(organization_id)
        profile = ModelProfile(
            organization_id=organization_id,
            connection_id=connection.id,
            display_name=payload.display_name,
            model_name=payload.model_name,
            settings=payload.settings,
            enabled=payload.enabled,
            is_default=make_default,
        )
        self.repo.add_profile(profile)
        await self._commit_duplicate("MODEL_PROFILE_NAME_EXISTS", "A model profile with this name already exists.")
        return profile

    async def list_profiles(self, organization_id: uuid.UUID) -> list[ModelProfile]:
        return await self.repo.list_profiles(organization_id)

    async def require_profile(self, profile_id: uuid.UUID, organization_id: uuid.UUID) -> ModelProfile:
        item = await self.repo.get_profile(profile_id, organization_id)
        if item is None:
            raise AppError("MODEL_PROFILE_NOT_FOUND", "Model profile not found.", 404)
        return item

    async def update_profile(
        self,
        *,
        profile_id: uuid.UUID,
        organization_id: uuid.UUID,
        payload: ModelProfileUpdate,
    ) -> ModelProfile:
        item = await self.require_profile(profile_id, organization_id)
        if payload.connection_id is not None and payload.connection_id != item.connection_id:
            connection = await self.require_connection(payload.connection_id, organization_id)
            if connection.status == "disabled":
                raise AppError("MODEL_CONNECTION_DISABLED", "Model connection is disabled.", 409)
            item.connection_id = connection.id
        if payload.display_name is not None and payload.display_name != item.display_name:
            await self._ensure_profile_name(organization_id, payload.display_name, exclude_id=item.id)
            item.display_name = payload.display_name
        if payload.model_name is not None:
            item.model_name = payload.model_name
        if payload.settings is not None:
            item.settings = payload.settings
        if payload.enabled is not None and payload.enabled != item.enabled:
            if not payload.enabled and item.is_default:
                item.is_default = False
                item.enabled = False
                await self.session.flush()
                await self._promote_default(organization_id, excluded_profile_id=item.id)
            else:
                item.enabled = payload.enabled
                if payload.enabled and await self.repo.current_default(organization_id) is None:
                    item.is_default = True
        try:
            await self.session.commit()
            await self.session.refresh(item)
        except IntegrityError as exc:
            await self.session.rollback()
            raise AppError("MODEL_PROFILE_NAME_EXISTS", "A model profile with this name already exists.", 409) from exc
        return item

    async def set_default(
        self, *, profile_id: uuid.UUID, organization_id: uuid.UUID
    ) -> ModelProfile:
        item = await self.require_profile(profile_id, organization_id)
        if not item.enabled:
            raise AppError("MODEL_PROFILE_DISABLED", "Disabled model profiles cannot be default.", 409)
        connection = await self.require_connection(item.connection_id, organization_id)
        if connection.status == "disabled":
            raise AppError("MODEL_CONNECTION_DISABLED", "Model connection is disabled.", 409)
        await self.repo.clear_default(organization_id)
        item.is_default = True
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def delete_profile(self, *, profile_id: uuid.UUID, organization_id: uuid.UUID) -> None:
        item = await self.require_profile(profile_id, organization_id)
        was_default = item.is_default
        await self.session.delete(item)
        await self.session.flush()
        if was_default:
            await self._promote_default(organization_id, excluded_profile_id=item.id)
        await self.session.commit()

    async def get_default(self, organization_id: uuid.UUID) -> ModelProfile | None:
        return await self.repo.current_default(organization_id)

    async def build_client_for_profile(
        self, *, profile_id: uuid.UUID, organization_id: uuid.UUID
    ) -> tuple[ModelProfile, OpenAICompatibleClient]:
        profile = await self.require_profile(profile_id, organization_id)
        if not profile.enabled:
            raise AppError("MODEL_PROFILE_DISABLED", "Model profile is disabled.", 409)
        connection = await self.require_connection(profile.connection_id, organization_id)
        if connection.status == "disabled":
            raise AppError("MODEL_CONNECTION_DISABLED", "Model connection is disabled.", 409)
        return profile, OpenAICompatibleClient(
            base_url=connection.base_url,
            api_key=await self._api_key(connection),
            timeout_seconds=float(self.settings.model_provider_timeout_seconds),
        )

    async def get_runtime_configuration(
        self, *, profile_id: uuid.UUID, organization_id: uuid.UUID
    ) -> ModelRuntimeConfiguration:
        """Resolve one enabled profile into a runtime-only configuration.

        The API never exposes this object. It exists only inside the worker so orchestration
        libraries can construct a provider client without learning how credentials are stored.
        """
        profile = await self.require_profile(profile_id, organization_id)
        if not profile.enabled:
            raise AppError("MODEL_PROFILE_DISABLED", "Model profile is disabled.", 409)
        connection = await self.require_connection(profile.connection_id, organization_id)
        if connection.status == "disabled":
            raise AppError("MODEL_CONNECTION_DISABLED", "Model connection is disabled.", 409)
        return ModelRuntimeConfiguration(
            profile_id=str(profile.id),
            model_name=profile.model_name,
            base_url=connection.base_url,
            api_key=await self._api_key(connection),
            settings=dict(profile.settings),
        )

    async def _api_key(self, connection: ModelConnection) -> str | None:
        if connection.secret_id is None:
            return None
        payload = await self.secrets.read(
            secret_id=connection.secret_id,
            organization_id=connection.organization_id,
        )
        value = payload.get("api_key")
        if not isinstance(value, str):
            raise AppError("SECRET_DECRYPTION_FAILED", "Stored credentials could not be read.", 500)
        return value

    async def _ensure_connection_name(
        self, organization_id: uuid.UUID, name: str, exclude_id: uuid.UUID | None = None
    ) -> None:
        existing = await self.repo.find_connection_name(organization_id, name)
        if existing is not None and existing.id != exclude_id:
            raise AppError("MODEL_CONNECTION_NAME_EXISTS", "A model connection with this name already exists.", 409)

    async def _ensure_profile_name(
        self, organization_id: uuid.UUID, name: str, exclude_id: uuid.UUID | None = None
    ) -> None:
        existing = await self.repo.find_profile_name(organization_id, name)
        if existing is not None and existing.id != exclude_id:
            raise AppError("MODEL_PROFILE_NAME_EXISTS", "A model profile with this name already exists.", 409)

    async def _promote_default(
        self, organization_id: uuid.UUID, excluded_profile_id: uuid.UUID | None = None
    ) -> None:
        if await self.repo.current_default(organization_id) is not None:
            return
        candidates = await self.repo.enabled_profiles_excluding(organization_id, excluded_profile_id)
        if candidates:
            candidates[0].is_default = True
            await self.session.flush()

    async def _commit_duplicate(self, code: str, message: str) -> None:
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise AppError(code, message, 409) from exc
