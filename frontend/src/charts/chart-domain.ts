import type { JobArtifact, SqlExecution } from '../agent/api/execution-api';

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'metric';
export type CartesianChartType = Exclude<ChartType, 'pie' | 'metric'>;
export type ChartPoint = Record<string, string | number | null>;
export type AnalyticalSeries = {
  id: string;
  dataSourceId: string;
  dataSourceName: string;
  metric: string;
  label: string;
  unit?: string | null;
  dimension: string;
  points: ChartPoint[];
};
export type MultiSourceChartModel = {
  id: string;
  title: string;
  chartType: CartesianChartType;
  dimension: string;
  dimensionLabel?: string | null;
  series: AnalyticalSeries[];
  provenance: Array<{
    dataSourceId: string;
    dataSourceName: string;
    executionId?: string;
    artifactId?: string;
  }>;
  comparisonKey?: string | null;
};
export type PieChartModel = {
  id: string;
  title: string;
  chartType: 'pie';
  category: string;
  value: string;
  valueLabel: string;
  unit?: string | null;
  dataSourceId: string;
  dataSourceName: string;
  points: ChartPoint[];
  provenance: MultiSourceChartModel['provenance'];
};
export type MetricChartModel = {
  id: string;
  title: string;
  chartType: 'metric';
  field: string;
  label: string;
  value: string | number | null;
  dataSourceId: string;
  dataSourceName: string;
  provenance: MultiSourceChartModel['provenance'];
};
/** Chart types rendered by AnalyticalChart (bar/line/area/pie) — excludes the metric card. */
export type ChartableModel = MultiSourceChartModel | PieChartModel;
export type NormalizedChartModel = ChartableModel | MetricChartModel;

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const cleaned = value.replace(/[$,\s]/g, '').trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function points(value: unknown, numericFields: Set<string>): ChartPoint[] | null {
  if (!Array.isArray(value)) return null;
  const result: ChartPoint[] = [];
  for (const raw of value) {
    const item = object(raw);
    if (!item) return null;
    const point: ChartPoint = {};
    for (const [key, cell] of Object.entries(item)) {
      if (cell == null || typeof cell === 'string' || typeof cell === 'number') {
        point[key] =
          numericFields.has(key) && cell != null ? numeric(cell) : (cell as string | number | null);
      }
    }
    if ([...numericFields].some((field) => point[field] == null)) return null;
    result.push(point);
  }
  return result;
}

export function normalizeChartArtifact(
  artifact: JobArtifact,
  sql: SqlExecution | undefined,
  dataSourceName: string,
): NormalizedChartModel | null {
  const payload = object(artifact.payload);
  if (!payload || payload.schema_version !== 1 || payload.renderer !== 'frontend') return null;
  const payloadSqlId = text(payload.source_sql_execution_id);
  if (
    payloadSqlId &&
    artifact.source_sql_execution_id &&
    payloadSqlId !== artifact.source_sql_execution_id
  )
    return null;
  const chartType = text(payload.chart_type) as ChartType | null;
  if (!chartType || !['bar', 'line', 'area', 'pie', 'metric'].includes(chartType)) return null;
  const sourceId = sql?.data_source_id ?? text(payload.data_source_id) ?? 'datasource';
  const encoding = object(payload.encoding);
  if (!encoding) return null;
  const title = text(payload.title) ?? artifact.name ?? 'Chart';
  const provenance = [
    {
      dataSourceId: sourceId,
      dataSourceName: dataSourceName || 'Data source',
      executionId: artifact.source_sql_execution_id ?? undefined,
      artifactId: artifact.id,
    },
  ];
  if (chartType === 'pie') {
    const category = object(encoding.category);
    const value = object(encoding.value);
    const categoryField = text(category?.field);
    const valueField = text(value?.field);
    if (!categoryField || !valueField) return null;
    const chartPoints = points(payload.data, new Set([valueField]));
    if (!chartPoints || chartPoints.some((point) => point[categoryField] == null)) return null;
    const categoryValues = chartPoints.map((point) => String(point[categoryField]));
    if (new Set(categoryValues).size !== categoryValues.length) return null;
    return {
      id: artifact.id,
      title,
      chartType,
      category: categoryField,
      value: valueField,
      valueLabel: text(value?.label) ?? valueField,
      unit: text(value?.unit),
      dataSourceId: sourceId,
      dataSourceName: dataSourceName || 'Data source',
      points: chartPoints,
      provenance,
    };
  }
  if (chartType === 'metric') {
    const value = object(encoding.value);
    const valueField = text(value?.field);
    if (!valueField) return null;
    const chartPoints = points(payload.data, new Set([valueField]));
    if (!chartPoints || chartPoints.length !== 1) return null;
    return {
      id: artifact.id,
      title,
      chartType,
      field: valueField,
      label: text(value?.label) ?? valueField,
      value: chartPoints[0]?.[valueField] ?? null,
      dataSourceId: sourceId,
      dataSourceName: dataSourceName || 'Data source',
      provenance,
    };
  }
  const x = object(encoding.x);
  const xField = text(x?.field);
  const rawSeries = Array.isArray(encoding.series) ? encoding.series : null;
  if (!xField || !rawSeries?.length) return null;
  const seriesSpecs = rawSeries.map(object);
  if (seriesSpecs.some((item) => !item || !text(item.field))) return null;
  const seriesFields = seriesSpecs.map((item) => text(item!.field)!);
  const numericFields = new Set(seriesFields);
  // Every series must represent a distinct measure. Labels are presentation-only and cannot
  // safely turn one repeated value field into separate category-filtered series.
  if (numericFields.size !== seriesFields.length || numericFields.has(xField)) return null;
  const units = [
    ...new Set(
      seriesSpecs.map((item) => text(item!.unit)).filter((unit): unit is string => Boolean(unit)),
    ),
  ];
  if (units.length > 2) return null;
  const chartPoints = points(payload.data, numericFields);
  if (!chartPoints || chartPoints.some((point) => point[xField] == null)) return null;
  const dimensionValues = chartPoints.map((point) => String(point[xField]));
  if (new Set(dimensionValues).size !== dimensionValues.length) return null;
  return {
    id: artifact.id,
    title,
    chartType,
    dimension: xField,
    dimensionLabel: text(x?.label),
    comparisonKey: text(payload.comparison_key),
    series: seriesSpecs.map((item, index) => {
      const field = text(item!.field)!;
      return {
        id: `${artifact.id}:${field}:${index}`,
        dataSourceId: sourceId,
        dataSourceName: dataSourceName || 'Data source',
        metric: field,
        label: text(item!.label) ?? field,
        unit: text(item!.unit),
        dimension: xField,
        points: chartPoints,
      };
    }),
    provenance,
  };
}

export function combineCompatibleCharts(models: NormalizedChartModel[]): NormalizedChartModel[] {
  const result: NormalizedChartModel[] = [];
  const grouped = new Map<string, MultiSourceChartModel[]>();
  for (const model of models) {
    if (model.chartType === 'pie' || model.chartType === 'metric' || !model.comparisonKey) {
      result.push(model);
      continue;
    }
    const units = [...new Set(model.series.map((series) => series.unit ?? 'unknown'))];
    if (units.includes('unknown') || units.length > 2) {
      result.push(model);
      continue;
    }
    const key = [
      model.comparisonKey,
      model.chartType,
      model.dimension,
      model.series.map((series) => series.metric).join('|'),
    ].join('::');
    grouped.set(key, [...(grouped.get(key) ?? []), model]);
  }
  for (const group of grouped.values()) {
    if (group.length < 2) {
      result.push(group[0]!);
      continue;
    }
    const units = [
      ...new Set(group.flatMap((item) => item.series.map((series) => series.unit ?? 'unknown'))),
    ];
    if (units.length > 2) {
      result.push(...group);
      continue;
    }
    result.push({
      ...group[0]!,
      id: group.map((item) => item.id).join('+'),
      series: group.flatMap((item) => item.series),
      provenance: group.flatMap((item) => item.provenance),
    });
  }
  return result;
}
