from __future__ import annotations

import base64
import json
import os
import uuid
from dataclasses import dataclass
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.secrets.models import EncryptedSecret


@dataclass(frozen=True, slots=True)
class SecretEnvelope:
    ciphertext: bytes
    key_version: str


class SecretCipher:
    def __init__(self, settings: Settings) -> None:
        self.current_version = settings.secret_encryption_current_version
        self.keys = {
            version: base64.urlsafe_b64decode(encoded.encode("ascii"))
            for version, encoded in settings.secret_encryption_keys.items()
        }

    def encrypt_json(self, payload: dict[str, Any]) -> SecretEnvelope:
        plaintext = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        nonce = os.urandom(12)
        aes = AESGCM(self.keys[self.current_version])
        ciphertext = aes.encrypt(nonce, plaintext, self.current_version.encode("utf-8"))
        return SecretEnvelope(nonce + ciphertext, self.current_version)

    def decrypt_json(self, envelope: SecretEnvelope) -> dict[str, Any]:
        key = self.keys.get(envelope.key_version)
        if key is None:
            raise AppError(
                "SECRET_KEY_UNAVAILABLE",
                "A required secret encryption key is unavailable.",
                500,
            )
        if len(envelope.ciphertext) < 13:
            raise AppError("SECRET_DECRYPTION_FAILED", "Stored credentials could not be read.", 500)
        nonce = envelope.ciphertext[:12]
        ciphertext = envelope.ciphertext[12:]
        try:
            plaintext = AESGCM(key).decrypt(
                nonce, ciphertext, envelope.key_version.encode("utf-8")
            )
            value = json.loads(plaintext.decode("utf-8"))
        except Exception as exc:
            raise AppError(
                "SECRET_DECRYPTION_FAILED", "Stored credentials could not be read.", 500
            ) from exc
        if not isinstance(value, dict):
            raise AppError("SECRET_DECRYPTION_FAILED", "Stored credentials could not be read.", 500)
        return value


class SecretRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, secret: EncryptedSecret) -> None:
        self.session.add(secret)

    async def get_for_org(
        self, secret_id: uuid.UUID, organization_id: uuid.UUID
    ) -> EncryptedSecret | None:
        result = await self.session.execute(
            select(EncryptedSecret).where(
                EncryptedSecret.id == secret_id,
                EncryptedSecret.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete(self, secret: EncryptedSecret) -> None:
        await self.session.delete(secret)


class SecretService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.repo = SecretRepository(session)
        self.cipher = SecretCipher(settings)

    async def create(
        self, *, organization_id: uuid.UUID, purpose: str, payload: dict[str, Any]
    ) -> EncryptedSecret:
        now = utc_now()
        encrypted = self.cipher.encrypt_json(payload)
        secret = EncryptedSecret(
            organization_id=organization_id,
            purpose=purpose,
            encrypted_payload=encrypted.ciphertext,
            key_version=encrypted.key_version,
            created_at=now,
            updated_at=now,
        )
        self.repo.add(secret)
        await self.session.flush()
        return secret

    async def replace(self, secret: EncryptedSecret, payload: dict[str, Any]) -> None:
        encrypted = self.cipher.encrypt_json(payload)
        secret.encrypted_payload = encrypted.ciphertext
        secret.key_version = encrypted.key_version
        secret.updated_at = utc_now()
        await self.session.flush()

    async def read(self, *, secret_id: uuid.UUID, organization_id: uuid.UUID) -> dict[str, Any]:
        secret = await self.repo.get_for_org(secret_id, organization_id)
        if secret is None:
            raise AppError("SECRET_NOT_FOUND", "Stored credentials are unavailable.", 500)
        return self.cipher.decrypt_json(
            SecretEnvelope(secret.encrypted_payload, secret.key_version)
        )
