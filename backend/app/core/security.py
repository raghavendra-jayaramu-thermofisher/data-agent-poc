from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now

_password_hasher = PasswordHasher()


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    user_id: uuid.UUID
    expires_at: int
    token_id: str


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        return _password_hasher.verify(encoded_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_hash_needs_rehash(encoded_hash: str) -> bool:
    try:
        return _password_hasher.check_needs_rehash(encoded_hash)
    except InvalidHashError:
        return True


def new_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(user_id: uuid.UUID, settings: Settings) -> tuple[str, int]:
    now = utc_now()
    expires = now + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "jti": str(uuid.uuid4()),
        "type": "access",
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, settings.access_token_ttl_minutes * 60


def decode_access_token(token: str, settings: Settings) -> AccessTokenClaims:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "access":
            raise AppError("INVALID_ACCESS_TOKEN", "Invalid access token.", 401)
        return AccessTokenClaims(
            user_id=uuid.UUID(payload["sub"]),
            expires_at=int(payload["exp"]),
            token_id=str(payload["jti"]),
        )
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise AppError("INVALID_ACCESS_TOKEN", "Invalid or expired access token.", 401) from exc
