import type { JobArtifact, SqlExecution } from '../../agent/api/execution-api';
import { parseTableArtifact } from '../../agent/lib/artifacts';
import type { AnalyticalTableModel, AnalyticalValue } from '../../analytics/table/table-domain';
import { normalizeChartArtifact, type ChartableModel } from '../../charts/chart-domain';
import type { DashboardWidget } from '../api/dashboard-api';

type LatestArtifact = {
  id: string;
  kind: string;
  name: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function parseLatestArtifact(widget: DashboardWidget): LatestArtifact | null {
  const raw = object(widget.latest_artifact);
  if (!raw || !text(raw.id) || !text(raw.kind) || !object(raw.payload) || !text(raw.created_at))
    return null;
  return {
    id: text(raw.id)!,
    kind: text(raw.kind)!,
    name: text(raw.name),
    payload: object(raw.payload)!,
    created_at: text(raw.created_at)!,
  };
}

function asJobArtifact(widget: DashboardWidget, latest: LatestArtifact): JobArtifact {
  return {
    id: latest.id,
    job_id: widget.last_refresh_job_id ?? widget.created_from_job_id ?? '',
    kind: latest.kind,
    name: latest.name,
    payload: latest.payload,
    source_sql_execution_id:
      text(latest.payload.source_sql_execution_id) ?? widget.created_from_sql_execution_id,
    created_at: latest.created_at,
  };
}

export function tableModelForWidget(widget: DashboardWidget): AnalyticalTableModel | null {
  const latest = parseLatestArtifact(widget);
  if (!latest || latest.kind !== 'table') return null;
  return parseTableArtifact(asJobArtifact(widget, latest));
}

export function metricValue(
  widget: DashboardWidget,
): { field: string; value: AnalyticalValue } | null {
  const table = tableModelForWidget(widget);
  const field = text(widget.visualization_config.field);
  if (!table || !field || !table.columns.includes(field) || !table.rows.length) return null;
  const value = table.rows[0]?.values[field];
  return value === undefined ? null : { field, value };
}

function chartArtifactForWidget(
  widget: DashboardWidget,
  latest: LatestArtifact,
): JobArtifact | null {
  if (!['bar', 'line', 'area', 'pie', 'donut', 'combo'].includes(widget.widget_type)) return null;
  if (
    latest.kind === 'chart' &&
    (latest.payload.schema_version !== 1 ||
      latest.payload.renderer !== 'frontend' ||
      !['bar', 'line', 'area', 'pie', 'donut', 'metric', 'combo'].includes(
        String(latest.payload.chart_type),
      ))
  )
    return null;
  const table = latest.kind === 'table' ? parseTableArtifact(asJobArtifact(widget, latest)) : null;
  const data = table
    ? table.rows.map((row) => ({ ...row.values }))
    : latest.kind === 'chart' && Array.isArray(latest.payload.data)
      ? latest.payload.data
      : null;
  if (!data) return null;
  const config = widget.visualization_config;
  const encoding = object(latest.payload.encoding);
  const originalX = object(encoding?.x);
  const originalCategory = object(encoding?.category);
  const originalValue = object(encoding?.value);
  const payload: Record<string, unknown> = {
    schema_version: 1,
    renderer: 'frontend',
    source_sql_execution_id:
      text(latest.payload.source_sql_execution_id) ?? widget.created_from_sql_execution_id,
    data_source_id: widget.data_source_id,
    chart_type: widget.widget_type,
    title: widget.title,
    data,
  };
  if (widget.widget_type === 'bar' || widget.widget_type === 'combo') {
    payload.orientation = config.orientation ?? latest.payload.orientation ?? 'vertical';
    payload.stacked = config.stacked ?? latest.payload.stacked ?? false;
  }
  if (widget.widget_type === 'combo') {
    payload.y_label = config.y_label ?? latest.payload.y_label;
    payload.secondary_y_label = config.secondary_y_label ?? latest.payload.secondary_y_label;
  }
  if (widget.widget_type === 'pie' || widget.widget_type === 'donut') {
    payload.encoding = {
      category: { field: config.category_field ?? originalCategory?.field },
      value: {
        field: config.value_field ?? originalValue?.field,
        label: config.value_label ?? config.value_field ?? originalValue?.label,
      },
    };
  } else {
    payload.encoding = {
      x: {
        field: config.x_field ?? originalX?.field,
        label: config.x_label ?? config.x_field ?? originalX?.label,
      },
      series: config.series ?? encoding?.series,
    };
  }
  return { ...asJobArtifact(widget, latest), kind: 'chart', payload };
}

export function chartModelForWidget(
  widget: DashboardWidget,
  dataSourceName: string,
): ChartableModel | null {
  const latest = parseLatestArtifact(widget);
  if (!latest) return null;
  const artifact = chartArtifactForWidget(widget, latest);
  if (!artifact) return null;
  const sql: SqlExecution = {
    id: artifact.source_sql_execution_id ?? widget.created_from_sql_execution_id ?? '',
    tool_execution_id: '',
    data_source_id: widget.data_source_id,
    sql_text: widget.sql_text,
    status: 'succeeded',
    columns: null,
    row_count: null,
    truncated: false,
    result_bytes: null,
    duration_ms: null,
    error_code: null,
    error_message: null,
    started_at: widget.created_at,
    finished_at: widget.updated_at,
  };
  const model = normalizeChartArtifact(artifact, sql, dataSourceName);
  return model?.chartType === 'metric' ? null : model;
}
