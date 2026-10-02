from __future__ import annotations

import os

import httpx
import pytest


@pytest.mark.asyncio
async def test_task1_real_api_auth_and_workspace_flow() -> None:
    base_url = os.getenv("E2E_BASE_URL", "http://localhost:12201")
    async with httpx.AsyncClient(base_url=base_url, timeout=10) as client:
        health = await client.get("/health")
        assert health.status_code == 200

        email = "task1-e2e@example.com"
        signup = await client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": "StrongPassword1", "display_name": "Task One"},
        )
        assert signup.status_code in {201, 409}
        if signup.status_code == 409:
            login = await client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "StrongPassword1"},
            )
            assert login.status_code == 200
            tokens = login.json()
        else:
            tokens = signup.json()

        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        me = await client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200
        current_org = await client.get("/api/v1/organizations/current", headers=headers)
        assert current_org.status_code == 200
        assert current_org.json()["role"] == "owner"
