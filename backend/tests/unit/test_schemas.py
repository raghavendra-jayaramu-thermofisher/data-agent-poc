import pytest
from pydantic import ValidationError

from app.auth.schemas import SignupRequest


def test_signup_normal_schema() -> None:
    value = SignupRequest(email="user@example.com", password="StrongPass1")
    assert str(value.email) == "user@example.com"


@pytest.mark.parametrize("password", ["short1A", "lowercase123", "UPPERCASE123", "NoNumbersHere"])
def test_signup_rejects_weak_password(password: str) -> None:
    with pytest.raises(ValidationError):
        SignupRequest(email="user@example.com", password=password)
