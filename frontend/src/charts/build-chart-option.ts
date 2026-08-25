import type { EChartsOption, SeriesOption } from 'echarts';
import { designTokens } from '../theme/tokens';
import type { ChartableModel, MultiSourceChartModel, PieChartModel } from './chart-domain';

function sourceName(series: MultiSourceChartModel['series'][number], needsSource: boolean) { return needsSource ? `${series.dataSourceName} · ${series.label}` : series.label; }

function cartesianOption(model: MultiSourceChartModel): EChartsOption {
  const multiSource = new Set(model.series.map((series) => series.dataSourceId)).size > 1;
  const units = [...new Set(model.series.map((series) => series.unit).filter((unit): unit is string => Boolean(unit)))];
  const useSecondAxis = units.length === 2;
  const datasetIndex = new Map<MultiSourceChartModel['series'][number]['points'], number>();
  const datasets: Array<{ source: MultiSourceChartModel['series'][number]['points'] }> = [];
  for (const item of model.series) {
    if (!datasetIndex.has(item.points)) { datasetIndex.set(item.points, datasets.length); datasets.push({ source: item.points }); }
  }
  const series: SeriesOption[] = model.series.map((item) => ({
    id: item.id,
    name: sourceName(item, multiSource),
    type: model.chartType === 'area' ? 'line' : model.chartType,
    datasetIndex: datasetIndex.get(item.points) ?? 0,
    encode: { x: model.dimension, y: item.metric },
    yAxisIndex: useSecondAxis && item.unit === units[1] ? 1 : 0,
    showSymbol: item.points.length <= 30,
    ...(model.chartType === 'area' ? { areaStyle: { opacity: 0.14 } } : {}),
  } as SeriesOption));
  const maxPoints = Math.max(0, ...model.series.map((item) => item.points.length));
  const yAxis = [{ type: 'value' as const, name: units[0] ?? undefined }, ...(useSecondAxis ? [{ type: 'value' as const, name: units[1], splitLine: { show: false } }] : [])];
  return {
    animation: true,
    color: [...designTokens.colors.chart],
    dataset: datasets,
    grid: { left: 12, right: useSecondAxis ? 28 : 12, top: 44, bottom: maxPoints > 40 ? 64 : 32, containLabel: true },
    legend: { type: 'scroll', top: 4 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
    xAxis: { type: 'category', name: model.dimensionLabel ?? undefined, nameLocation: 'middle', nameGap: 28 },
    yAxis,
    series,
    ...(maxPoints > 40 ? { dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'slider', xAxisIndex: 0, height: 18, bottom: 4 }] } : {}),
  };
}

function pieOption(model: PieChartModel): EChartsOption {
  return {
    animation: true,
    color: [...designTokens.colors.chart],
    dataset: { source: model.points },
    legend: { type: 'scroll', orient: 'horizontal', bottom: 0 },
    tooltip: { trigger: 'item' },
    series: [{ name: model.valueLabel, type: 'pie', radius: '68%', center: ['50%', '45%'], encode: { itemName: model.category, value: model.value }, label: { overflow: 'truncate', width: 120 } }],
  };
}

export function buildChartOption(model: ChartableModel): EChartsOption {
  return model.chartType === 'pie' ? pieOption(model) : cartesianOption(model);
}
