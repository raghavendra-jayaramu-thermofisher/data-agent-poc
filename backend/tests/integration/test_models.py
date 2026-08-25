from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


async def signup(client: AsyncClient, email: str) -> tuple[dict[str, str], uuid.UUID]:
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "StrongPassword1"},
    )
    assert response.status_code == 201
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    org = await client.get("/api/v1/organizations/current", headers=headers)
    assert org.status_code == 200
    return headers, uuid.UUID(org.json()["id"])


@pytest.mark.asyncio
async def test_model_configuration_crud_redaction_default_and_org_isolation(
    client: AsyncClient,
) -> None:
    first_headers, _ = await signup(client, "models-one@example.com")
    second_headers, _ = await signup(client, "models-two@example.com")

    created = await client.post(
        "/api/v1/models/connections",
        headers=first_headers,
        json={
            "name": "Compatible API",
            "base_url": "http://127.0.0.1:9999/v1",
            "api_key": "model-secret-key",
        },
    )
    assert created.status_code == 201
    assert created.json()["has_api_key"] is True
    assert "model-secret-key" not in created.text
    assert "secret_id" not in created.text
    connection_id = created.json()["id"]

    assert (
        await client.get(f"/api/v1/models/connections/{connection_id}", headers=second_headers)
    ).status_code == 404

    first_profile = await client.post(
        "/api/v1/models/profiles",
        headers=first_headers,
        json={
            "connection_id": connection_id,
            "display_name": "Primary Model",
            "model_name": "model-a",
            "settings": {"temperature": 0.1},
        },
    )
    assert first_profile.status_code == 201
    assert first_profile.json()["is_default"] is True

    second_profile = await client.post(
        "/api/v1/models/profiles",
        headers=first_headers,
        json={
            "connection_id": connection_id,
            "display_name": "Secondary Model",
            "model_name": "model-b",
            "settings": {},
        },
    )
    assert second_profile.status_code == 201
    assert second_profile.json()["is_default"] is False

    made_default = await client.post(
        f"/api/v1/models/profiles/{second_profile.json()['id']}/default",
        headers=first_headers,
    )
    assert made_default.status_code == 200
    assert made_default.json()["is_default"] is True

    current = await client.get("/api/v1/models/profiles/default", headers=first_headers)
    assert current.status_code == 200
    assert current.json()["id"] == second_profile.json()["id"]

    disabled = await client.patch(
        f"/api/v1/models/profiles/{second_profile.json()['id']}",
        headers=first_headers,
        json={"enabled": False},
    )
    assert disabled.status_code == 200
    assert disabled.json()["is_default"] is False

    promoted = await client.get("/api/v1/models/profiles/default", headers=first_headers)
    assert promoted.status_code == 200
    assert promoted.json()["id"] == first_profile.json()["id"]


@pytest.mark.asyncio
async def test_model_connection_duplicate_names_are_scoped_per_organization(
    client: AsyncClient,
) -> None:
    first_headers, _ = await signup(client, "model-dup-one@example.com")
    second_headers, _ = await signup(client, "model-dup-two@example.com")
    payload = {
        "name": "OpenAI Compatible",
        "base_url": "http://localhost:8000/v1",
        "api_key": "key",
    }
    assert (await client.post("/api/v1/models/connections", headers=first_headers, json=payload)).status_code == 201
    assert (await client.post("/api/v1/models/connections", headers=first_headers, json=payload)).status_code == 409
    assert (await client.post("/api/v1/models/connections", headers=second_headers, json=payload)).status_code == 201
