from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_organization, get_current_user
from app.auth.models import User
from app.audit.service import AuditService
from app.core.database import get_db_session
from app.core.errors import AppError
from app.organizations.models import Organization, OrganizationMembership
from app.organizations.repository import OrganizationRepository
from app.organizations.schemas import OrganizationResponse, OrganizationUpdateRequest

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[OrganizationResponse]:
    rows = await OrganizationRepository(session).list_for_user(current_user.id)
    return [
        OrganizationResponse(
            id=org.id,
            name=org.name,
            slug=org.slug,
            created_by=org.created_by,
            created_at=org.created_at,
            updated_at=org.updated_at,
            role=role,
        )
        for org, role in rows
    ]


@router.get("/current", response_model=OrganizationResponse)
async def current_organization(
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
) -> OrganizationResponse:
    organization, membership = context
    response = OrganizationResponse.model_validate(organization)
    response.role = membership.role
    return response


@router.patch("/{organization_id}", response_model=OrganizationResponse)
async def update_organization(
    organization_id: uuid.UUID,
    request: OrganizationUpdateRequest,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationResponse:
    current_org, membership = context
    if current_org.id != organization_id:
        raise AppError("ORGANIZATION_NOT_FOUND", "Organization not found.", 404)
    if membership.role not in {"owner", "admin"}:
        raise AppError("FORBIDDEN", "You do not have permission for this action.", 403)
    current_org.name = request.name.strip()
    AuditService(session).record(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="organization.updated",
        resource_type="organization",
        resource_id=current_org.id,
    )
    await session.commit()
    await session.refresh(current_org)
    response = OrganizationResponse.model_validate(current_org)
    response.role = membership.role
    return response
