from __future__ import annotations

import base64
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    app_name: str = "DB Assistant API"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://dbassistant:dbassistant@localhost:5432/dbassistant"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = Field(default="development-only-change-me-please-32chars")
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    access_token_ttl_minutes: int = Field(default=15, ge=1, le=1440)
    refresh_token_ttl_days: int = Field(default=30, ge=1, le=365)
    password_reset_ttl_minutes: int = Field(default=30, ge=5, le=1440)
    password_reset_url_base: str = "http://localhost:5173/reset-password"

    email_backend: Literal["console", "smtp"] = "console"
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_starttls: bool = True

    redis_job_stream: str = "dbassistant:jobs"
    redis_job_group: str = "dbassistant-workers"
    worker_id: str | None = None
    worker_block_ms: int = Field(default=5000, ge=100, le=60000)
    worker_lease_seconds: int = Field(default=60, ge=10, le=3600)
    worker_heartbeat_seconds: int = Field(default=20, ge=2, le=1800)
    worker_stale_idle_ms: int = Field(default=60000, ge=1000)
    worker_concurrency: int = Field(default=4, ge=1, le=32)
    job_max_attempts: int = Field(default=3, ge=1, le=10)
    max_active_jobs_per_user: int = Field(default=5, ge=1, le=100)
    max_active_jobs_per_organization: int = Field(default=20, ge=1, le=1000)

    # Local, single-server managed storage. Paths are resolved by organization/datasource IDs.
    data_directory: Path = Path("./runtime-data")
    max_excel_upload_bytes: int = Field(default=100 * 1024 * 1024, ge=1024)
    excel_batch_size: int = Field(default=2000, ge=100, le=20000)
    datasource_operation_timeout_seconds: int = Field(default=60, ge=1, le=600)
    datasource_query_max_rows: int = Field(default=10000, ge=1, le=100000)
    model_provider_timeout_seconds: int = Field(default=60, ge=1, le=600)

    # Task 5 analytical-agent safety/resource limits. These are enforced by code, not prompts.
    agent_job_timeout_seconds: int = Field(default=300, ge=10, le=3600)
    agent_max_tool_calls: int = Field(default=150, ge=1, le=500)
    agent_max_sql_attempts: int = Field(default=150, ge=1, le=500)
    agent_query_timeout_seconds: int = Field(default=60, ge=1, le=600)
    agent_result_max_rows: int = Field(default=10000, ge=1, le=100000)
    agent_result_max_bytes: int = Field(default=10_000_000, ge=1024, le=100_000_000)
    agent_model_result_max_rows: int = Field(default=500, ge=1, le=5000)
    agent_model_result_max_bytes: int = Field(default=1_000_000, ge=1024, le=10_000_000)
    agent_chart_max_rows: int = Field(default=2000, ge=2, le=5000)
    agent_html_artifact_max_bytes: int = Field(default=256 * 1024, ge=1024, le=2 * 1024 * 1024)
    agent_max_history_messages: int = Field(default=50, ge=1, le=200)

    # Final-answer orchestration. The configured profile is resolved inside the worker for the
    # current organization; keeping it outside the conversation schema avoids a migration.
    final_answer_model_profile_id: str | None = None
    final_answer_timeout_seconds: int = Field(default=60, ge=5, le=600)
    final_answer_max_repairs: int = Field(default=1, ge=0, le=3)
    analysis_evidence_retries: int = Field(default=2, ge=0, le=5)

    # Task 6 retention/maintenance controls. Durable audit/history is never auto-deleted.
    auth_expired_retention_days: int = Field(default=30, ge=0, le=3650)
    stale_job_grace_seconds: int = Field(default=300, ge=0, le=86400)
    temporary_file_retention_hours: int = Field(default=24, ge=1, le=720)

    # Key ring makes future key rotation possible without changing the encrypted-secret schema.
    # Values are URL-safe base64-encoded 32-byte AES keys.
    secret_encryption_current_version: str = "v1"
    secret_encryption_keys: dict[str, str] = {"v1": "IKDwaOIvGQ2d1pLXE8RAauWa7Cw3j8yL_XOYe-dfy9c="}

    cors_origins: list[str] = ["http://localhost:5173"]
    log_level: str = "INFO"

    @field_validator("jwt_secret")
    @classmethod
    def validate_jwt_secret(cls, value: str, info):  # type: ignore[no-untyped-def]
        if info.data.get("app_env") == "production" and len(value) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters in production")
        return value

    @field_validator("secret_encryption_keys")
    @classmethod
    def validate_encryption_keys(cls, value: dict[str, str]) -> dict[str, str]:
        if not value:
            raise ValueError("At least one secret encryption key is required")
        for version, encoded in value.items():
            if not version.strip():
                raise ValueError("Secret encryption key versions must not be empty")
            try:
                decoded = base64.urlsafe_b64decode(encoded.encode("ascii"))
            except Exception as exc:
                raise ValueError(f"Invalid base64 encryption key for version {version}") from exc
            if len(decoded) != 32:
                raise ValueError(f"Encryption key {version} must decode to exactly 32 bytes")
        return value

    @field_validator("final_answer_model_profile_id", mode="before")
    @classmethod
    def normalize_final_answer_model_profile_id(cls, value: object) -> str | None:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        text = str(value).strip()
        try:
            return str(uuid.UUID(text))
        except (ValueError, TypeError, AttributeError) as exc:
            raise ValueError("FINAL_ANSWER_MODEL_PROFILE_ID must be a valid UUID") from exc

    @model_validator(mode="after")
    def validate_settings(self) -> Settings:
        if self.app_env == "production" and self.email_backend != "smtp":
            raise ValueError("EMAIL_BACKEND must be smtp in production")
        if self.email_backend == "smtp" and (not self.smtp_host or not self.smtp_from_email):
            raise ValueError("SMTP_HOST and SMTP_FROM_EMAIL are required for SMTP email")
        if self.secret_encryption_current_version not in self.secret_encryption_keys:
            raise ValueError(
                "SECRET_ENCRYPTION_CURRENT_VERSION must exist in SECRET_ENCRYPTION_KEYS"
            )
        if self.app_env == "production":
            default_key = "IKDwaOIvGQ2d1pLXE8RAauWa7Cw3j8yL_XOYe-dfy9c="
            if self.secret_encryption_keys.get("v1") == default_key:
                raise ValueError("Replace the development secret encryption key in production")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
