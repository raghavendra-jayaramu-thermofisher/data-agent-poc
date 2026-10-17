import copy
import json
import uuid
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.agent.evidence import _valid_chart_artifact
from app.agent.models import SQLExecution
from app.agent.tool_schemas import CreateChartArgs
from app.agent.tools import AgentToolError, build_frontend_chart_payload
from app.reporting.jobs import _chart_args
from app.reporting.schemas import DashboardWidgetCreate

FIXTURE = json.loads(
    (Path(__file__).resolve().parents[3] / "test-fixtures/combo-chart.json").read_text()
)


def config():
    return {
        "x_field": "month",
        "x_label": "Month",
        "series": copy.deepcopy(FIXTURE["encoding"]["series"]),
        "stacked": True,
        "y_label": FIXTURE["y_label"],
        "secondary_y_label": FIXTURE["secondary_y_label"],
    }


def test_combo_contract_survives_dashboard_refresh_and_evidence():
    sql_id = uuid.UUID(FIXTURE["source_sql_execution_id"])
    widget = DashboardWidgetCreate(
        source_job_id=uuid.uuid4(),
        source_sql_execution_id=sql_id,
        widget_type="combo",
        visualization_config=config(),
    )
    args = _chart_args(widget.widget_type, FIXTURE["title"], sql_id, widget.visualization_config)
    columns = list(FIXTURE["data"][0])
    rows = [[row[column] for column in columns] for row in FIXTURE["data"]]
    payload, records = build_frontend_chart_payload(args, columns, rows)
    assert payload == FIXTURE
    assert records == FIXTURE["data"]
    source = SQLExecution(id=sql_id, columns=columns)
    assert _valid_chart_artifact(payload, source)
    invalid = copy.deepcopy(payload)
    invalid["encoding"]["series"][0]["axis"] = "secondary"
    assert not _valid_chart_artifact(invalid, source)


@pytest.mark.parametrize(
    "change",
    [
        {"series": [{"field": "online", "type": "bar"}]},
        {"series": [{"field": "online"}, {"field": "target", "type": "line"}]},
        {"orientation": "horizontal"},
        {
            "series": [
                {"field": "online", "type": "bar", "axis": "secondary"},
                {"field": "target", "type": "line"},
            ]
        },
        {
            "series": [
                {"field": "online", "type": "bar", "unit": "count"},
                {"field": "target", "type": "line", "unit": "%"},
            ]
        },
    ],
)
def test_combo_rejects_incomplete_or_mixed_axis_mappings(change):
    with pytest.raises(ValidationError):
        CreateChartArgs(
            sql_execution_id=uuid.uuid4(), chart_type="combo", title="Chart", **(config() | change)
        )


@pytest.mark.parametrize(
    "case,code",
    [
        ("null_bar", "CHART_VALUE_MISSING"),
        ("repeated_x", "CHART_DIMENSION_NOT_UNIQUE"),
        ("repeated_field", "CHART_SERIES_FIELD_REUSED"),
        ("non_numeric", "CHART_VALUE_NOT_NUMERIC"),
    ],
)
def test_combo_uses_existing_sql_grain_and_numeric_checks(case, code):
    mapping = config()
    columns = ["month", "online", "store", "fulfilled", "target"]
    rows = [["Jan", 10, 20, None, 90], ["Feb", 20, 10, 80, 90]]
    if case == "null_bar":
        rows[0][1] = None
    if case == "repeated_x":
        rows[1][0] = "Jan"
    if case == "repeated_field":
        mapping["series"][1]["field"] = "online"
    if case == "non_numeric":
        rows[0][3] = "missing"
    args = CreateChartArgs(
        sql_execution_id=uuid.uuid4(), chart_type="combo", title="Chart", **mapping
    )
    with pytest.raises(AgentToolError) as error:
        build_frontend_chart_payload(args, columns, rows)
    assert error.value.code == code


def test_combo_can_share_one_scale_and_group_columns():
    mapping = config()
    mapping["stacked"] = False
    for series in mapping["series"]:
        series.update(axis="primary", unit="count")
    args = CreateChartArgs(
        sql_execution_id=uuid.uuid4(), chart_type="combo", title="Chart", **mapping
    )
    assert all(series.axis == "primary" for series in args.series)
