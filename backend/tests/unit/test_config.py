import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_requires_strong_jwt_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret="short")


def test_test_settings_accept_explicit_secret() -> None:
    settings = Settings(app_env="test", jwt_secret="x" * 32)
    assert settings.app_env == "test"


def test_final_answer_profile_accepts_empty_or_canonical_uuid() -> None:
    assert Settings(final_answer_model_profile_id="").final_answer_model_profile_id is None
    profile_id = "11111111-1111-4111-8111-111111111111"
    settings = Settings(final_answer_model_profile_id=profile_id)
    assert settings.final_answer_model_profile_id == profile_id


def test_final_answer_profile_rejects_invalid_uuid() -> None:
    with pytest.raises(ValidationError):
        Settings(final_answer_model_profile_id="not-a-uuid")
