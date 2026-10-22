import { useMemo, useRef, useState, type RefObject } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsType } from 'echarts';
import { BarChart3, Table2, Copy, Download, Search, X, ChartNoAxesCombined } from 'lucide-react';
import { AnalyticalTable, type TableViewState } from '../analytics/table/AnalyticalTable';
import { toTsv, type AnalyticalTableModel } from '../analytics/table/table-domain';
import { downloadExcel, excelTableFromModel } from '../analytics/table/excel-export';
import { useExcelExport } from '../analytics/table/useExcelExport';
import {
  ArtifactFrame,
  type ArtifactAction,
  type ArtifactMetadata,
} from '../analytics/components/ArtifactFrame';
import { notifications } from '../components/notifications';
import { echartsTheme } from '../theme/echarts-theme';
import { buildChartOption } from './build-chart-option';
import {
  chartSelectionFromEvent,
  compatibleChartTypes,
  followUpForSelection,
  type ChartSelection,
} from './chart-interactions';
import {
  chartTypeLabel,
  isCircularChart,
  type CartesianChartType,
  type ChartableModel,
} from './chart-domain';

type ChartMemory = {
  legend?: Record<string, boolean>;
  zoom?: Array<{ start: number; end: number }>;
};

function dataModel(chart: ChartableModel): AnalyticalTableModel {
  if (isCircularChart(chart)) {
    const columns = ['Data source', chart.category, chart.value];
    return {
      columns,
      rowCount: chart.points.length,
      truncated: false,
      rows: chart.points.map((point, index) => ({
        id: String(index),
        values: {
          'Data source': chart.dataSourceName,
          [chart.category]: point[chart.category] ?? null,
          [chart.value]: point[chart.value] ?? null,
        },
      })),
    };
  }
  const columns = ['Data source', chart.dimension, 'Metric', 'Value'];
  const rows = chart.series.flatMap((series) =>
    series.points.map((point, index) => ({
      id: `${series.id}:${index}`,
      values: {
        'Data source': series.dataSourceName,
        [chart.dimension]: point[chart.dimension] ?? null,
        Metric: series.label,
        Value: point[series.metric] ?? null,
      },
    })),
  );
  return { columns, rows, rowCount: rows.length, truncated: false };
}

function formatSelectionValue(value: string | number) {
  return typeof value === 'number'
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
    : value;
}

function withChartType(model: ChartableModel, chartType: CartesianChartType): ChartableModel {
  return isCircularChart(model) ? model : { ...model, chartType };
}

function ChartCanvas({
  model,
  fullscreen,
  onSelect,
  memory,
  onMemoryChange,
}: {
  model: ChartableModel;
  fullscreen: boolean;
  onSelect(selection: ChartSelection): void;
  memory: RefObject<ChartMemory>;
  onMemoryChange(patch: ChartMemory): void;
}) {
  const instance = useRef<EChartsType | null>(null);
  const option = useMemo(() => buildChartOption(model), [model]);
  const events = {
    click: (event: unknown) => {
      const selection = chartSelectionFromEvent(model, event);
      if (selection) onSelect(selection);
    },
    legendselectchanged: (event: { selected: Record<string, boolean> }) => {
      onMemoryChange({ legend: event.selected });
    },
    datazoom: () => {
      const zoom = instance.current?.getOption().dataZoom as
        Array<{ start: number; end: number }> | undefined;
      if (zoom) onMemoryChange({ zoom: zoom.map(({ start, end }) => ({ start, end })) });
    },
  };
  return (
    <div
      className="chart-canvas"
      style={fullscreen ? { height: '100%' } : undefined}
      role="img"
      aria-label={
        model.title +
        '. Interactive ' +
        chartTypeLabel(model.chartType, !isCircularChart(model) && model.stacked) +
        ' chart.'
      }
    >
      <ReactECharts
        option={option}
        theme={echartsTheme}
        notMerge
        lazyUpdate
        onEvents={events}
        style={{ height: '100%', width: '100%' }}
        onChartReady={(chart: EChartsType) => {
          instance.current = chart;
          if (memory.current.legend)
            chart.setOption({ legend: { selected: memory.current.legend } });
          if (memory.current.zoom && option.dataZoom)
            chart.setOption({ dataZoom: memory.current.zoom });
          chart.resize();
          // Canvas text must repaint after the shared web font finishes loading.
          void document.fonts?.ready.then(() => {
            if (!chart.isDisposed()) chart.resize();
          });
        }}
      />
    </div>
  );
}

export function AnalyticalChart({
  model,
  onFollowUp,
  metadata,
  extraActions = [],
}: {
  model: ChartableModel;
  onFollowUp?(question: string): Promise<void> | void;
  metadata?: ArtifactMetadata;
  extraActions?: ArtifactAction[];
}) {
  const [view, setView] = useState<'chart' | 'data'>('chart');
  const [chartType, setChartType] = useState<CartesianChartType | null>(
    isCircularChart(model) ? null : model.chartType,
  );
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [tableState, setTableState] = useState<TableViewState>({ sorting: [], globalFilter: '' });
  const tableScroll = useRef({ top: 0, left: 0 });
  const memory = useRef<ChartMemory>({});
  const renderedModel = useMemo(
    () => (chartType ? withChartType(model, chartType) : model),
    [chartType, model],
  );
  const data = useMemo(() => dataModel(model), [model]);
  const { pending, exportExcel } = useExcelExport(() =>
    downloadExcel(excelTableFromModel(data, `${model.title} data`)),
  );
  const pointCount = isCircularChart(model)
    ? model.points.length
    : Math.max(0, ...model.series.map((series) => series.points.length));
  const chartTypes = compatibleChartTypes(model);
  async function copy() {
    try {
      await navigator.clipboard.writeText(toTsv(data));
      notifications.success('Copied chart data');
    } catch {
      notifications.error('Unable to copy chart data');
    }
  }
  function ask(action: 'explain' | 'breakdown' | 'compare') {
    if (selection && onFollowUp) void onFollowUp(followUpForSelection(action, selection));
  }
  return (
    <ArtifactFrame
      title={model.title}
      kind="chart"
      className="analytical-chart"
      metadata={{
        rowCount: pointCount,
        sources: model.provenance.map((source) => ({ name: source.dataSourceName })),
        ...metadata,
        notes: [
          chartTypeLabel(
            renderedModel.chartType,
            !isCircularChart(renderedModel) && renderedModel.stacked,
          ),
          ...(metadata?.notes ?? []),
        ],
      }}
      warning={
        metadata?.sources?.some((source) => source.truncated) ? 'Truncated result' : undefined
      }
      actions={[
        {
          id: 'data',
          label: view === 'chart' ? 'Show chart data' : 'Show chart',
          icon: view === 'chart' ? Table2 : BarChart3,
          active: view === 'data',
          run: () => setView((value) => (value === 'chart' ? 'data' : 'chart')),
        },
        { id: 'copy', label: 'Copy chart data', icon: Copy, disabled: !pointCount, run: copy },
        {
          id: 'export',
          label: 'Export chart data',
          icon: Download,
          busy: pending,
          disabled: !pointCount,
          run: exportExcel,
        },
        ...extraActions,
      ]}
      moreActions={
        chartTypes.length > 1
          ? chartTypes.map((type) => ({
              id: 'type-' + type,
              label: 'View as ' + chartTypeLabel(type).toLowerCase(),
              icon: ChartNoAxesCombined,
              run: () => setChartType(type),
            }))
          : []
      }
      tools={() =>
        view === 'data' && (
          <div className="artifact-search-bar">
            <Search size={14} aria-hidden="true" />
            <input
              aria-label="Search chart data"
              placeholder="Search chart data…"
              value={tableState.globalFilter}
              onChange={(event) =>
                setTableState((state) => ({ ...state, globalFilter: event.target.value }))
              }
            />
          </div>
        )
      }
    >
      {(fullscreen) => (
        <div className="chart-content">
          {!pointCount ? (
            <p className="artifact-empty" role="status">
              No data returned for this chart.
            </p>
          ) : view === 'data' ? (
            <AnalyticalTable
              model={data}
              label={`${model.title} data`}
              hideToolbar
              viewState={tableState}
              onViewStateChange={setTableState}
              scrollPosition={tableScroll}
            />
          ) : (
            <ChartCanvas
              model={renderedModel}
              fullscreen={fullscreen}
              onSelect={setSelection}
              memory={memory}
              onMemoryChange={(patch) => {
                memory.current = { ...memory.current, ...patch };
              }}
            />
          )}
          {selection && (
            <div className="chart-selection" role="status" aria-label="Selected point">
              <p>
                {selection.dimensionLabel}: {selection.dimensionValue} · {selection.metricLabel}:{' '}
                {formatSelectionValue(selection.value)} · {selection.dataSourceName}
              </p>
              <div className="chart-selection-actions">
                <button type="button" disabled={!onFollowUp} onClick={() => ask('explain')}>
                  Explain
                </button>
                <button type="button" disabled={!onFollowUp} onClick={() => ask('breakdown')}>
                  Break down
                </button>
                <button type="button" disabled={!onFollowUp} onClick={() => ask('compare')}>
                  Compare
                </button>
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => setSelection(null)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </ArtifactFrame>
  );
}
