# Line and stacked column charts

The existing `create_chart` tool accepts `chart_type: "combo"`. The frontend uses the installed
Apache ECharts renderer; no Power BI embedding or additional chart library is required.
This is generic presentation configuration. The tool reads a successful SQL execution from the
same job and does not accept data values, formulas, or business-specific grouping rules.

## Contract

- `x_field`: one shared category or time field. SQL returns one row per category, in display order.
- `series`: two to eight distinct numeric output fields. Each declares `type: "bar"` (column)
  or `type: "line"`; at least one of each is required. Labels rename measures without filtering rows.
- `stacked: true`: columns stack; line series never stack. `false` groups columns side by side.
- `axis: "primary"`: mandatory for columns; also available to lines for a shared scale.
- `axis: "secondary"`: optional for lines, with a separately labeled right Y-axis. Assignment is
  explicit even when both axes use the same unit. Sharing an axis means sharing its scale.
- `unit`: optional metadata. Known units on each axis must agree. Distinct units require separate
  axes. `y_label` and `secondary_y_label` customize the axis titles.
- Stacked columns require complete values. A SQL `NULL` in a line is displayed as a gap, not zero;
  invalid numeric text and entirely empty measures are rejected. Negative columns stack by sign.
- Truncated SQL results cannot create or refresh combo charts. Narrow or aggregate the query first.

Prepare aggregates, pivots, ordering, ratios and targets in SQL. For example, a SQL result with
`month`, `component_a`, `component_b`, `rate`, and `target` can use:

```json
{
  "sql_execution_id": "<successful SQL execution UUID>",
  "chart_type": "combo",
  "title": "Components and rate by month",
  "x_field": "month",
  "stacked": true,
  "y_label": "Volume (count)",
  "secondary_y_label": "Rate (%)",
  "series": [
    {"field": "component_a", "type": "bar", "axis": "primary", "unit": "count"},
    {"field": "component_b", "type": "bar", "axis": "primary", "unit": "count"},
    {"field": "rate", "type": "line", "axis": "secondary", "unit": "%"},
    {"field": "target", "type": "line", "axis": "secondary", "unit": "%"}
  ]
}
```

Percent values are plotted as returned by SQL; the renderer does not multiply by 100 or calculate
totals. SQL containing long-form category/value data must first return distinct measure columns.
The shared synthetic fixture is `test-fixtures/combo-chart.json`.

## App integration

Answers support legend toggles, axis tooltips, point follow-ups, data-table view with copy/Excel,
fullscreen, and category zoom for results longer than 40 points. Combo charts keep their mixed
series roles when displayed; automatic switches to uniform line/bar/area charts are not offered.
Separate combo artifacts remain separate when comparing sources.

Save to dashboard preserves every series role, axis, unit, layout and axis title. The widget editor
can change these mappings. Refresh reruns the saved read-only SQL and rebuilds the chart through the
same validation and payload builder, without an LLM.

## Rollout

1. Apply `python -m alembic upgrade head` in the backend environment (migration `0016_combo_chart`).
   The migration extends the widget-type constraint; existing widget configurations keep working.
2. Restart the API and worker with the updated code so both advertise and accept the new contract.
3. Build/deploy the frontend. Ask for a “line and stacked column chart” or select that widget type
   when saving SQL results to a dashboard and choose each measure's role and axis.

Downgrade refuses to proceed while combo widgets exist, preserving their mappings rather than
silently converting them into a chart that loses the line series or axis assignments.

## Reference documentation

- [Microsoft: create and use combo charts](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-combo-chart)
  describes a shared X-axis, line/column measures, and one or two Y-axes.
- [Apache ECharts: stacked bars](https://echarts.apache.org/handbook/en/how-to/chart-types/bar/stacked-bar/)
  documents common stack identifiers for the column series.
- [Apache ECharts: axes and mixed-series example](https://echarts.apache.org/handbook/en/concepts/axis/)
  documents per-series Y-axis selection and line/bar combinations.
