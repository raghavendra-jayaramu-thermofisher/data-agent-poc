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


@pytest.mark.parametrize("orientation", ["vertical", "horizontal"])
@pytest.mark.parametrize("stacked", [False, True])
def test_bar_options_survive_payload_and_dashboard_refresh(orientation: str, stacked: bool) -> None:
    from app.reporting.jobs import _chart_args

    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="bar",
        title="Sales by category",
        x_field="category",
        series=[{"field": "online"}, {"field": "store"}],
        orientation=orientation,
        stacked=stacked,
    )
    payload, records = build_frontend_chart_payload(
        spec,
        ["category", "online", "store"],
        [["Services", 20, 30], ["Products", -5, 10]],
    )
    assert payload["orientation"] == orientation
    assert payload["stacked"] is stacked
    assert records[1]["online"] == -5
    refreshed = _chart_args(
        "bar",
        spec.title,
        spec.sql_execution_id,
        {
            "x_field": "category",
            "series": [{"field": "online"}, {"field": "store"}],
            "orientation": orientation,
            "stacked": stacked,
        },
    )
    assert refreshed == spec


def test_legacy_bar_defaults_remain_grouped_vertical_columns() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="bar",
        title="Sales",
        x_field="category",
        series=[{"field": "sales"}],
    )
    payload, _ = build_frontend_chart_payload(spec, ["category", "sales"], [["Services", 5]])
    assert payload["orientation"] == "vertical"
    assert payload["stacked"] is False


@pytest.mark.parametrize("chart_type", ["line", "area", "pie", "donut", "metric"])
@pytest.mark.parametrize("options", [{"orientation": "horizontal"}, {"stacked": True}])
def test_bar_options_are_rejected_for_other_chart_types(chart_type: str, options: dict) -> None:
    mapping = (
        {"category_field": "category", "value_field": "value"}
        if chart_type in {"pie", "donut"}
        else {"value_field": "value"}
        if chart_type == "metric"
        else {"x_field": "category", "series": [{"field": "value"}]}
    )
    with pytest.raises(ValidationError):
        CreateChartArgs(
            sql_execution_id=uuid.uuid4(), chart_type=chart_type, title="Test", **mapping, **options
        )


def test_donut_is_sql_grounded_and_accepted_as_final_answer_evidence() -> None:
    from app.agent.evidence import _valid_chart_artifact
    from app.agent.models import SQLExecution
    from app.reporting.jobs import _chart_args
    from app.reporting.schemas import DashboardWidgetCreate

    sql_id = uuid.uuid4()
    config = {"category_field": "category", "value_field": "sales"}
    widget = DashboardWidgetCreate(
        source_job_id=uuid.uuid4(),
        source_sql_execution_id=sql_id,
        widget_type="donut",
        visualization_config=config,
    )
    spec = _chart_args(widget.widget_type, "Sales mix", sql_id, config)
    payload, records = build_frontend_chart_payload(
        spec,
        ["category", "sales"],
        [["Services", 60], ["Products", "40"]],
    )
    assert payload["chart_type"] == "donut"
    assert records == [
        {"category": "Services", "sales": 60},
        {"category": "Products", "sales": "40"},
    ]
    source = SQLExecution(id=sql_id, columns=["category", "sales"])
    assert _valid_chart_artifact(payload, source)
    assert not _valid_chart_artifact({**payload, "stacked": True}, source)
    assert not _valid_chart_artifact({**payload, "orientation": []}, source)


@pytest.mark.parametrize(
    "rows,code",
    [
        ([["A", -5], ["B", 10]], "CHART_VALUE_NEGATIVE"),
        ([["A", "-5"], ["B", "10"]], "CHART_VALUE_NEGATIVE"),
        ([["A", 0], ["B", 0]], "CHART_TOTAL_EMPTY"),
        ([["A", None], ["B", 10]], "CHART_VALUE_MISSING"),
        ([["A", 5], ["A", 10]], "CHART_CATEGORY_NOT_UNIQUE"),
    ],
)
def test_donut_rejects_misleading_or_unrenderable_values(rows: list, code: str) -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="donut",
        title="Mix",
        category_field="category",
        value_field="value",
    )
    with pytest.raises(AgentToolError) as error:
        build_frontend_chart_payload(spec, ["category", "value"], rows)
    assert error.value.code == code


def test_stacked_chart_rejects_missing_components() -> None:
    spec = CreateChartArgs(
        sql_execution_id=uuid.uuid4(),
        chart_type="bar",
        title="Sales mix",
        x_field="category",
        stacked=True,
        series=[{"field": "online"}, {"field": "store"}],
    )
    with pytest.raises(AgentToolError) as error:
        build_frontend_chart_payload(
            spec, ["category", "online", "store"], [["Services", 10, None]]
        )
    assert error.value.code == "CHART_VALUE_MISSING"
