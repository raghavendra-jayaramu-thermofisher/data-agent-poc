from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=256)
    display_name: str | None = Field(default=None, max_length=160)
    organization_name: str | None = Field(default=None, max_length=160)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if value.lower() == value or value.upper() == value or not any(c.isdigit() for c in value):
            raise ValueError("Password must include upper/lowercase letters and a number")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=32)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=32)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=32)
    new_password: str = Field(min_length=10, max_length=256)

    @field_validator("new_password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if value.lower() == value or value.upper() == value or not any(c.isdigit() for c in value):
            raise ValueError("Password must include upper/lowercase letters and a number")
        return value


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    display_name: str | None
    is_active: bool
    email_verified_at: datetime | None
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    message: str
