import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart3, Table2, Maximize2, X, Sparkles, TrendingUp, BarChart2, Layers } from 'lucide-react';
import { AnalyticalTable } from '../analytics/table/AnalyticalTable';
import type { AnalyticalTableModel } from '../analytics/table/table-domain';
import { echartsTheme } from '../theme/echarts-theme';
import { buildChartOption } from './build-chart-option';
import {
  chartSelectionFromEvent,
  compatibleChartTypes,
  followUpForSelection,
  type ChartSelection,
} from './chart-interactions';
import type { CartesianChartType, ChartableModel } from './chart-domain';

function dataModel(chart: ChartableModel): AnalyticalTableModel {
  if (chart.chartType === 'pie') {
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
    }))
  );
  return { columns, rows, rowCount: rows.length, truncated: false };
}

function formatSelectionValue(value: string | number) {
  return typeof value === 'number'
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
    : value;
}

function withChartType(model: ChartableModel, chartType: CartesianChartType): ChartableModel {
  return model.chartType === 'pie' ? model : { ...model, chartType };
}

function ChartCanvas({
  model,
  height,
  onSelect,
}: {
  model: ChartableModel;
  height: number;
  onSelect(selection: ChartSelection): void;
}) {
  const option = useMemo(() => buildChartOption(model), [model]);
  const onEvents = useMemo(
    () => ({
      click: (event: unknown) => {
        const selection = chartSelectionFromEvent(model, event);
        if (selection) onSelect(selection);
      },
    }),
    [model, onSelect]
  );
  return (
    <div
      className="chart-canvas"
      role="img"
      aria-label={`${model.title}. Interactive ${model.chartType} chart.`}
    >
      <ReactECharts
        option={option}
        theme={echartsTheme}
        notMerge
        lazyUpdate
        onEvents={onEvents}
        style={{ height, width: '100%' }}
      />
    </div>
  );
}

export function AnalyticalChart({
  model,
  onFollowUp,
}: {
  model: ChartableModel;
  onFollowUp?(question: string): Promise<void> | void;
}) {
  const [view, setView] = useState<'chart' | 'data'>('chart');
  const [chartType, setChartType] = useState<CartesianChartType | null>(
    model.chartType === 'pie' ? null : model.chartType
  );
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [expanded, setExpanded] = useState(false);
  const renderedModel = useMemo(
    () => (chartType ? withChartType(model, chartType) : model),
    [chartType, model]
  );
  const sourceCount = new Set(model.provenance.map((item) => item.dataSourceId)).size;
  const pointCount =
    model.chartType === 'pie'
      ? model.points.length
      : Math.max(0, ...model.series.map((series) => series.points.length));
  const chartTypes = compatibleChartTypes(model);

  const alternateTypes = chartTypes.filter((t) => t !== (chartType || model.chartType));

  const ask = (action: 'explain' | 'breakdown' | 'compare') => {
    if (!selection || !onFollowUp) return;
    void onFollowUp(followUpForSelection(action, selection));
  };

  return (
    <section className="analytical-chart border border-[#DAD5CD] bg-[#FFFDFC] rounded-lg p-4 shadow-xs" aria-label={model.title}>
      <header className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-[#E7E3DC]">
        <div>
          <h4 className="font-semibold text-sm text-[#252127]">{model.title}</h4>
          <p className="text-xs text-[#625C64] mt-0.5">
            {sourceCount} data source{sourceCount === 1 ? '' : 's'} · {model.provenance.length} persisted source record
            {model.provenance.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="chart-toolbar flex items-center gap-2" aria-label={`${model.title} controls`}>
          <div className="view-toggle flex items-center bg-[#F0EEE9] p-0.5 rounded-md" aria-label="Visualization view">
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                view === 'chart'
                  ? 'bg-[#4B123F] text-[#FFF9FD] shadow-xs font-semibold'
                  : 'text-[#252127] hover:bg-[#EAE7E1]'
              }`}
              onClick={() => setView('chart')}
            >
              <BarChart3 size={13} />
              <span>Chart</span>
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                view === 'data'
                  ? 'bg-[#4B123F] text-[#FFF9FD] shadow-xs font-semibold'
                  : 'text-[#252127] hover:bg-[#EAE7E1]'
              }`}
              onClick={() => setView('data')}
            >
              <Table2 size={13} />
              <span>Data</span>
            </button>
          </div>

          {chartTypes.length ? (
            <div className="chart-type-toggle flex items-center gap-1" aria-label="Chart type">
              {chartTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                    (chartType || model.chartType) === type
                      ? 'bg-[#F4E8F0] border-[#9A4D86]/40 text-[#4B123F] font-semibold'
                      : 'bg-[#FFFDFC] border-[#DAD5CD] hover:bg-[#F0EEE9] text-[#252127]'
                  }`}
                  onClick={() => setChartType(type)}
                >
                  {type[0]!.toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="p-1.5 text-[#625C64] hover:text-[#252127] hover:bg-[#F0EEE9] rounded-md transition-colors"
            onClick={() => setExpanded(true)}
            title="Expand chart full screen"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </header>

      {pointCount ? (
        view === 'chart' ? (
          <>
            <ChartCanvas model={renderedModel} height={460} onSelect={setSelection} />
            
            {/* Similar Chart Recommendations Bar */}
            {alternateTypes.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[#EAE7E1] text-xs">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#625C64]">
                  <Sparkles size={11} className="text-[#9A4D86]" />
                  Similar Views:
                </span>
                <div className="flex items-center gap-1.5">
                  {alternateTypes.map((altType) => (
                    <button
                      key={altType}
                      type="button"
                      onClick={() => setChartType(altType)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F0EEE9] hover:bg-[#EAE7E1] text-[#252127] border border-[#DAD5CD] rounded text-[11px] font-medium transition-colors"
                    >
                      {altType === 'bar' && <BarChart2 size={10} />}
                      {altType === 'line' && <TrendingUp size={10} />}
                      {altType === 'area' && <Layers size={10} />}
                      <span>Switch to {altType[0]!.toUpperCase() + altType.slice(1)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <AnalyticalTable model={dataModel(model)} label={`${model.title} data`} />
        )
      ) : (
        <div className="artifact-empty text-center py-10 text-xs text-[#8B848C]" role="status">
          No chart data was returned.
        </div>
      )}

      {selection ? (
        <div className="chart-selection flex items-center justify-between p-3 mt-3 bg-[#FFF4CC] border border-[#E3AC19]/50 rounded-md text-xs" aria-live="polite">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8C5A00] block tracking-wide">Selected Point</span>
            <strong className="text-sm text-[#252127]">{selection.dimensionValue}</strong>
            <p className="text-xs text-[#625C64] mt-0.5">
              {selection.metricLabel}: {formatSelectionValue(selection.value)} · {selection.dataSourceName}
            </p>
          </div>
          <div className="chart-selection-actions flex items-center gap-2">
            <button
              type="button"
              className="px-2.5 py-1 bg-[#FFFDFC] border border-[#DAD5CD] rounded text-xs font-medium hover:bg-[#F0EEE9] text-[#252127] disabled:opacity-40 shadow-2xs"
              disabled={!onFollowUp}
              onClick={() => ask('explain')}
            >
              Explain
            </button>
            <button
              type="button"
              className="px-2.5 py-1 bg-[#FFFDFC] border border-[#DAD5CD] rounded text-xs font-medium hover:bg-[#F0EEE9] text-[#252127] disabled:opacity-40 shadow-2xs"
              disabled={!onFollowUp}
              onClick={() => ask('breakdown')}
            >
              Break down
            </button>
            <button
              type="button"
              className="px-2.5 py-1 bg-[#FFFDFC] border border-[#DAD5CD] rounded text-xs font-medium hover:bg-[#F0EEE9] text-[#252127] disabled:opacity-40 shadow-2xs"
              disabled={!onFollowUp}
              onClick={() => ask('compare')}
            >
              Compare
            </button>
            <button
              type="button"
              className="p-1 text-[#8B848C] hover:text-[#252127]"
              onClick={() => setSelection(null)}
              title="Clear selection"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Fullscreen Chart Modal */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DAD5CD] bg-[#FBFAF7]">
              <div>
                <h3 className="font-semibold text-base text-[#252127]">{model.title}</h3>
                <p className="text-xs text-[#625C64]">
                  {sourceCount} data source{sourceCount === 1 ? '' : 's'} · {model.provenance.length} persisted records
                </p>
              </div>
              <div className="flex items-center gap-2">
                {chartTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                      (chartType || model.chartType) === type
                        ? 'bg-[#F4E8F0] border-[#9A4D86]/40 text-[#4B123F] font-semibold'
                        : 'bg-[#FFFDFC] border-[#DAD5CD] hover:bg-[#F0EEE9] text-[#252127]'
                    }`}
                    onClick={() => setChartType(type)}
                  >
                    {type[0]!.toUpperCase() + type.slice(1)}
                  </button>
                ))}
                <button
                  type="button"
                  className="p-1.5 text-[#625C64] hover:text-[#252127] hover:bg-[#EAE7E1] rounded ml-2"
                  onClick={() => setExpanded(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-hidden flex flex-col justify-center">
              <ChartCanvas model={renderedModel} height={600} onSelect={setSelection} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
