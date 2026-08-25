from __future__ import annotations

from dataclasses import dataclass

import pytest
from httpx import AsyncClient

from app.auth.email import EmailService
from app.auth.router import get_email_service
from app.main import create_app


async def signup(client: AsyncClient, email: str) -> dict[str, object]:
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "StrongPassword1", "display_name": "Test User"},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_signup_login_refresh_rotation_and_logout(client: AsyncClient) -> None:
    tokens = await signup(client, "person@example.com")
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    duplicate = await client.post(
        "/api/v1/auth/signup",
        json={"email": "PERSON@example.com", "password": "StrongPassword1"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "PERSON@example.com", "password": "StrongPassword1"},
    )
    assert login.status_code == 200
    login_tokens = login.json()

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {login_tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "person@example.com"

    rotated = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login_tokens["refresh_token"]}
    )
    assert rotated.status_code == 200
    new_refresh = rotated.json()["refresh_token"]
    assert new_refresh != login_tokens["refresh_token"]

    reused = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login_tokens["refresh_token"]}
    )
    assert reused.status_code == 401

    logout = await client.post("/api/v1/auth/logout", json={"refresh_token": new_refresh})
    assert logout.status_code == 200
    after_logout = await client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    assert after_logout.status_code == 401


@pytest.mark.asyncio
async def test_invalid_login_is_generic(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "WrongPassword1"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


@dataclass
class CapturingEmailService(EmailService):
    token: str | None = None

    async def send_password_reset(self, *, recipient: str, token: str) -> None:
        del recipient
        self.token = token


@pytest.mark.asyncio
async def test_forgot_and_reset_password_flow() -> None:
    mailer = CapturingEmailService()
    app = create_app()
    app.dependency_overrides[get_email_service] = lambda: mailer
    from httpx import ASGITransport, AsyncClient

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            await signup(client, "reset@example.com")
            forgot = await client.post(
                "/api/v1/auth/forgot-password", json={"email": "reset@example.com"}
            )
            assert forgot.status_code == 200
            assert mailer.token is not None

            reset = await client.post(
                "/api/v1/auth/reset-password",
                json={"token": mailer.token, "new_password": "NewStrongPassword2"},
            )
            assert reset.status_code == 200

            reused = await client.post(
                "/api/v1/auth/reset-password",
                json={"token": mailer.token, "new_password": "AnotherStrong3"},
            )
            assert reused.status_code == 400

            old_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "reset@example.com", "password": "StrongPassword1"},
            )
            assert old_login.status_code == 401
            new_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "reset@example.com", "password": "NewStrongPassword2"},
            )
            assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_organization_isolation(client: AsyncClient) -> None:
    first = await signup(client, "one@example.com")
    second = await signup(client, "two@example.com")

    first_headers = {"Authorization": f"Bearer {first['access_token']}"}
    second_headers = {"Authorization": f"Bearer {second['access_token']}"}

    second_org = await client.get("/api/v1/organizations/current", headers=second_headers)
    assert second_org.status_code == 200
    second_org_id = second_org.json()["id"]

    forbidden = await client.get(
        "/api/v1/organizations/current",
        headers={**first_headers, "X-Organization-ID": second_org_id},
    )
    assert forbidden.status_code == 404
    assert forbidden.json()["error"]["code"] == "ORGANIZATION_NOT_FOUND"
