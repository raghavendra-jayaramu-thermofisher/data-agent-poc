from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.email import EmailService, build_email_service
from app.auth.models import User
from app.auth.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.auth.service import AuthService
from app.core.config import Settings, get_settings
from app.core.database import get_db_session

router = APIRouter(prefix="/auth", tags=["auth"])


def get_email_service(settings: Settings = Depends(get_settings)) -> EmailService:
    return build_email_service(settings)


def _service(session: AsyncSession, settings: Settings, email_service: EmailService) -> AuthService:
    return AuthService(session, settings, email_service)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: SignupRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    email_service: EmailService = Depends(get_email_service),
) -> TokenResponse:
    _, _, tokens = await _service(session, settings, email_service).signup(request)
    return TokenResponse(**asdict(tokens))


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    email_service: EmailService = Depends(get_email_service),
) -> TokenResponse:
    _, tokens = await _service(session, settings, email_service).login(str(request.email), request.password)
    return TokenResponse(**asdict(tokens))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    email_service: EmailService = Depends(get_email_service),
) -> TokenResponse:
    tokens = await _service(session, settings, email_service).refresh(request.refresh_token)
    return TokenResponse(**asdict(tokens))


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: LogoutRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    email_service: EmailService = Depends(get_email_service),
) -> MessageResponse:
    await _service(session, settings, email_service).logout(request.refresh_token)
    return MessageResponse(message="Logged out.")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    email_service: EmailService = Depends(get_email_service),
) -> MessageResponse:
    await _service(session, settings, email_service).forgot_password(str(request.email))
    return MessageResponse(
        message="If an account exists for that email, password reset instructions have been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    request: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    email_service: EmailService = Depends(get_email_service),
) -> MessageResponse:
    await _service(session, settings, email_service).reset_password(request.token, request.new_password)
    return MessageResponse(message="Password reset successfully.")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
