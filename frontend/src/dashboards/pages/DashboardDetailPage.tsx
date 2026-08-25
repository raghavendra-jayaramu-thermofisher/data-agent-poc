import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import {
  LayoutDashboard,
  Edit,
  RefreshCw,
  Trash2,
  ArrowLeft,
  Plus,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PageState } from '../../components/PageState';
import { notifications } from '../../components/notifications';
import { listDataSources } from '../../data-sources/api/data-source-api';
import { useJobManager } from '../../jobs/JobManagerProvider';
import { formatLocalDateTime } from '../../lib/datetime';
import { useOrganization } from '../../organizations/OrganizationProvider';
import {
  deleteDashboard,
  deleteWidget,
  refreshDashboard,
  refreshWidget,
  updateDashboard,
  updateWidget,
  type DashboardWidgetUpdate,
} from '../api/dashboard-api';
import { DashboardForm } from '../components/DashboardForm';
import { DashboardWidgetCard } from '../components/DashboardWidgetCard';
import { useDashboard } from '../hooks/useDashboards';

export function DashboardDetailPage() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const dashboard = useDashboard(dashboardId);
  const qc = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const sources = useQuery({
    queryKey: queryKeys.dataSources.list(orgId),
    queryFn: listDataSources,
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
  const { jobs, registerJob } = useJobManager();
  const [editing, setEditing] = useState(false);

  const sourceNames = useMemo(
    () => Object.fromEntries((sources.data ?? []).map((source) => [source.id, source.name])),
    [sources.data]
  );

  const latestDashboardRefresh = jobs.find(
    (entry) =>
      entry.job.job_type === 'dashboard_refresh' &&
      entry.job.input.dashboard_id === dashboardId
  );
  const dashboardRefreshing =
    latestDashboardRefresh?.job.status === 'queued' ||
    latestDashboardRefresh?.job.status === 'running';

  async function invalidate() {
    await qc.invalidateQueries({ queryKey: queryKeys.dashboards.all(orgId) });
  }

  if (dashboard.isLoading) return <PageState title="Loading dashboard…" loading />;
  if (dashboard.isError || !dashboard.data)
    return (
      <PageState
        title="Dashboard unavailable"
        description="It may have been deleted or is outside the active workspace."
        action={
          <button
            type="button"
            className="px-3 py-1.5 bg-[var(--db-primary)] text-[var(--db-on-primary)] rounded text-xs font-semibold"
            onClick={() => navigate('/dashboards')}
          >
            Back to Dashboards
          </button>
        }
      />
    );

  const item = dashboard.data;

  return (
    <section className="page max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <Link
            to="/dashboards"
            className="inline-flex items-center gap-1 text-xs text-[var(--db-text-muted)] hover:text-[var(--db-primary)] mb-1 font-medium"
          >
            <ArrowLeft size={12} />
            <span>Back to Dashboards</span>
          </Link>
          <div className="flex items-center gap-2">
            <LayoutDashboard size={22} className="text-[var(--db-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--db-text-primary)]">{item.title}</h1>
          </div>
          <p className="text-xs text-[var(--db-text-secondary)] mt-0.5">
            {item.description || 'Custom KPI analytical dashboard'} · Updated{' '}
            {formatLocalDateTime(item.updated_at)} · {item.widget_count ?? item.widgets?.length ?? 0}{' '}
            widgets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)] text-[var(--db-text-primary)] border border-[var(--db-border-default)] rounded text-xs font-semibold transition-colors"
            onClick={() => setEditing((value) => !value)}
          >
            <Edit size={13} />
            <span>{editing ? 'Close Edit' : 'Edit Dashboard'}</span>
          </button>

          <button
            type="button"
            disabled={dashboardRefreshing || !item.widgets?.some((widget) => widget.enabled)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold transition-colors disabled:opacity-50"
            onClick={async () => {
              const result = await refreshDashboard(item.id);
              await registerJob(result.job_id);
              notifications.info('Dashboard refresh started');
            }}
          >
            <RefreshCw size={13} className={dashboardRefreshing ? 'animate-spin' : ''} />
            <span>Refresh All</span>
          </button>

          <ConfirmationDialog
            triggerLabel="Delete"
            title="Delete dashboard?"
            description="This removes the dashboard and all saved widgets. Source analyses and SQL executions remain available."
            confirmLabel="Delete Dashboard"
            onConfirm={() =>
              void (async () => {
                await deleteDashboard(item.id);
                await invalidate();
                navigate('/dashboards');
                notifications.success('Dashboard deleted');
              })()
            }
          />
        </div>
      </div>

      {editing && (
        <div className="p-5 bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg shadow-xs mb-6">
          <DashboardForm
            initial={{ title: item.title, description: item.description ?? '' }}
            submitLabel="Save Dashboard"
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => {
              await updateDashboard(item.id, {
                title: values.title,
                description: values.description || null,
              });
              await invalidate();
              setEditing(false);
              notifications.success('Dashboard updated');
            }}
          />
        </div>
      )}

      {latestDashboardRefresh?.job.status === 'failed' && (
        <div className="p-3 bg-[var(--db-danger-soft)] border border-[var(--db-border-default)] rounded-lg text-xs text-[var(--db-danger)] mb-4" role="alert">
          <strong>Dashboard refresh failed:</strong>{' '}
          {latestDashboardRefresh.job.error_message ?? 'Previous successful widget data remains visible.'}
        </div>
      )}

      {dashboardRefreshing && (
        <div className="p-3 bg-[var(--db-primary-soft)] border border-[var(--db-focus-ring)]/30 rounded-lg text-xs text-[var(--db-primary)] font-medium mb-4" role="status">
          Refreshing enabled widgets in the background. Previous successful data remains visible.
        </div>
      )}

      {item.widgets?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6" aria-label="Dashboard widgets">
          {item.widgets.map((widget) => {
            const widgetRefresh = jobs.find(
              (entry) =>
                entry.job.job_type === 'dashboard_refresh' &&
                entry.job.input.widget_id === widget.id
            );
            return (
              <DashboardWidgetCard
                key={widget.id}
                widget={widget}
                dataSourceName={sourceNames[widget.data_source_id] ?? widget.data_source_id}
                refreshJob={widgetRefresh}
                dashboardRefreshing={dashboardRefreshing}
                onRefresh={async () => {
                  const result = await refreshWidget(widget.id);
                  await registerJob(result.job_id);
                  notifications.info('Widget refresh started');
                }}
                onUpdate={async (body: DashboardWidgetUpdate) => {
                  await updateWidget(widget.id, body);
                  await invalidate();
                  notifications.success('Widget updated');
                }}
                onDelete={async () => {
                  await deleteWidget(widget.id);
                  await invalidate();
                  notifications.success('Widget deleted');
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg shadow-xs">
          <BarChart3 size={40} className="mx-auto text-[var(--db-border-default)] mb-3" />
          <h3 className="text-sm font-semibold text-[var(--db-text-primary)]">This dashboard is empty</h3>
          <p className="text-xs text-[var(--db-text-secondary)] mt-1 max-w-sm mx-auto">
            Save any successful chart, metric, or data table from an AI conversation to pin it to this dashboard.
          </p>
        </div>
      )}
    </section>
  );
}
