"""Opt-in provider evaluation using synthetic results; never executes model tool calls.

Run with --source-id to select the owning workspace's configured default model.
No business rows, credentials, or datasource configuration are sent to the provider.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from dataclasses import replace
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import StructuredTool

from app.agent.deep_agent import SYSTEM_PROMPT, _build_chat_model
from app.agent.matrix import CreateMatrixArgs, build_matrix
from app.agent.tools import build_default_tool_registry
from app.core.config import get_settings
from app.core.database import close_database, get_session_factory
from app.data_sources.models import DataSource
from app.main import app  # noqa: F401 -- register ORM models
from app.models.service import ModelConfigurationService


async def unused(**kwargs):
    raise AssertionError("Evaluation does not execute model tool calls")


async def evaluate(source_id: uuid.UUID) -> list[dict]:
    async with get_session_factory()() as session:
        source = await session.get(DataSource, source_id)
        if source is None:
            raise ValueError("Specified datasource is unavailable")
        service = ModelConfigurationService(session, get_settings())
        profile = await service.get_default(source.organization_id)
        if profile is None:
            raise ValueError("The workspace has no default model")
        runtime = await service.get_runtime_configuration(
            profile_id=profile.id,
            organization_id=source.organization_id,
        )
    runtime = replace(runtime, settings={**runtime.settings, "max_tokens": 2048})
    tools = [
        StructuredTool.from_function(
            name=item.name,
            description=item.description,
            args_schema=item.args_schema,
            coroutine=unused,
        )
        for item in build_default_tool_registry().all()
    ]
    model = _build_chat_model(runtime, 60).bind_tools(tools)
    cross_columns = ["region", "month", "amount", "rd", "cd"]
    cross_rows = [
        ["North", "2026-01-01", 100, 1, 1],
        ["South", "2026-01-01", 200, 1, 1],
        [None, "2026-01-01", 300, 0, 1],
        ["North", "2026-02-01", 120, 1, 1],
        ["South", "2026-02-01", 160, 1, 1],
        [None, "2026-02-01", 280, 0, 1],
    ]
    cases = [
        (
            "matrix_auto",
            "Compare exact revenue amounts by region for each month.",
            cross_columns,
            cross_rows,
            True,
        ),
        (
            "matrix_explicit",
            "Show revenue as a matrix, regions down and months across.",
            cross_columns,
            cross_rows,
            True,
        ),
        (
            "list",
            "List the order IDs and their amounts.",
            ["order_id", "amount"],
            [["O1", 100], ["O2", 200]],
            False,
        ),
        ("single", "What is total revenue?", ["amount"], [[300]], False),
        (
            "chart",
            "Show a line chart of revenue over time.",
            ["month", "amount"],
            [["2026-01-01", 100], ["2026-02-01", 120]],
            False,
        ),
    ]
    report = []
    execution = "11111111-1111-4111-8111-111111111111"
    for name, question, columns, rows, expected_matrix in cases:
        result = {
            "ok": True,
            "sql_execution_id": execution,
            "table_artifact_id": "22222222-2222-4222-8222-222222222222",
            "columns": columns,
            "rows": rows,
            "stored_result_truncated": False,
            "preview_truncated": False,
            "table_display": "expanded",
            "stored_row_count": len(rows),
        }
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(
                content=question
                + "\nThe authorized schema and knowledge have already been inspected. "
                "The verified SQL result is ready. Choose its best final presentation; "
                "no further discovery or SQL is needed."
            ),
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "execute_sql",
                        "args": {
                            "data_source_id": "44444444-4444-4444-8444-444444444444",
                            "sql": "SELECT verified_result",
                        },
                        "id": "prepared",
                    }
                ],
            ),
            ToolMessage(content=json.dumps(result), tool_call_id="prepared"),
        ]
        response = await asyncio.wait_for(model.ainvoke(messages), timeout=65)
        names = [call["name"] for call in response.tool_calls]
        valid = True
        for call in response.tool_calls:
            if call["name"] == "create_matrix":
                try:
                    build_matrix(CreateMatrixArgs.model_validate(call["args"]), columns, rows)
                except ValueError:
                    valid = False
        item = {
            "case": name,
            "tools": names,
            "expected_matrix": expected_matrix,
            "passed": ("create_matrix" in names) == expected_matrix and valid,
        }
        report.append(item)
        print(json.dumps(item), flush=True)
    return report


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-id", type=uuid.UUID, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = await evaluate(args.source_id)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        if not all(item["passed"] for item in report):
            raise SystemExit("Matrix selection evaluation failed; inspect the report")
    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(main())
