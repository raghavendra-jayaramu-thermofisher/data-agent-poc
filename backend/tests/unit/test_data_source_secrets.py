from __future__ import annotations

import base64
import os

import pytest

from app.core.config import Settings
from app.core.errors import AppError
from app.data_sources.secrets import SecretCipher, SecretEnvelope


def settings_with_key(version: str = "v7") -> Settings:
    key = base64.urlsafe_b64encode(os.urandom(32)).decode("ascii")
    return Settings(
        app_env="test",
        secret_encryption_current_version=version,
        secret_encryption_keys={version: key},
    )


def test_secret_cipher_round_trip_and_no_plaintext() -> None:
    cipher = SecretCipher(settings_with_key())
    envelope = cipher.encrypt_json({"username": "reporter", "password": "super-secret"})

    assert envelope.key_version == "v7"
    assert b"super-secret" not in envelope.ciphertext
    assert cipher.decrypt_json(envelope) == {
        "password": "super-secret",
        "username": "reporter",
    }


def test_secret_cipher_requires_historical_key_version() -> None:
    cipher = SecretCipher(settings_with_key("v1"))
    with pytest.raises(AppError) as error:
        cipher.decrypt_json(SecretEnvelope(b"not-valid-ciphertext", "old"))
    assert error.value.code == "SECRET_KEY_UNAVAILABLE"
