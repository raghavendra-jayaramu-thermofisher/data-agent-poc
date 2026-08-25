from __future__ import annotations

import asyncio
import io
import json
import os
import re
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest
from openpyxl import Workbook


def workbook_bytes() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Sales"
    sheet.append(["category", "amount"])
    sheet.append(["Hardware", 100])
    sheet.append(["Hardware", 50])
    sheet.append(["Software", 200])
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


class FakeOpenAIHandler(BaseHTTPRequestHandler):
    model_name = "dbassistant-e2e-tool-model"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A003
        return

    def _json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") == "/v1/models":
            self._json(200, {"object": "list", "data": [{"id": self.model_name, "object": "model"}]})
            return
        self._json(404, {"error": {"message": "not found"}})

    @staticmethod
    def _content_text(value: object) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            parts: list[str] = []
            for item in value:
                if isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append(item["text"])
            return "\n".join(parts)
        return ""

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/v1/chat/completions":
            self._json(404, {"error": {"message": "not found"}})
            return
        length = int(self.headers.get("Content-Length", "0"))
        request = json.loads(self.rfile.read(length) or b"{}")
        messages = request.get("messages") or []
        system_text = "\n".join(
            self._content_text(item.get("content"))
            for item in messages
            if isinstance(item, dict) and item.get("role") == "system"
        )
        match = re.search(
            r"Authorized datasource IDs for this conversation:\s*\n-\s*([0-9a-fA-F-]{36})",
            system_text,
        )
        if not match:
            self._json(400, {"error": {"message": "datasource id missing from system prompt"}})
            return
        source_id = match.group(1)
        tool_messages = [item for item in messages if isinstance(item, dict) and item.get("role") == "tool"]
        tool_count = len(tool_messages)

        if tool_count == 0:
            name = "read_knowledge_index"
            arguments = {"data_source_id": source_id}
        elif tool_count == 1:
            index_payload = json.loads(self._content_text(tool_messages[-1].get("content")))
            index_text = str(index_payload.get("index_markdown", ""))
            key_match = re.search(r"schema document key: `([^`]+)`", index_text)
            if not key_match:
                self._json(400, {"error": {"message": "knowledge table key missing"}})
                return
            name = "read_table_schema"
            arguments = {"data_source_id": source_id, "table_key": key_match.group(1)}
        elif tool_count == 2:
            name = "execute_sql"
            arguments = {
                "data_source_id": source_id,
                "sql": (
                    "SELECT category, SUM(amount) AS revenue "
                    "FROM sales GROUP BY category ORDER BY category"
                ),
            }
        elif tool_count == 3:
            sql_payload = json.loads(self._content_text(tool_messages[-1].get("content")))
            name = "create_chart"
            arguments = {
                "sql_execution_id": sql_payload["sql_execution_id"],
                "chart_type": "bar",
                "title": "Revenue by category",
                "x_field": "category",
                "series": [{"field": "revenue", "label": "Revenue"}],
            }
        else:
            time.sleep(0.05)
            self._json(
                200,
                {
                    "id": "chatcmpl-final",
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": self.model_name,
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": (
                                    "Software revenue is 200 and Hardware revenue is 150. "
                                    "A frontend bar-chart specification was created from the SQL result."
                                ),
                            },
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {"prompt_tokens": 40, "completion_tokens": 20, "total_tokens": 60},
                },
            )
            return

        time.sleep(0.05)
        call_id = f"call-{tool_count + 1}"
        self._json(
            200,
            {
                "id": f"chatcmpl-{tool_count + 1}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": self.model_name,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": call_id,
                                    "type": "function",
                                    "function": {
                                        "name": name,
                                        "arguments": json.dumps(arguments),
                                    },
                                }
                            ],
                        },
                        "finish_reason": "tool_calls",
                    }
                ],
                "usage": {"prompt_tokens": 30, "completion_tokens": 10, "total_tokens": 40},
            },
        )


class FakeProvider:
    def __enter__(self) -> str:
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), FakeOpenAIHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.server.server_address
        return f"http://{host}:{port}/v1"

    def __exit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)


async def wait_for_job(
    client: httpx.AsyncClient,
    job_id: str,
    headers: dict[str, str],
    *,
    timeout_seconds: float = 45,
) -> dict[str, object]:
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while asyncio.get_running_loop().time() < deadline:
        response = await client.get(f"/api/v1/jobs/{job_id}", headers=headers)
        assert response.status_code == 200
        body = response.json()
        if body["status"] in {"succeeded", "failed", "cancelled"}:
            return body
        await asyncio.sleep(0.2)
    raise AssertionError(f"Job {job_id} did not complete")


@pytest.mark.asyncio
async def test_task6_complete_product_flow_with_deepagents_and_reporting() -> None:
    base_url = os.getenv("E2E_BASE_URL", "http://localhost:8000")
    unique = uuid.uuid4().hex[:10]
    with FakeProvider() as model_url:
        async with httpx.AsyncClient(base_url=base_url, timeout=20) as client:
            signup = await client.post(
                "/api/v1/auth/signup",
                json={
                    "email": f"task6-{unique}@example.com",
                    "password": "StrongPassword1",
                    "display_name": "Task Six",
                },
            )
            assert signup.status_code == 201, signup.text
            headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}

            upload = await client.post(
                "/api/v1/data-sources/excel",
                headers=headers,
                data={"name": f"Sales Workbook {unique}"},
                files={
                    "file": (
                        "sales.xlsx",
                        workbook_bytes(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )
            assert upload.status_code == 202, upload.text
            source_id = upload.json()["data_source"]["id"]
            materialized = await wait_for_job(client, upload.json()["job_id"], headers)
            assert materialized["status"] == "succeeded", materialized

            knowledge = await client.post(
                f"/api/v1/knowledge/data-sources/{source_id}/generate", headers=headers
            )
            assert knowledge.status_code == 202, knowledge.text
            generated = await wait_for_job(client, knowledge.json()["job_id"], headers)
            assert generated["status"] == "succeeded", generated

            connection = await client.post(
                "/api/v1/models/connections",
                headers=headers,
                json={"name": f"E2E Model {unique}", "base_url": model_url},
            )
            assert connection.status_code == 201, connection.text
            connection_id = connection.json()["id"]
            tested = await client.post(
                f"/api/v1/models/connections/{connection_id}/test", headers=headers
            )
            assert tested.status_code == 200, tested.text

            profile = await client.post(
                "/api/v1/models/profiles",
                headers=headers,
                json={
                    "connection_id": connection_id,
                    "display_name": f"E2E Profile {unique}",
                    "model_name": FakeOpenAIHandler.model_name,
                    "is_default": True,
                },
            )
            assert profile.status_code == 201, profile.text

            conversation = await client.post(
                "/api/v1/conversations",
                headers=headers,
                json={"data_source_ids": [source_id]},
            )
            assert conversation.status_code == 201, conversation.text
            conversation_id = conversation.json()["id"]

            question = await client.post(
                f"/api/v1/conversations/{conversation_id}/messages",
                headers=headers,
                json={"content": "Compare revenue by category and create a useful chart."},
            )
            assert question.status_code == 202, question.text
            chat_job_id = question.json()["job_id"]

            # Connecting/disconnecting from SSE must remain observational; execution is worker-owned.
            async with client.stream(
                "GET", f"/api/v1/jobs/{chat_job_id}/events", headers=headers
            ) as stream:
                assert stream.status_code == 200
                async for line in stream.aiter_lines():
                    if line.startswith("id:"):
                        break

            chat_job = await wait_for_job(client, chat_job_id, headers)
            assert chat_job["status"] == "succeeded", chat_job

            trace = await client.get(f"/api/v1/jobs/{chat_job_id}/execution", headers=headers)
            assert trace.status_code == 200
            trace_body = trace.json()
            product_tools = [item["tool_name"] for item in trace_body["tools"]]
            assert "read_knowledge_index" in product_tools
            assert "read_table_schema" in product_tools
            assert "execute_sql" in product_tools
            assert "create_chart" in product_tools
            assert len(trace_body["sql"]) >= 1
            sql_execution_id = trace_body["sql"][0]["id"]
            chart_artifacts = [item for item in trace_body["artifacts"] if item["kind"] == "chart"]
            assert chart_artifacts
            assert chart_artifacts[0]["payload"]["renderer"] == "frontend"

            conversation_detail = await client.get(
                f"/api/v1/conversations/{conversation_id}", headers=headers
            )
            assert any(
                message["role"] == "assistant" and "Software revenue" in message["content"]
                for message in conversation_detail.json()["messages"]
            )

            dashboard = await client.post(
                "/api/v1/dashboards",
                headers=headers,
                json={"title": f"Revenue Dashboard {unique}"},
            )
            assert dashboard.status_code == 201
            dashboard_id = dashboard.json()["id"]
            widget = await client.post(
                f"/api/v1/dashboards/{dashboard_id}/widgets",
                headers=headers,
                json={
                    "source_job_id": chat_job_id,
                    "source_sql_execution_id": sql_execution_id,
                    "widget_type": "bar",
                    "visualization_config": {
                        "x_field": "category",
                        "series": [{"field": "revenue", "label": "Revenue"}],
                    },
                },
            )
            assert widget.status_code == 201, widget.text
            # Default title comes from the original user question when no explicit title is supplied.
            assert widget.json()["title"].startswith("Compare revenue by category")

            refresh = await client.post(
                f"/api/v1/dashboards/widgets/{widget.json()['id']}/refresh", headers=headers
            )
            assert refresh.status_code == 202
            refreshed_job = await wait_for_job(client, refresh.json()["job_id"], headers)
            assert refreshed_job["status"] == "succeeded", refreshed_job

            refreshed_dashboard = await client.get(
                f"/api/v1/dashboards/{dashboard_id}", headers=headers
            )
            latest = refreshed_dashboard.json()["widgets"][0]["latest_artifact"]
            assert latest["kind"] == "chart"
            assert latest["payload"]["renderer"] == "frontend"

            audit = await client.get("/api/v1/audit", headers=headers)
            assert audit.status_code == 200
            actions = {item["action"] for item in audit.json()}
            assert "datasource.created" in actions
            assert "knowledge.regeneration_requested" in actions
            assert "model_connection.created" in actions
            assert "dashboard.created" in actions
            assert "dashboard_widget.created" in actions
