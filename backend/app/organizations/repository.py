from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.organizations.models import Organization, OrganizationMembership


class OrganizationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, organization: Organization) -> None:
        self.session.add(organization)

    def add_membership(self, membership: OrganizationMembership) -> None:
        self.session.add(membership)

    async def get(self, organization_id: uuid.UUID) -> Organization | None:
        return await self.session.get(Organization, organization_id)

    async def get_membership(
        self, organization_id: uuid.UUID, user_id: uuid.UUID
    ) -> OrganizationMembership | None:
        return await self.session.get(
            OrganizationMembership,
            {"organization_id": organization_id, "user_id": user_id},
        )

    async def first_membership(self, user_id: uuid.UUID) -> tuple[Organization, str] | None:
        result = await self.session.execute(
            select(Organization, OrganizationMembership.role)
            .join(
                OrganizationMembership,
                OrganizationMembership.organization_id == Organization.id,
            )
            .where(OrganizationMembership.user_id == user_id)
            .order_by(OrganizationMembership.created_at.asc())
            .limit(1)
        )
        row = result.first()
        if row is None:
            return None
        return row[0], row[1]

    async def list_for_user(self, user_id: uuid.UUID) -> list[tuple[Organization, str]]:
        result = await self.session.execute(
            select(Organization, OrganizationMembership.role)
            .join(
                OrganizationMembership,
                OrganizationMembership.organization_id == Organization.id,
            )
            .where(OrganizationMembership.user_id == user_id)
            .order_by(Organization.name.asc())
        )
        return [(row[0], row[1]) for row in result.all()]
