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
  const combo = model.chartType === 'combo';
  const stacked = (model.chartType === 'bar' || combo) && model.stacked === true;
  const multiSource = new Set(model.series.map((series) => series.dataSourceId)).size > 1;
  const units = [
    ...new Set(
      model.series.map((series) => series.unit).filter((unit): unit is string => Boolean(unit)),
    ),
  ];
  const useSecondAxis = combo
    ? model.series.some((item) => item.axis === 'secondary')
    : units.length === 2;
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
        type: combo ? item.type : model.chartType === 'area' ? 'line' : model.chartType,
        datasetIndex: datasetIndex.get(item.points) ?? 0,
        encode: horizontal
          ? { x: item.metric, y: model.dimension }
          : { x: model.dimension, y: item.metric },
        ...(horizontal
          ? { xAxisIndex: useSecondAxis && item.unit === units[1] ? 1 : 0 }
          : {
              yAxisIndex: combo
                ? item.axis === 'secondary'
                  ? 1
                  : 0
                : useSecondAxis && item.unit === units[1]
                  ? 1
                  : 0,
            }),
        // Keep combined sources as separate stacks rather than summing across databases.
        ...(stacked && (!combo || item.type === 'bar')
          ? { stack: item.dataSourceId, stackStrategy: 'samesign' }
          : {}),
        ...(combo ? { z: item.type === 'line' ? 3 : 2, connectNulls: false } : {}),
        showSymbol: item.points.length <= 30,
        ...(model.chartType === 'area' ? { areaStyle: { opacity: 0.14 } } : {}),
      }) as SeriesOption,
  );
  const maxPoints = Math.max(0, ...model.series.map((item) => item.points.length));
  const zoom = maxPoints > 40;
  const valueAxes = [
    {
      type: 'value' as const,
      nameGap: 12,
      nameTextStyle: { align: horizontal ? ('right' as const) : ('left' as const) },
      name: combo
        ? (model.yLabel ??
          model.series.find((item) => item.axis !== 'secondary' && item.unit)?.unit ??
          'Values')
        : (units[0] ?? undefined),
    },
    ...(useSecondAxis
      ? [
          {
            type: 'value' as const,
            nameGap: 12,
            nameTextStyle: { align: 'right' as const },
            name: combo
              ? (model.secondaryYLabel ??
                model.series.find((item) => item.axis === 'secondary' && item.unit)?.unit ??
                'Line values')
              : units[1],
            splitLine: { show: false },
          },
        ]
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
      top: combo ? 56 : 40,
      bottom: zoom && !horizontal ? 64 : 32,
      containLabel: true,
    },
    legend: { type: 'scroll', top: 0, itemWidth: 14, itemHeight: 9, itemGap: 12 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
    aria: { enabled: true },
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
