from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.service import AuditService
from app.auth.dependencies import get_current_organization, get_current_user
from app.auth.models import User
from app.core.database import get_db_session
from app.core.errors import AppError
from app.instructions.schemas import (
    InstructionCreate,
    InstructionResponse,
    InstructionUpdate,
)
from app.instructions.service import InstructionService
from app.organizations.models import Organization, OrganizationMembership

router = APIRouter(prefix="/instructions", tags=["instructions"])


def require_admin(membership: OrganizationMembership) -> None:
    if membership.role not in {"owner", "admin"}:
        raise AppError("FORBIDDEN", "You do not have permission for this action.", 403)


@router.get("", response_model=list[InstructionResponse])
async def list_instructions(
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
) -> list[InstructionResponse]:
    organization, _ = context
    service = InstructionService(session)
    rows = await service.list_instructions(organization.id)
    return [InstructionResponse.model_validate(row) for row in rows]


@router.post("", response_model=InstructionResponse, status_code=201)
async def create_instruction(
    payload: InstructionCreate,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
) -> InstructionResponse:
    organization, membership = context
    require_admin(membership)
    service = InstructionService(session)
    item = await service.create_instruction(
        organization_id=organization.id,
        user_id=current_user.id,
        payload=payload,
    )
    AuditService(session).record(
        organization_id=organization.id,
        user_id=current_user.id,
        action="agent_instruction.created",
        resource_type="agent_instruction",
        resource_id=item.id,
    )
    await session.commit()
    return InstructionResponse.model_validate(item)


@router.get("/{instruction_id}", response_model=InstructionResponse)
async def get_instruction(
    instruction_id: uuid.UUID,
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
) -> InstructionResponse:
    organization, _ = context
    service = InstructionService(session)
    item = await service.require_instruction(instruction_id, organization.id)
    return InstructionResponse.model_validate(item)


@router.patch("/{instruction_id}", response_model=InstructionResponse)
async def update_instruction(
    instruction_id: uuid.UUID,
    payload: InstructionUpdate,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
) -> InstructionResponse:
    organization, membership = context
    require_admin(membership)
    service = InstructionService(session)
    item = await service.update_instruction(
        instruction_id=instruction_id,
        organization_id=organization.id,
        payload=payload,
    )
    AuditService(session).record(
        organization_id=organization.id,
        user_id=current_user.id,
        action="agent_instruction.updated",
        resource_type="agent_instruction",
        resource_id=item.id,
    )
    await session.commit()
    return InstructionResponse.model_validate(item)


@router.delete("/{instruction_id}", status_code=204)
async def delete_instruction(
    instruction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    organization, membership = context
    require_admin(membership)
    service = InstructionService(session)
    await service.delete_instruction(
        instruction_id=instruction_id,
        organization_id=organization.id,
    )
    AuditService(session).record(
        organization_id=organization.id,
        user_id=current_user.id,
        action="agent_instruction.deleted",
        resource_type="agent_instruction",
        resource_id=instruction_id,
    )
    await session.commit()
    return Response(status_code=204)
