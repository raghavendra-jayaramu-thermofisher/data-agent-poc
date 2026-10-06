import type { EChartsOption, SeriesOption } from 'echarts';
import { designTokens } from '../theme/tokens';
import {
  isCircularChart,
  type ChartableModel,
  type MultiSourceChartModel,
  type PieChartModel,
} from './chart-domain';

function sourceName(series: MultiSourceChartModel['series'][number], needsSource: boolean) {
  return needsSource ? `${series.dataSourceName} · ${series.label}` : series.label;
}

function cartesianOption(model: MultiSourceChartModel): EChartsOption {
  const horizontal = model.chartType === 'bar' && model.orientation === 'horizontal';
  const stacked = model.chartType === 'bar' && model.stacked === true;
  const multiSource = new Set(model.series.map((series) => series.dataSourceId)).size > 1;
  const units = [
    ...new Set(
      model.series.map((series) => series.unit).filter((unit): unit is string => Boolean(unit)),
    ),
  ];
  const useSecondAxis = units.length === 2;
  const datasetIndex = new Map<MultiSourceChartModel['series'][number]['points'], number>();
  const datasets: Array<{ source: MultiSourceChartModel['series'][number]['points'] }> = [];
  for (const item of model.series) {
    if (!datasetIndex.has(item.points)) {
      datasetIndex.set(item.points, datasets.length);
      datasets.push({ source: item.points });
    }
  }
  const series: SeriesOption[] = model.series.map(
    (item) =>
      ({
        id: item.id,
        name: sourceName(item, multiSource),
        type: model.chartType === 'area' ? 'line' : model.chartType,
        datasetIndex: datasetIndex.get(item.points) ?? 0,
        encode: horizontal
          ? { x: item.metric, y: model.dimension }
          : { x: model.dimension, y: item.metric },
        ...(horizontal
          ? { xAxisIndex: useSecondAxis && item.unit === units[1] ? 1 : 0 }
          : { yAxisIndex: useSecondAxis && item.unit === units[1] ? 1 : 0 }),
        // Keep combined sources as separate stacks rather than summing across databases.
        ...(stacked ? { stack: item.dataSourceId, stackStrategy: 'samesign' } : {}),
        showSymbol: item.points.length <= 30,
        ...(model.chartType === 'area' ? { areaStyle: { opacity: 0.14 } } : {}),
      }) as SeriesOption,
  );
  const maxPoints = Math.max(0, ...model.series.map((item) => item.points.length));
  const zoom = maxPoints > 40;
  const valueAxes = [
    { type: 'value' as const, name: units[0] ?? undefined },
    ...(useSecondAxis
      ? [{ type: 'value' as const, name: units[1], splitLine: { show: false } }]
      : []),
  ];
  const categoryAxis = {
    type: 'category' as const,
    name: model.dimensionLabel ?? undefined,
    nameLocation: 'middle' as const,
    nameGap: 28,
    ...(horizontal
      ? { inverse: true, axisLabel: { width: 180, overflow: 'truncate' as const } }
      : {}),
  };
  return {
    animation: true,
    color: [...designTokens.colors.chart],
    dataset: datasets,
    grid: {
      left: 12,
      right: horizontal && zoom ? 36 : useSecondAxis && !horizontal ? 28 : 12,
      top: 44,
      bottom: zoom && !horizontal ? 64 : 32,
      containLabel: true,
    },
    legend: { type: 'scroll', top: 4 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
    xAxis: horizontal ? valueAxes : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxes,
    series,
    ...(zoom
      ? {
          dataZoom: horizontal
            ? [
                { type: 'inside', yAxisIndex: 0 },
                {
                  type: 'slider',
                  yAxisIndex: 0,
                  orient: 'vertical',
                  width: 18,
                  right: 0,
                  top: 44,
                  bottom: 32,
                },
              ]
            : [
                { type: 'inside', xAxisIndex: 0 },
                { type: 'slider', xAxisIndex: 0, height: 18, bottom: 4 },
              ],
        }
      : {}),
  };
}

function pieOption(model: PieChartModel): EChartsOption {
  return {
    animation: true,
    color: [...designTokens.colors.chart],
    dataset: { source: model.points },
    legend: { type: 'scroll', orient: 'horizontal', bottom: 0 },
    tooltip: { trigger: 'item' },
    series: [
      {
        name: model.valueLabel,
        type: 'pie',
        radius: model.chartType === 'donut' ? ['45%', '68%'] : '68%',
        center: ['50%', '45%'],
        encode: { itemName: model.category, value: model.value },
        label: { overflow: 'truncate', width: 120 },
      },
    ],
  };
}

export function buildChartOption(model: ChartableModel): EChartsOption {
  return isCircularChart(model) ? pieOption(model) : cartesianOption(model);
}
