from app.auth.email import ConsoleEmailService, SMTPEmailService, build_email_service
from app.core.config import Settings


def test_development_uses_console_email() -> None:
    settings = Settings(app_env="development", jwt_secret="x" * 32, email_backend="console")
    assert isinstance(build_email_service(settings), ConsoleEmailService)


def test_smtp_backend_is_explicit() -> None:
    settings = Settings(
        app_env="test",
        jwt_secret="x" * 32,
        email_backend="smtp",
        smtp_host="smtp.example.com",
        smtp_from_email="noreply@example.com",
    )
    assert isinstance(build_email_service(settings), SMTPEmailService)
