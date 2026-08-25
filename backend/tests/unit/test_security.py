from __future__ import annotations

import uuid

import pytest

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_opaque_token,
    hash_password,
    new_opaque_token,
    verify_password,
)


def test_password_hash_round_trip() -> None:
    encoded = hash_password("StrongPassword1")
    assert encoded != "StrongPassword1"
    assert verify_password("StrongPassword1", encoded)
    assert not verify_password("WrongPassword1", encoded)


def test_opaque_token_hash_is_deterministic_and_not_plaintext() -> None:
    token = new_opaque_token()
    digest = hash_opaque_token(token)
    assert digest == hash_opaque_token(token)
    assert token not in digest
    assert len(digest) == 64


def test_access_token_round_trip() -> None:
    settings = Settings(app_env="test", jwt_secret="x" * 48)
    user_id = uuid.uuid4()
    token, ttl = create_access_token(user_id, settings)
    claims = decode_access_token(token, settings)
    assert claims.user_id == user_id
    assert ttl == settings.access_token_ttl_minutes * 60


def test_invalid_access_token_is_sanitized() -> None:
    settings = Settings(app_env="test", jwt_secret="x" * 48)
    with pytest.raises(AppError) as exc_info:
        decode_access_token("not-a-jwt", settings)
    assert exc_info.value.code == "INVALID_ACCESS_TOKEN"
    assert exc_info.value.status_code == 401
