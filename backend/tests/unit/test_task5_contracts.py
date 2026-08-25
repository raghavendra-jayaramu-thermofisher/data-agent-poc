from __future__ import annotations

import math
import uuid

import pytest

from app.agent.serialization import json_safe
from app.agent.tool_schemas import CreateChartArgs
from app.agent.tools import (
    AgentToolError,
    build_frontend_chart_payload,
    enforce_tool_preconditions,
)


def test_schema_read_requires_index_for_same_datasource() -> None:
    source_id = uuid.uuid4()
    with pytest.raises(AgentToolError) as exc:
        enforce_tool_preconditions(
            "read_table_schema",
            {"data_source_id": str(source_id), "table_key": "orders"},
            loaded_knowledge_indexes=set(),
        )
    assert exc.value.code == "KNOWLEDGE_INDEX_REQUIRED"

    enforce_tool_preconditions(
        "read_table_schema",
        {"data_source_id": str(source_id), "table_key": "orders"},
        loaded_knowledge_indexes={source_id},
    )


def test_index_for_one_datasource_does_not_unlock_another() -> None:
    loaded = uuid.uuid4()
    other = uuid.uuid4()
    with pytest.raises(AgentToolError) as exc:
        enforce_tool_preconditions(
            "read_table_schema",
            {"data_source_id": str(other), "table_key": "payments"},
            loaded_knowledge_indexes={loaded},
        )
    assert exc.value.code == "KNOWLEDGE_INDEX_REQUIRED"


def test_frontend_chart_rejects_non_numeric_series() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="bar",
        title="Revenue by month",
        x_field="month",
        series=[{"field": "revenue", "label": "Revenue"}],
    )
    with pytest.raises(AgentToolError) as exc:
        build_frontend_chart_payload(
            spec,
            ["month", "revenue"],
            [["Jan", "not-a-number"]],
        )
    assert exc.value.code == "CHART_VALUE_NOT_NUMERIC"


def test_frontend_chart_accepts_numeric_strings_from_decimal_serialization() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="line",
        title="Revenue trend",
        x_field="month",
        series=[{"field": "revenue"}],
    )
    payload, records = build_frontend_chart_payload(
        spec,
        ["month", "revenue"],
        [["Jan", "100.25"], ["Feb", 120]],
    )
    assert payload["renderer"] == "frontend"
    assert payload["chart_type"] == "line"
    assert records[0]["revenue"] == "100.25"


def test_json_safe_nonfinite_floats_are_valid_json_values() -> None:
    assert json_safe(float("nan")) == "NaN"
    assert json_safe(float("inf")) == "Infinity"
    assert json_safe(float("-inf")) == "-Infinity"
    assert json_safe(1.25) == 1.25


def test_chart_artifact_never_contains_python_renderer_fields() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="pie",
        title="Revenue mix",
        category_field="segment",
        value_field="revenue",
    )
    payload, _ = build_frontend_chart_payload(
        spec,
        ["segment", "revenue"],
        [["A", 60], ["B", 40]],
    )
    assert payload["renderer"] == "frontend"
    flattened = str(payload).lower()
    assert "matplotlib" not in flattened
    assert "python" not in flattened
    assert "png" not in flattened
