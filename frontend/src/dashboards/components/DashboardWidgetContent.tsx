import { memo } from 'react';
import { AnalyticalTable } from '../../analytics/table/AnalyticalTable';
import { formatAnalyticalValue } from '../../analytics/table/table-domain';
import { AnalyticalChart } from '../../charts/AnalyticalChart';
import type { DashboardWidget } from '../api/dashboard-api';
import { chartModelForWidget, metricValue, tableModelForWidget } from '../lib/dashboard-artifacts';

export const DashboardWidgetContent = memo(function DashboardWidgetContent({ widget, dataSourceName }: { widget: DashboardWidget; dataSourceName: string }) {
  if (!widget.latest_artifact) return <div className="widget-empty" role="status"><strong>No persisted data</strong><p>Refresh this widget to create its first reusable dashboard artifact.</p></div>;
  if (widget.widget_type === 'metric') {
    const metric = metricValue(widget);
    if (!metric) return <InvalidWidget message="The selected metric field is unavailable in the persisted result."/>;
    return <div className="metric-widget-value"><span>{metric.field}</span><strong>{formatAnalyticalValue(metric.value)}</strong></div>;
  }
  if (widget.widget_type === 'table') {
    const table = tableModelForWidget(widget);
    return table ? <AnalyticalTable model={table} label={widget.title}/> : <InvalidWidget message="The persisted table result could not be rendered safely."/>;
  }
  const chart = chartModelForWidget(widget, dataSourceName);
  return chart ? <AnalyticalChart model={chart}/> : <InvalidWidget message="The persisted chart configuration or source result is incompatible with this frontend."/>;
});

function InvalidWidget({ message }: { message: string }) {
  return <div className="widget-error" role="alert"><strong>Visualization unavailable</strong><p>{message}</p></div>;
}
