from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol
from urllib.parse import urlencode

from app.core.config import Settings

logger = logging.getLogger(__name__)


class EmailService(Protocol):
    async def send_password_reset(self, *, recipient: str, token: str) -> None: ...


class ConsoleEmailService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send_password_reset(self, *, recipient: str, token: str) -> None:
        query = urlencode({"token": token})
        reset_url = f"{self.settings.password_reset_url_base}?{query}"
        # Development-only transport. Never selected in production configuration.
        logger.info(
            "development_password_reset_email",
            extra={"recipient": recipient, "reset_url": reset_url},
        )


class SMTPEmailService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send_password_reset(self, *, recipient: str, token: str) -> None:
        await asyncio.to_thread(self._send, recipient, token)

    def _send(self, recipient: str, token: str) -> None:
        assert self.settings.smtp_host is not None
        assert self.settings.smtp_from_email is not None
        query = urlencode({"token": token})
        reset_url = f"{self.settings.password_reset_url_base}?{query}"
        message = EmailMessage()
        message["Subject"] = "Reset your DB Assistant password"
        message["From"] = self.settings.smtp_from_email
        message["To"] = recipient
        message.set_content(
            "A password reset was requested for your DB Assistant account.\n\n"
            f"Open this link to choose a new password:\n{reset_url}\n\n"
            "If you did not request this, you can ignore this email."
        )
        with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=15) as smtp:
            if self.settings.smtp_starttls:
                smtp.starttls()
            if self.settings.smtp_username:
                smtp.login(self.settings.smtp_username, self.settings.smtp_password or "")
            smtp.send_message(message)


def build_email_service(settings: Settings) -> EmailService:
    if settings.email_backend == "smtp":
        return SMTPEmailService(settings)
    return ConsoleEmailService(settings)
