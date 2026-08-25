from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog
from app.audit.schemas import AuditLogResponse
from app.auth.dependencies import get_current_organization
from app.core.database import get_db_session
from app.core.errors import AppError
from app.organizations.models import Organization, OrganizationMembership

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    context: tuple[Organization, OrganizationMembership] = Depends(get_current_organization),
    session: AsyncSession = Depends(get_db_session),
) -> list[AuditLogResponse]:
    organization, membership = context
    if membership.role not in {"owner", "admin"}:
        raise AppError("FORBIDDEN", "You do not have permission for this action.", 403)
    result = await session.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == organization.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return [AuditLogResponse.model_validate(item) for item in result.scalars().all()]
