from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace
from typing import Any

import pytest

from app.agent import deep_agent as module
from app.agent.deep_agent import (
    AgentAuditContext,
    DeepAgentRuntime,
    ToolBinding,
    build_model_audit_callback,
)
from app.agent.tools import AgentToolContext, build_default_tool_registry
from app.core.config import Settings
from app.models.client import ModelRuntimeConfiguration


class FakeToolExecutor:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []
        self.sql_ids = [uuid.uuid4(), uuid.uuid4()]

    async def invoke(self, name: str, arguments: dict[str, object]) -> str:
        self.calls.append((name, arguments))
        if name == "read_knowledge_index":
            return json.dumps({"ok": True, "tables": ["orders", "payments"]})
        if name == "read_table_schema":
            return json.dumps({"ok": True, "columns": ["month", "revenue"]})
        if name == "execute_sql":
            index = sum(1 for called, _ in self.calls if called == "execute_sql") - 1
            return json.dumps(
                {
                    "ok": True,
                    "sql_execution_id": str(self.sql_ids[index]),
                    "columns": ["month", "revenue"],
                    "rows": [["Jan", 100], ["Feb", 120]],
                }
            )
        if name == "create_chart":
            return json.dumps(
                {
                    "ok": True,
                    "renderer": "frontend",
                    "chart_artifact_id": str(uuid.uuid4()),
                }
            )
        raise AssertionError(name)


class FakeRunnable:
    def __init__(self, tools: list[ToolBinding]) -> None:
        self.tools = {item.name: item for item in tools}
        self.config: dict[str, object] | None = None

    async def ainvoke(
        self, input: dict[str, object], config: dict[str, object] | None = None
    ) -> dict[str, object]:
        self.config = config
        source_id = "11111111-1111-1111-1111-111111111111"
        await self.tools["read_knowledge_index"].coroutine(data_source_id=source_id)
        await self.tools["read_table_schema"].coroutine(
            data_source_id=source_id, table_key="orders"
        )
        await self.tools["read_table_schema"].coroutine(
            data_source_id=source_id, table_key="payments"
        )
        first = json.loads(
            await self.tools["execute_sql"].coroutine(
                data_source_id=source_id, sql="SELECT month, revenue FROM orders"
            )
        )
        await self.tools["execute_sql"].coroutine(
            data_source_id=source_id,
            sql="SELECT month, SUM(revenue) revenue FROM payments GROUP BY month",
        )
        await self.tools["create_chart"].coroutine(
            sql_execution_id=first["sql_execution_id"],
            chart_type="line",
            title="Revenue trend",
            x_field="month",
            series=[{"field": "revenue", "label": "Revenue"}],
        )
        return {
            "messages": [
                *input["messages"],  # type: ignore[misc]
                {
                    "role": "assistant",
                    "content": (
                        "Revenue increased from January to February. "
                        "A frontend chart was created."
                    ),
                },
            ]
        }


class FakeFactory:
    def __init__(self) -> None:
        self.runnable: FakeRunnable | None = None
        self.system_prompt: str | None = None

    def create(self, **kwargs: Any) -> FakeRunnable:
        self.system_prompt = str(kwargs["system_prompt"])
        self.runnable = FakeRunnable(kwargs["tools"])
        return self.runnable


@pytest.mark.asyncio
async def test_deep_agent_runtime_handles_multi_step_multi_sql_and_chart(monkeypatch) -> None:
    events: list[str] = []
    audit_flushed = False

    class FakeAudit:
        async def flush(self) -> None:
            nonlocal audit_flushed
            audit_flushed = True

    async def fake_event(job_id, event_type, payload, level="info"):
        del job_id, payload, level
        events.append(event_type)

    async def fake_cancellable(job_id, awaitable, timeout_seconds):
        del job_id, timeout_seconds
        return await awaitable

    monkeypatch.setattr(module, "append_agent_event", fake_event)
    monkeypatch.setattr(module, "run_cancellable", fake_cancellable)
    monkeypatch.setattr(module, "build_model_audit_callback", lambda _: FakeAudit())

    executor = FakeToolExecutor()
    factory = FakeFactory()
    runtime = DeepAgentRuntime(
        factory=factory,
        registry=build_default_tool_registry(),
        tool_executor_factory=lambda _context, _registry: executor,
    )
    source_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    context = AgentToolContext(
        job_id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        conversation_id=uuid.uuid4(),
        allowed_data_source_ids=frozenset({source_id}),
        settings=Settings(app_env="test"),
    )
    model = ModelRuntimeConfiguration(
        profile_id=str(uuid.uuid4()),
        model_name="test-model",
        base_url="http://model.invalid/v1",
        api_key=None,
        settings={},
    )
    result = await runtime.run(
        context=context,
        model=model,
        history=[{"role": "user", "content": "Compare revenue and make a chart"}],
    )

    assert "Revenue increased" in result.notes
    assert result.messages
    assert [name for name, _ in executor.calls] == [
        "read_knowledge_index",
        "read_table_schema",
        "read_table_schema",
        "execute_sql",
        "execute_sql",
        "create_chart",
    ]
    chart_args = executor.calls[-1][1]
    assert chart_args["sql_execution_id"] == str(executor.sql_ids[0])
    assert chart_args["chart_type"] == "line"
    assert events == ["agent.started", "analysis.completed"]
    assert factory.runnable is not None
    assert int(factory.runnable.config["recursion_limit"]) >= 25  # type: ignore[index]
    assert factory.system_prompt is not None
    assert str(source_id) in factory.system_prompt
    assert "Authorized datasource IDs for this conversation" in factory.system_prompt
    assert audit_flushed


@pytest.mark.asyncio
async def test_model_audit_callback_records_from_langchain_worker_thread(monkeypatch) -> None:
    recorded = []

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            del exc_type, exc, traceback

        async def commit(self) -> None:
            return None

    class FakeRepository:
        def __init__(self, session) -> None:
            del session

        async def next_model_sequence(self, job_id) -> int:
            del job_id
            return len(recorded) + 1

        def add_model(self, item) -> None:
            recorded.append(item)

    monkeypatch.setattr(module, "get_session_factory", lambda: lambda: FakeSession())
    monkeypatch.setattr(module, "AgentExecutionRepository", FakeRepository)

    context = AgentAuditContext(
        job_id=uuid.uuid4(),
        model_profile_id=uuid.uuid4(),
        model_name="analysis-model",
        product_tool_names=frozenset(),
    )
    callback = build_model_audit_callback(context)
    assert callback is not None
    run_id = uuid.uuid4()
    await asyncio.to_thread(callback.on_llm_start, {}, [], run_id=run_id)
    response = SimpleNamespace(
        llm_output={"usage": {"prompt_tokens": 10, "completion_tokens": 4, "total_tokens": 14}},
        generations=[],
    )
    await asyncio.to_thread(callback.on_llm_end, response, run_id=run_id)
    await callback.flush()

    assert len(recorded) == 1
    assert recorded[0].phase == "analysis"
    assert recorded[0].status == "succeeded"
    assert recorded[0].total_tokens == 14
