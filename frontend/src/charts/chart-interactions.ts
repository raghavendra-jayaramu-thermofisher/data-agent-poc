import type { CartesianChartType, ChartableModel } from './chart-domain';
import { isCircularChart } from './chart-domain';

export type ChartSelection = {
  dimensionLabel: string;
  dimensionValue: string;
  metricLabel: string;
  value: string | number;
  dataSourceName: string;
};

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function primitive(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

export function compatibleChartTypes(model: ChartableModel): CartesianChartType[] {
  if (isCircularChart(model)) return [];
  if (model.chartType === 'combo') return ['combo'];
  if (model.stacked || model.orientation === 'horizontal') return ['bar'];
  return ['line', 'bar', 'area'];
}

export function chartSelectionFromEvent(
  model: ChartableModel,
  event: unknown,
): ChartSelection | null {
  const params = object(event);
  const data = object(params?.data);
  if (!params || !data) return null;

  if (isCircularChart(model)) {
    const category = primitive(data[model.category]);
    const value = primitive(data[model.value]);
    if (category == null || value == null) return null;
    return {
      dimensionLabel: model.category,
      dimensionValue: String(category),
      metricLabel: model.valueLabel,
      value,
      dataSourceName: model.dataSourceName,
    };
  }

  const seriesId = typeof params.seriesId === 'string' ? params.seriesId : null;
  const series =
    model.series.find((item) => item.id === seriesId) ??
    model.series.find((item) => item.label === params.seriesName) ??
    model.series[0];
  if (!series) return null;
  const dimension = primitive(data[model.dimension]);
  const value = primitive(data[series.metric]);
  if (dimension == null || value == null) return null;
  return {
    dimensionLabel: model.dimensionLabel ?? model.dimension,
    dimensionValue: String(dimension),
    metricLabel: series.label,
    value,
    dataSourceName: series.dataSourceName,
  };
}

function subject(selection: ChartSelection) {
  return `${selection.metricLabel} for ${selection.dimensionLabel} ${selection.dimensionValue}`;
}

export function followUpForSelection(
  action: 'explain' | 'breakdown' | 'compare',
  selection: ChartSelection,
): string {
  if (action === 'breakdown')
    return `Break down ${subject(selection)} and explain the most important contributors.`;
  if (action === 'compare')
    return `Compare ${subject(selection)} with the most relevant previous period and explain the change.`;
  return `Explain ${subject(selection)}, including the main reasons behind this result.`;
}
