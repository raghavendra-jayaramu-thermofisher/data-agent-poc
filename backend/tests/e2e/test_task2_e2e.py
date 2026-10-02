from __future__ import annotations

import asyncio
import io
import os
import uuid

import httpx
import pytest
from openpyxl import Workbook


def workbook_bytes() -> bytes:
    workbook = Workbook()
    orders = workbook.active
    orders.title = "Orders"
    orders.append(["order_id", "amount"])
    orders.append([1, 10.5])
    orders.append([2, 20.0])
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


async def wait_for_job(
    client: httpx.AsyncClient,
    job_id: str,
    headers: dict[str, str],
    *,
    timeout_seconds: float = 30,
) -> dict[str, object]:
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while asyncio.get_running_loop().time() < deadline:
        response = await client.get(f"/api/v1/jobs/{job_id}", headers=headers)
        assert response.status_code == 200
        body = response.json()
        if body["status"] in {"succeeded", "failed", "cancelled"}:
            return body
        await asyncio.sleep(0.25)
    raise AssertionError(f"Job {job_id} did not complete within {timeout_seconds} seconds")


@pytest.mark.asyncio
async def test_task2_real_api_excel_materialization_flow() -> None:
    base_url = os.getenv("E2E_BASE_URL", "http://localhost:12201")
    unique = uuid.uuid4().hex[:10]
    email = f"task2-{unique}@example.com"
    async with httpx.AsyncClient(base_url=base_url, timeout=15) as client:
        signup = await client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": "StrongPassword1", "display_name": "Task Two"},
        )
        assert signup.status_code == 201
        headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}

        upload = await client.post(
            "/api/v1/data-sources/excel",
            headers=headers,
            data={"name": f"E2E Workbook {unique}"},
            files={
                "file": (
                    "orders.xlsx",
                    workbook_bytes(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert upload.status_code == 202
        body = upload.json()
        data_source_id = body["data_source"]["id"]
        job = await wait_for_job(client, body["job_id"], headers)
        assert job["status"] == "succeeded", job

        detail = await client.get(f"/api/v1/data-sources/{data_source_id}", headers=headers)
        assert detail.status_code == 200
        data_source = detail.json()
        assert data_source["kind"] == "duckdb"
        assert data_source["display_type"] == "excel"
        assert data_source["status"] == "active"
        assert data_source["active_file"]["status"] == "ready"

        schema = await client.get(f"/api/v1/data-sources/{data_source_id}/schema", headers=headers)
        assert schema.status_code == 200
        assert {table["name"] for table in schema.json()["tables"]} == {"orders"}
