import type { ExecutionTrace, JobArtifact } from '../../agent/api/execution-api';
import { parseTableArtifact } from '../../agent/lib/artifacts';
import type { DashboardWidget, DashboardWidgetCreate } from '../api/dashboard-api';
import type { SaveWidgetValues, WidgetType } from '../schemas/dashboard-schemas';

export type SaveSource = {
  artifact: JobArtifact;
  columns: string[];
  sourceSqlExecutionId: string;
  defaultWidgetType: WidgetType;
  defaults: Partial<SaveWidgetValues>;
};

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null; }
function isWidgetType(value: string | null): value is WidgetType { return value != null && ['metric', 'table', 'bar', 'line', 'area', 'pie'].includes(value); }

export function findSaveSource(trace: ExecutionTrace | undefined, artifactId: string | null, sqlExecutionId: string): SaveSource | null {
  if (!trace) return null;
  const artifacts = trace.artifacts ?? [];
  const requested = artifactId ? artifacts.find((item) => item.id === artifactId) : undefined;
  const tableArtifact = artifacts.find((item) => item.kind === 'table' && item.source_sql_execution_id === sqlExecutionId);
  if (!tableArtifact) return null;
  const table = parseTableArtifact(tableArtifact);
  if (!table) return null;
  const defaults: Partial<SaveWidgetValues> = {};
  let defaultWidgetType: WidgetType = requested?.kind === 'chart' ? 'bar' : 'table';
  if (requested?.kind === 'chart') {
    const payload = object(requested.payload);
    const chartType = text(payload?.chart_type);
    if (isWidgetType(chartType) && chartType !== 'table') defaultWidgetType = chartType;
    const encoding = object(payload?.encoding);
    if (defaultWidgetType === 'pie') {
      defaults.categoryField = text(object(encoding?.category)?.field) ?? '';
      defaults.valueField = text(object(encoding?.value)?.field) ?? '';
    } else if (defaultWidgetType === 'metric') {
      defaults.metricField = text(object(encoding?.value)?.field) ?? '';
    } else {
      defaults.xField = text(object(encoding?.x)?.field) ?? '';
      const series = Array.isArray(encoding?.series) ? encoding.series.map(object).filter(Boolean) : [];
      defaults.valueField = text(series[0]?.field) ?? '';
    }
  }
  return { artifact: requested ?? tableArtifact, columns: table.columns, sourceSqlExecutionId: sqlExecutionId, defaultWidgetType, defaults };
}

export function validateWidgetMapping(values: SaveWidgetValues, columns: string[]): string | null {
  const has = (field: string) => field && columns.includes(field);
  if (values.widgetType === 'table') return null;
  if (values.widgetType === 'metric') return has(values.metricField) ? null : 'Choose a metric field from the source result.';
  if (values.widgetType === 'pie') {
    if (!has(values.categoryField)) return 'Choose a category field from the source result.';
    if (!has(values.valueField)) return 'Choose a value field from the source result.';
    if (values.categoryField === values.valueField) return 'Category and value fields must be different.';
    return null;
  }
  if (!has(values.xField)) return 'Choose an X-axis field from the source result.';
  if (!has(values.valueField)) return 'Choose a value field from the source result.';
  if (values.xField === values.valueField) return 'X-axis and value fields must be different.';
  return null;
}

export function buildWidgetCreate(values: SaveWidgetValues, sourceJobId: string, sourceSqlExecutionId: string): DashboardWidgetCreate {
  const visualization_config: Record<string, unknown> = values.widgetType === 'metric'
    ? { field: values.metricField }
    : values.widgetType === 'table'
      ? {}
      : values.widgetType === 'pie'
        ? { category_field: values.categoryField, value_field: values.valueField, value_label: values.valueField }
        : { x_field: values.xField, x_label: values.xField, series: [{ field: values.valueField, label: values.valueField }] };
  return {
    source_job_id: sourceJobId,
    source_sql_execution_id: sourceSqlExecutionId,
    widget_type: values.widgetType,
    title: values.title.trim() || null,
    visualization_config,
    layout_config: defaultLayout(values.widgetType),
  };
}

export function defaultLayout(widgetType: WidgetType): Record<string, unknown> {
  if (widgetType === 'metric') return { columns: 3, rows: 1 };
  if (widgetType === 'table') return { columns: 12, rows: 2 };
  return { columns: 6, rows: 2 };
}

export function widgetGridStyle(widget: DashboardWidget): { gridColumn: string; minHeight: string } {
  const columns = Number(widget.layout_config.columns ?? 6);
  const rows = Number(widget.layout_config.rows ?? (widget.widget_type === 'metric' ? 1 : 2));
  const safeColumns = Number.isFinite(columns) ? Math.min(12, Math.max(3, Math.round(columns))) : 6;
  const safeRows = Number.isFinite(rows) ? Math.min(4, Math.max(1, Math.round(rows))) : 2;
  return { gridColumn: `span ${safeColumns}`, minHeight: `${safeRows * 220}px` };
}

export function widgetValuesFromConfig(widget: DashboardWidget): Pick<SaveWidgetValues, 'widgetType' | 'metricField' | 'xField' | 'valueField' | 'categoryField'> {
  const config = widget.visualization_config;
  const series = Array.isArray(config.series) ? config.series.map(object).filter(Boolean) : [];
  return {
    widgetType: isWidgetType(widget.widget_type) ? widget.widget_type : 'table',
    metricField: text(config.field) ?? '',
    xField: text(config.x_field) ?? '',
    valueField: widget.widget_type === 'pie' ? (text(config.value_field) ?? '') : (text(series[0]?.field) ?? ''),
    categoryField: text(config.category_field) ?? '',
  };
}

export function buildVisualizationConfig(values: Pick<SaveWidgetValues, 'widgetType' | 'metricField' | 'xField' | 'valueField' | 'categoryField'>): Record<string, unknown> {
  if (values.widgetType === 'metric') return { field: values.metricField };
  if (values.widgetType === 'table') return {};
  if (values.widgetType === 'pie') return { category_field: values.categoryField, value_field: values.valueField, value_label: values.valueField };
  return { x_field: values.xField, x_label: values.xField, series: [{ field: values.valueField, label: values.valueField }] };
}
