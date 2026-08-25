from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.agent.tool_schemas import ChartSeriesInput, CreateChartArgs
from app.agent.tools import AgentToolError, build_frontend_chart_payload


def test_frontend_bar_chart_payload_is_grounded_in_sql_columns() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="bar",
        title="Revenue by month",
        x_field="month",
        series=[ChartSeriesInput(field="revenue", label="Revenue")],
    )
    payload, records = build_frontend_chart_payload(
        spec,
        ["month", "revenue"],
        [["Jan", 100], ["Feb", 125]],
    )
    assert payload["renderer"] == "frontend"
    assert payload["chart_type"] == "bar"
    assert payload["data"] == records
    assert records == [
        {"month": "Jan", "revenue": 100},
        {"month": "Feb", "revenue": 125},
    ]
    assert "python" not in str(payload).lower()


def test_frontend_pie_chart_payload() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="pie",
        title="Revenue mix",
        category_field="segment",
        value_field="revenue",
        value_label="Revenue",
    )
    payload, _ = build_frontend_chart_payload(
        spec,
        ["segment", "revenue"],
        [["Enterprise", 80], ["SMB", 20]],
    )
    assert payload["encoding"] == {
        "category": {"field": "segment"},
        "value": {"field": "revenue", "label": "Revenue"},
    }


def test_chart_cannot_reference_nonexistent_sql_column() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="line",
        title="Trend",
        x_field="month",
        series=[ChartSeriesInput(field="profit")],
    )
    with pytest.raises(AgentToolError) as error:
        build_frontend_chart_payload(spec, ["month", "revenue"], [["Jan", 100]])
    assert error.value.code == "CHART_COLUMN_NOT_FOUND"


def test_chart_schema_requires_correct_mapping_for_type() -> None:
    with pytest.raises(ValidationError):
        CreateChartArgs(
            sql_execution_id=uuid.uuid4(),
            chart_type="pie",
            title="Bad pie",
            x_field="month",
            series=[ChartSeriesInput(field="revenue")],
        )
