import type { MetricChartModel } from './chart-domain';
import { formatAnalyticalValue } from '../analytics/table/table-domain';

export function MetricCard({ model }: { model: MetricChartModel }) {
  const sourceCount = new Set(model.provenance.map((item) => item.dataSourceId)).size;
  return (
    <section
      className="analytical-chart border border-[#DAD5CD] bg-[#FFFDFC] rounded-lg p-4 shadow-xs"
      aria-label={model.title}
    >
      <header className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-[#E7E3DC]">
        <div>
          <h4 className="font-semibold text-sm text-[#252127]">{model.title}</h4>
          <p className="text-xs text-[#625C64] mt-0.5">
            {sourceCount} data source{sourceCount === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      <div className="metric-widget-value">
        <span>{model.label}</span>
        <strong>{formatAnalyticalValue(model.value)}</strong>
      </div>
    </section>
  );
}
