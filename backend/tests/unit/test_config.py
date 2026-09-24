import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_requires_strong_jwt_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret="short")


def test_test_settings_accept_explicit_secret() -> None:
    settings = Settings(app_env="test", jwt_secret="x" * 32)
    assert settings.app_env == "test"
