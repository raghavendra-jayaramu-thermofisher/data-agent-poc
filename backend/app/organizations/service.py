from __future__ import annotations

import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.time import utc_now
from app.organizations.models import Organization, OrganizationMembership
from app.organizations.repository import OrganizationRepository


class OrganizationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = OrganizationRepository(session)

    @staticmethod
    def slugify(name: str) -> str:
        value = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
        return value[:120] or "workspace"

    async def create_initial(
        self, *, user_id: uuid.UUID, name: str
    ) -> tuple[Organization, OrganizationMembership]:
        base = self.slugify(name)
        organization_id = uuid.uuid4()
        organization = Organization(
            id=organization_id,
            name=name.strip(),
            slug=f"{base}-{str(uuid.uuid4())[:8]}",
            created_by=user_id,
        )
        membership = OrganizationMembership(
            organization_id=organization_id,
            user_id=user_id,
            role="owner",
            created_at=utc_now(),
        )
        self.repo.add(organization)
        self.repo.add_membership(membership)
        await self.session.flush()
        return organization, membership

    async def require_membership(
        self, *, user_id: uuid.UUID, organization_id: uuid.UUID
    ) -> OrganizationMembership:
        membership = await self.repo.get_membership(organization_id, user_id)
        if membership is None:
            raise AppError("ORGANIZATION_NOT_FOUND", "Organization not found.", 404)
        return membership

    async def require_role(
        self,
        *,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        allowed_roles: set[str],
    ) -> OrganizationMembership:
        membership = await self.require_membership(
            user_id=user_id, organization_id=organization_id
        )
        if membership.role not in allowed_roles:
            raise AppError("FORBIDDEN", "You do not have permission for this action.", 403)
        return membership
