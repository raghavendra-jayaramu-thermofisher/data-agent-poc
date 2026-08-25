from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import AuthActionToken, AuthSession, User


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_user(self, user_id: uuid.UUID) -> User | None:
        return await self.session.get(User, user_id)

    def add_user(self, user: User) -> None:
        self.session.add(user)

    def add_session(self, auth_session: AuthSession) -> None:
        self.session.add(auth_session)

    async def get_session_by_refresh_hash(self, token_hash: str) -> AuthSession | None:
        result = await self.session.execute(
            select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def lock_session_by_refresh_hash(self, token_hash: str) -> AuthSession | None:
        result = await self.session.execute(
            select(AuthSession)
            .where(AuthSession.refresh_token_hash == token_hash)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def revoke_all_sessions(self, user_id: uuid.UUID, revoked_at: datetime) -> None:
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=revoked_at)
        )

    def add_action_token(self, token: AuthActionToken) -> None:
        self.session.add(token)

    async def invalidate_action_tokens(
        self, user_id: uuid.UUID, purpose: str, used_at: datetime
    ) -> None:
        await self.session.execute(
            update(AuthActionToken)
            .where(
                AuthActionToken.user_id == user_id,
                AuthActionToken.purpose == purpose,
                AuthActionToken.used_at.is_(None),
            )
            .values(used_at=used_at)
        )

    async def lock_action_token(self, token_hash: str, purpose: str) -> AuthActionToken | None:
        result = await self.session.execute(
            select(AuthActionToken)
            .where(
                AuthActionToken.token_hash == token_hash,
                AuthActionToken.purpose == purpose,
            )
            .with_for_update()
        )
        return result.scalar_one_or_none()
