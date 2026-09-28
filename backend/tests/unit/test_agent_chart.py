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


def test_cartesian_chart_rejects_reused_series_field() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="bar",
        title="Hold breakdown",
        x_field="customer",
        series=[
            ChartSeriesInput(field="amount", label="Credit Hold"),
            ChartSeriesInput(field="amount", label="Customer Hold"),
        ],
    )
    with pytest.raises(AgentToolError) as error:
        build_frontend_chart_payload(
            spec,
            ["customer", "category", "amount"],
            [["Acme", "Credit Hold", 10], ["Acme", "Customer Hold", 20]],
        )
    assert error.value.code == "CHART_SERIES_FIELD_REUSED"
    assert error.value.retryable is True


def test_cartesian_chart_requires_one_row_per_dimension_value() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="bar",
        title="Revenue by customer",
        x_field="customer",
        series=[ChartSeriesInput(field="revenue")],
    )
    with pytest.raises(AgentToolError) as error:
        build_frontend_chart_payload(
            spec,
            ["customer", "revenue"],
            [["Acme", 10], ["Acme", 20]],
        )
    assert error.value.code == "CHART_DIMENSION_NOT_UNIQUE"
    assert error.value.retryable is True


def test_pie_chart_requires_one_row_per_category() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="pie",
        title="Revenue mix",
        category_field="segment",
        value_field="revenue",
    )
    with pytest.raises(AgentToolError) as error:
        build_frontend_chart_payload(
            spec,
            ["segment", "revenue"],
            [["Enterprise", 10], ["Enterprise", 20]],
        )
    assert error.value.code == "CHART_CATEGORY_NOT_UNIQUE"


def test_metric_chart_requires_exactly_one_row() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="metric",
        title="Revenue",
        value_field="revenue",
    )
    with pytest.raises(AgentToolError) as error:
        build_frontend_chart_payload(
            spec,
            ["revenue"],
            [[10], [20]],
        )
    assert error.value.code == "CHART_METRIC_ROW_COUNT_INVALID"


def test_chart_rejects_nonfinite_numeric_values() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="bar",
        title="Revenue by month",
        x_field="month",
        series=[ChartSeriesInput(field="revenue")],
    )
    with pytest.raises(AgentToolError) as error:
        build_frontend_chart_payload(
            spec,
            ["month", "revenue"],
            [["Jan", float("nan")]],
        )
    assert error.value.code == "CHART_VALUE_NOT_NUMERIC"
