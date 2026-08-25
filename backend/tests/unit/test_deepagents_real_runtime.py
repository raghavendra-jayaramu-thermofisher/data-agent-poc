from __future__ import annotations

import json
from typing import Any

import pytest

pytest.importorskip("deepagents", reason="Install Task 5 dependencies for the real Deep Agents smoke test")
pytest.importorskip("langchain_core", reason="Install Task 5 dependencies for the real Deep Agents smoke test")
pytest.importorskip("langchain_openai", reason="Install Task 5 dependencies for the real Deep Agents smoke test")

from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.agent.deep_agent import ProductionDeepAgentFactory, ToolBinding
from app.agent.tool_schemas import CreateChartArgs, ExecuteSQLArgs, ReadKnowledgeIndexArgs, ReadTableSchemaArgs
from app.models.client import ModelRuntimeConfiguration


class MultiStepFakeModel(FakeMessagesListChatModel):
    """Hermetic model that drives a real Deep Agents graph through six tool calls."""

    def bind_tools(self, tools: Any, **kwargs: Any) -> "MultiStepFakeModel":
        del tools, kwargs
        return self

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        del stop, run_manager, kwargs
        tool_messages = [message for message in messages if isinstance(message, ToolMessage)]
        step = len(tool_messages)
        source = "11111111-1111-1111-1111-111111111111"
        calls: list[dict[str, object]] = []
        if step == 0:
            calls = [{"id": "t1", "name": "read_knowledge_index", "args": {"data_source_id": source}}]
        elif step == 1:
            calls = [{"id": "t2", "name": "read_table_schema", "args": {"data_source_id": source, "table_key": "orders"}}]
        elif step == 2:
            calls = [{"id": "t3", "name": "read_table_schema", "args": {"data_source_id": source, "table_key": "payments"}}]
        elif step == 3:
            calls = [{"id": "t4", "name": "execute_sql", "args": {"data_source_id": source, "sql": "SELECT month, revenue FROM orders"}}]
        elif step == 4:
            calls = [{"id": "t5", "name": "execute_sql", "args": {"data_source_id": source, "sql": "SELECT month, revenue FROM payments"}}]
        elif step == 5:
            first_result = json.loads(tool_messages[3].content)
            calls = [{
                "id": "t6",
                "name": "create_chart",
                "args": {
                    "sql_execution_id": first_result["sql_execution_id"],
                    "chart_type": "bar",
                    "title": "Revenue by month",
                    "x_field": "month",
                    "series": [{"field": "revenue", "label": "Revenue"}],
                },
            }]
        if calls:
            response = AIMessage(content="", tool_calls=calls)
        else:
            response = AIMessage(content="Analysis complete with a frontend chart.")
        return ChatResult(generations=[ChatGeneration(message=response)])


@pytest.mark.asyncio
async def test_production_factory_runs_real_deepagents_multistep_graph(monkeypatch) -> None:
    import langchain_openai

    fake_model = MultiStepFakeModel(responses=[])
    monkeypatch.setattr(langchain_openai, "ChatOpenAI", lambda **kwargs: fake_model)

    executed: list[str] = []
    sql_id = "22222222-2222-2222-2222-222222222222"

    async def read_index(data_source_id: str) -> str:
        executed.append("read_knowledge_index")
        return json.dumps({"tables": ["orders", "payments"]})

    async def read_schema(data_source_id: str, table_key: str) -> str:
        del data_source_id, table_key
        executed.append("read_table_schema")
        return json.dumps({"columns": ["month", "revenue"]})

    async def execute(data_source_id: str, sql: str) -> str:
        del data_source_id, sql
        executed.append("execute_sql")
        return json.dumps({"sql_execution_id": sql_id, "columns": ["month", "revenue"], "rows": [["Jan", 100]]})

    async def chart(**kwargs: object) -> str:
        assert kwargs["sql_execution_id"] == sql_id
        executed.append("create_chart")
        return json.dumps({"renderer": "frontend", "chart_artifact_id": "chart-1"})

    tools = [
        ToolBinding("read_knowledge_index", "Read index", ReadKnowledgeIndexArgs, read_index),
        ToolBinding("read_table_schema", "Read schema", ReadTableSchemaArgs, read_schema),
        ToolBinding("execute_sql", "Execute SQL", ExecuteSQLArgs, execute),
        ToolBinding("create_chart", "Create frontend chart", CreateChartArgs, chart),
    ]
    runnable = ProductionDeepAgentFactory().create(
        model=ModelRuntimeConfiguration(
            profile_id="33333333-3333-3333-3333-333333333333",
            model_name="fake",
            base_url="http://example.invalid/v1",
            api_key=None,
            settings={},
        ),
        tools=tools,
        system_prompt="Use the supplied tools.",
        timeout_seconds=1,
    )
    result = await runnable.ainvoke({"messages": [{"role": "user", "content": "Analyze revenue and chart it"}]})
    assert result["messages"][-1].content == "Analysis complete with a frontend chart."
    assert executed == [
        "read_knowledge_index",
        "read_table_schema",
        "read_table_schema",
        "execute_sql",
        "execute_sql",
        "create_chart",
    ]
