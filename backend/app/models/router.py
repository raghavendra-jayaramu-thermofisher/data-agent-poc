from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_organization, get_current_user
from app.auth.models import User
from app.audit.service import AuditService
from app.core.config import Settings, get_settings
from app.core.database import get_db_session
from app.core.errors import AppError
from app.models.schemas import (
    ModelConnectionCreate,
    ModelConnectionResponse,
    ModelConnectionTestResponse,
    ModelConnectionUpdate,
    ModelProfileCreate,
    ModelProfileResponse,
    ModelProfileUpdate,
)
from app.models.service import ModelConfigurationService
from app.organizations.models import Organization, OrganizationMembership

router = APIRouter(prefix="/models", tags=["models"])


def require_admin(membership: OrganizationMembership) -> None:
    if membership.role not in {"owner", "admin"}:
        raise AppError("FORBIDDEN", "You do not have permission for this action.", 403)


@router.get("/connections", response_model=list[ModelConnectionResponse])
async def list_connections(
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> list[ModelConnectionResponse]:
    organization, _ = context
    service = ModelConfigurationService(session, settings)
    return [await service.connection_response(item) for item in await service.list_connections(organization.id)]


@router.post("/connections", response_model=ModelConnectionResponse, status_code=201)
async def create_connection(
    payload: ModelConnectionCreate,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelConnectionResponse:
    organization, membership = context
    require_admin(membership)
    service = ModelConfigurationService(session, settings)
    item = await service.create_connection(
        organization_id=organization.id,
        user_id=current_user.id,
        payload=payload,
    )
    AuditService(session).record(
        organization_id=organization.id, user_id=current_user.id, action="model_connection.created",
        resource_type="model_connection", resource_id=item.id,
    )
    await session.commit()
    return await service.connection_response(item)


@router.get("/connections/{connection_id}", response_model=ModelConnectionResponse)
async def get_connection(
    connection_id: uuid.UUID,
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelConnectionResponse:
    organization, _ = context
    service = ModelConfigurationService(session, settings)
    return await service.connection_response(await service.require_connection(connection_id, organization.id))


@router.patch("/connections/{connection_id}", response_model=ModelConnectionResponse)
async def update_connection(
    connection_id: uuid.UUID,
    payload: ModelConnectionUpdate,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelConnectionResponse:
    organization, membership = context
    require_admin(membership)
    service = ModelConfigurationService(session, settings)
    item = await service.update_connection(
        connection_id=connection_id,
        organization_id=organization.id,
        payload=payload,
    )
    AuditService(session).record(
        organization_id=organization.id, user_id=current_user.id, action="model_connection.updated",
        resource_type="model_connection", resource_id=item.id,
    )
    await session.commit()
    return await service.connection_response(item)


@router.delete("/connections/{connection_id}", status_code=204)
async def delete_connection(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    organization, membership = context
    require_admin(membership)
    await ModelConfigurationService(session, settings).delete_connection(
        connection_id=connection_id,
        organization_id=organization.id,
    )
    AuditService(session).record(
        organization_id=organization.id, user_id=current_user.id, action="model_connection.deleted",
        resource_type="model_connection", resource_id=connection_id,
    )
    await session.commit()
    return Response(status_code=204)


@router.post("/connections/{connection_id}/test", response_model=ModelConnectionTestResponse)
async def test_connection(
    connection_id: uuid.UUID,
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelConnectionTestResponse:
    organization, membership = context
    require_admin(membership)
    return await ModelConfigurationService(session, settings).test_connection(
        connection_id=connection_id,
        organization_id=organization.id,
    )


@router.get("/profiles", response_model=list[ModelProfileResponse])
async def list_profiles(
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> list[ModelProfileResponse]:
    organization, _ = context
    return await ModelConfigurationService(session, settings).list_profiles(organization.id)


@router.post("/profiles", response_model=ModelProfileResponse, status_code=201)
async def create_profile(
    payload: ModelProfileCreate,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProfileResponse:
    organization, membership = context
    require_admin(membership)
    item = await ModelConfigurationService(session, settings).create_profile(
        organization_id=organization.id,
        payload=payload,
    )
    AuditService(session).record(
        organization_id=organization.id, user_id=current_user.id, action="model_profile.created",
        resource_type="model_profile", resource_id=item.id,
    )
    await session.commit()
    return item


@router.get("/profiles/default", response_model=ModelProfileResponse | None)
async def get_default_profile(
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProfileResponse | None:
    organization, _ = context
    return await ModelConfigurationService(session, settings).get_default(organization.id)


@router.get("/profiles/{profile_id}", response_model=ModelProfileResponse)
async def get_profile(
    profile_id: uuid.UUID,
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProfileResponse:
    organization, _ = context
    return await ModelConfigurationService(session, settings).require_profile(profile_id, organization.id)


@router.patch("/profiles/{profile_id}", response_model=ModelProfileResponse)
async def update_profile(
    profile_id: uuid.UUID,
    payload: ModelProfileUpdate,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProfileResponse:
    organization, membership = context
    require_admin(membership)
    item = await ModelConfigurationService(session, settings).update_profile(
        profile_id=profile_id,
        organization_id=organization.id,
        payload=payload,
    )
    AuditService(session).record(
        organization_id=organization.id, user_id=current_user.id, action="model_profile.updated",
        resource_type="model_profile", resource_id=item.id,
    )
    await session.commit()
    return item


@router.post("/profiles/{profile_id}/default", response_model=ModelProfileResponse)
async def set_default_profile(
    profile_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ModelProfileResponse:
    organization, membership = context
    require_admin(membership)
    item = await ModelConfigurationService(session, settings).set_default(
        profile_id=profile_id,
        organization_id=organization.id,
    )
    AuditService(session).record(
        organization_id=organization.id, user_id=current_user.id, action="model_profile.default_set",
        resource_type="model_profile", resource_id=item.id,
    )
    await session.commit()
    return item


@router.delete("/profiles/{profile_id}", status_code=204)
async def delete_profile(
    profile_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    organization, membership = context
    require_admin(membership)
    await ModelConfigurationService(session, settings).delete_profile(
        profile_id=profile_id,
        organization_id=organization.id,
    )
    AuditService(session).record(
        organization_id=organization.id, user_id=current_user.id, action="model_profile.deleted",
        resource_type="model_profile", resource_id=profile_id,
    )
    await session.commit()
    return Response(status_code=204)
