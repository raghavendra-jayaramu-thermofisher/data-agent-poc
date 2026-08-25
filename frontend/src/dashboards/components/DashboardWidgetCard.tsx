import { Button } from '@heroui/react';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { StatusChip } from '../../components/StatusChip';
import type { ManagedJob } from '../../jobs/types';
import type { DashboardWidget, DashboardWidgetUpdate } from '../api/dashboard-api';
import { widgetGridStyle } from '../lib/widget-config';
import { DashboardWidgetContent } from './DashboardWidgetContent';
import { WidgetEditModal } from './WidgetEditModal';
import { WidgetProvenance } from './WidgetProvenance';

export function DashboardWidgetCard({ widget, dataSourceName, refreshJob, dashboardRefreshing, onRefresh, onUpdate, onDelete }: {
  widget: DashboardWidget;
  dataSourceName: string;
  refreshJob?: ManagedJob;
  dashboardRefreshing: boolean;
  onRefresh(): Promise<void>;
  onUpdate(body: DashboardWidgetUpdate): Promise<void>;
  onDelete(): Promise<void>;
}) {
  const refreshing = dashboardRefreshing || refreshJob?.job.status === 'queued' || refreshJob?.job.status === 'running';
  const failed = refreshJob?.job.status === 'failed';
  return <article className={`dashboard-widget ${widget.enabled ? '' : 'widget-disabled'}`} style={widgetGridStyle(widget)}>
    <header className="dashboard-widget-header">
      <div><h2>{widget.title}</h2><div className="widget-meta"><span>{widget.widget_type}</span><span>{dataSourceName}</span>{!widget.enabled ? <StatusChip status="disabled"/> : null}</div></div>
      <div className="widget-actions"><Button size="sm" variant="secondary" isPending={refreshing} isDisabled={!widget.enabled || refreshing} onPress={() => void onRefresh()}>Refresh</Button><WidgetEditModal widget={widget} onSave={onUpdate}/><ConfirmationDialog triggerLabel="Delete" title="Delete widget?" description="This removes the saved widget from this dashboard. The originating analysis remains available." confirmLabel="Delete widget" onConfirm={() => void onDelete()}/></div>
    </header>
    {refreshing ? <div className="widget-refreshing" role="status">Refreshing in the background. Previous successful data remains visible.</div> : null}
    {failed ? <div className="widget-error" role="alert"><strong>Refresh failed</strong><p>{refreshJob.job.error_message ?? 'The previous successful visualization is still available.'}</p></div> : null}
    <div className="dashboard-widget-body"><DashboardWidgetContent widget={widget} dataSourceName={dataSourceName}/></div>
    <WidgetProvenance widget={widget} dataSourceName={dataSourceName}/>
  </article>;
}
