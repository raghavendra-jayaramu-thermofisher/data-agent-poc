from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog
from app.core.time import utc_now


class AuditService:
    """Small explicit audit writer. Callers decide which business actions are security-relevant."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def record(
        self,
        *,
        organization_id: uuid.UUID,
        user_id: uuid.UUID | None,
        action: str,
        resource_type: str,
        resource_id: uuid.UUID | None = None,
        metadata: dict[str, object] | None = None,
    ) -> AuditLog:
        # Never pass raw request bodies or credentials here. Metadata must be intentionally small.
        item = AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action=action[:120],
            resource_type=resource_type[:80],
            resource_id=resource_id,
            metadata_json=metadata or {},
            created_at=utc_now(),
        )
        self.session.add(item)
        return item
