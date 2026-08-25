from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.email import EmailService
from app.auth.models import AuthActionToken, AuthSession, User
from app.auth.repository import AuthRepository
from app.auth.schemas import SignupRequest
from app.audit.service import AuditService
from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    hash_opaque_token,
    hash_password,
    new_opaque_token,
    password_hash_needs_rehash,
    verify_password,
)
from app.core.time import utc_now
from app.organizations.models import Organization
from app.organizations.repository import OrganizationRepository
from app.organizations.service import OrganizationService


@dataclass(frozen=True, slots=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    expires_in: int


class AuthService:
    def __init__(self, session: AsyncSession, settings: Settings, email_service: EmailService) -> None:
        self.session = session
        self.settings = settings
        self.email_service = email_service
        self.repo = AuthRepository(session)
        self.organization_service = OrganizationService(session)

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    async def signup(self, request: SignupRequest) -> tuple[User, Organization, IssuedTokens]:
        email = self.normalize_email(str(request.email))
        if await self.repo.get_user_by_email(email):
            raise AppError("EMAIL_ALREADY_REGISTERED", "An account already exists for this email.", 409)

        now = utc_now()
        user = User(
            email=email,
            password_hash=hash_password(request.password),
            display_name=request.display_name.strip() if request.display_name else None,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        self.repo.add_user(user)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise AppError(
                "EMAIL_ALREADY_REGISTERED", "An account already exists for this email.", 409
            ) from exc

        organization_name = (
            request.organization_name.strip()
            if request.organization_name
            else f"{request.display_name.strip()}'s Workspace"
            if request.display_name
            else "My Workspace"
        )
        organization, _ = await self.organization_service.create_initial(
            user_id=user.id, name=organization_name
        )
        tokens = await self._issue_session(user)
        AuditService(self.session).record(
            organization_id=organization.id, user_id=user.id, action="auth.signup",
            resource_type="user", resource_id=user.id,
        )
        await self.session.commit()
        return user, organization, tokens

    async def login(self, email: str, password: str) -> tuple[User, IssuedTokens]:
        user = await self.repo.get_user_by_email(self.normalize_email(email))
        if user is None or not verify_password(password, user.password_hash):
            raise AppError("INVALID_CREDENTIALS", "Invalid email or password.", 401)
        if not user.is_active:
            raise AppError("ACCOUNT_DISABLED", "This account is disabled.", 403)
        if password_hash_needs_rehash(user.password_hash):
            user.password_hash = hash_password(password)
        tokens = await self._issue_session(user)
        await self.session.commit()
        return user, tokens

    async def refresh(self, refresh_token: str) -> IssuedTokens:
        token_hash = hash_opaque_token(refresh_token)
        current = await self.repo.lock_session_by_refresh_hash(token_hash)
        now = utc_now()
        if current is None:
            raise AppError("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token.", 401)
        if current.revoked_at is not None:
            # Reuse of an already-rotated refresh token is a replay signal. Revoke the
            # user's remaining sessions. A normally logged-out token has no replacement.
            if current.replaced_by_session_id is not None:
                await self.repo.revoke_all_sessions(current.user_id, now)
                await self.session.commit()
            raise AppError("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token.", 401)
        if current.expires_at <= now:
            raise AppError("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token.", 401)
        user = await self.repo.get_user(current.user_id)
        if user is None or not user.is_active:
            raise AppError("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token.", 401)

        current.revoked_at = now
        tokens, replacement = self._build_session(user)
        self.repo.add_session(replacement)
        await self.session.flush()
        current.replaced_by_session_id = replacement.id
        await self.session.commit()
        return tokens

    async def logout(self, refresh_token: str) -> None:
        token_hash = hash_opaque_token(refresh_token)
        current = await self.repo.lock_session_by_refresh_hash(token_hash)
        if current is not None and current.revoked_at is None:
            current.revoked_at = utc_now()
            await self.session.commit()

    async def forgot_password(self, email: str) -> None:
        user = await self.repo.get_user_by_email(self.normalize_email(email))
        if user is None or not user.is_active:
            return
        now = utc_now()
        await self.repo.invalidate_action_tokens(user.id, "password_reset", now)
        raw_token = new_opaque_token()
        record = AuthActionToken(
            user_id=user.id,
            purpose="password_reset",
            token_hash=hash_opaque_token(raw_token),
            expires_at=now + timedelta(minutes=self.settings.password_reset_ttl_minutes),
            created_at=now,
        )
        self.repo.add_action_token(record)
        await self.session.commit()
        await self.email_service.send_password_reset(recipient=user.email, token=raw_token)

    async def reset_password(self, token: str, new_password: str) -> None:
        now = utc_now()
        record = await self.repo.lock_action_token(hash_opaque_token(token), "password_reset")
        if record is None or record.used_at is not None or record.expires_at <= now:
            raise AppError("INVALID_RESET_TOKEN", "Invalid or expired password reset token.", 400)
        user = await self.repo.get_user(record.user_id)
        if user is None or not user.is_active:
            raise AppError("INVALID_RESET_TOKEN", "Invalid or expired password reset token.", 400)
        user.password_hash = hash_password(new_password)
        user.updated_at = now
        record.used_at = now
        await self.repo.revoke_all_sessions(user.id, now)
        first = await OrganizationRepository(self.session).first_membership(user.id)
        if first is not None:
            organization, _ = first
            AuditService(self.session).record(
                organization_id=organization.id, user_id=user.id, action="auth.password_reset",
                resource_type="user", resource_id=user.id,
            )
        await self.session.commit()

    async def _issue_session(self, user: User) -> IssuedTokens:
        tokens, auth_session = self._build_session(user)
        self.repo.add_session(auth_session)
        await self.session.flush()
        return tokens

    def _build_session(self, user: User) -> tuple[IssuedTokens, AuthSession]:
        raw_refresh = new_opaque_token()
        now = utc_now()
        access_token, expires_in = create_access_token(user.id, self.settings)
        auth_session = AuthSession(
            user_id=user.id,
            refresh_token_hash=hash_opaque_token(raw_refresh),
            expires_at=now + timedelta(days=self.settings.refresh_token_ttl_days),
            created_at=now,
        )
        return (
            IssuedTokens(
                access_token=access_token,
                refresh_token=raw_refresh,
                expires_in=expires_in,
            ),
            auth_session,
        )
