import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { LayoutDashboard, Plus, X } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PageState } from '../../components/PageState';
import { notifications } from '../../components/notifications';
import { formatLocalDateTime } from '../../lib/datetime';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { createDashboard, deleteDashboard } from '../api/dashboard-api';
import { DashboardForm } from '../components/DashboardForm';
import { SaveToDashboardModal } from '../components/SaveToDashboardModal';
import { useDashboards } from '../hooks/useDashboards';

export function DashboardsPage() {
  const dashboards = useDashboards();
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  async function remove(id: string) {
    await deleteDashboard(id);
    await qc.invalidateQueries({ queryKey: queryKeys.dashboards.all(orgId) });
    notifications.success('Dashboard deleted');
  }

  if (dashboards.isLoading) return <PageState title="Loading dashboards" loading />;
  if (dashboards.isError) {
    return (
      <PageState
        title="Unable to load dashboards"
        description="Check your connection and retry."
        action={
          <button
            type="button"
            className="px-3 py-1.5 bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded text-xs font-medium"
            onClick={() => void dashboards.refetch()}
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <section className="page max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard size={20} className="text-[var(--db-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--db-text-primary)]">Dashboards</h1>
          </div>
          <p className="text-xs text-[var(--db-text-secondary)]">
            Reusable, provenance-linked outputs saved from analytical jobs.
          </p>
        </div>

        {dashboards.data?.length || creating ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold transition-colors cursor-pointer"
            onClick={() => setCreating((value) => !value)}
          >
            {creating ? <X size={14} /> : <Plus size={14} />}
            <span>{creating ? 'Cancel' : 'New dashboard'}</span>
          </button>
        ) : null}
      </div>

      {creating && (
        <div className="p-5 mb-6 bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg shadow-xs">
          <h2 className="text-sm font-semibold text-[var(--db-text-primary)] mb-3">Create new dashboard</h2>
          <DashboardForm
            submitLabel="Create dashboard"
            onCancel={() => setCreating(false)}
            onSubmit={async (values) => {
              await createDashboard({ title: values.title, description: values.description || null });
              await qc.invalidateQueries({ queryKey: queryKeys.dashboards.all(orgId) });
              setCreating(false);
              notifications.success('Dashboard created');
            }}
          />
        </div>
      )}

      {dashboards.data?.length ? (
        <div className="dashboard-grid">
          {dashboards.data.map((dashboard) => (
            <div key={dashboard.id} className="dashboard-card group">
              <div className="mb-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <Link
                    to={`/dashboards/${dashboard.id}`}
                    className="font-semibold text-sm text-[var(--db-text-primary)] hover:text-[var(--db-primary)] transition-colors line-clamp-1"
                  >
                    {dashboard.title}
                  </Link>
                  <ConfirmationDialog
                    triggerLabel="Delete"
                    title="Delete dashboard?"
                    description="This removes the dashboard and its widgets. The originating analyses remain available."
                    confirmLabel="Delete dashboard"
                    onConfirm={() => void remove(dashboard.id)}
                  />
                </div>
                {dashboard.description ? (
                  <p className="text-xs text-[var(--db-text-secondary)] line-clamp-2 mb-2 leading-relaxed">
                    {dashboard.description}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--db-text-muted)] italic mb-2">No description provided</p>
                )}
              </div>

              <div className="pt-3 border-t border-[var(--db-border-subtle)] flex items-center justify-between text-xs text-[var(--db-text-secondary)]">
                <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 bg-[var(--db-surface-muted)] text-[var(--db-text-secondary)] rounded border border-[var(--db-border-subtle)] font-medium">
                  {dashboard.widget_count ?? 0} widget{(dashboard.widget_count ?? 0) === 1 ? '' : 's'}
                </span>
                <span className="text-[11px] text-[var(--db-text-muted)]">
                  {formatLocalDateTime(dashboard.updated_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : !creating ? (
        <div className="dashboard-empty-card">
          <div className="dashboard-empty-card__icon">
            <LayoutDashboard size={26} />
          </div>
          <h2 className="text-base font-semibold text-[var(--db-text-primary)] mb-1.5">No dashboards yet</h2>
          <p className="text-xs text-[var(--db-text-secondary)] max-w-md mx-auto mb-5 leading-relaxed">
            Dashboards let you organize and monitor charts, metrics, and SQL query tables saved from your chat analyses in one centralized place.
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            onClick={() => setCreating(true)}
          >
            <Plus size={14} />
            <span>Create your first dashboard</span>
          </button>
          <div className="mt-8 pt-5 border-t border-[var(--db-border-subtle)] text-[11px] text-[var(--db-text-muted)] max-w-xs text-center">
            💡 <strong>Tip:</strong> While asking questions to the Data Agent, click <strong>"Save to dashboard"</strong> under any generated chart or table to add widgets instantly.
          </div>
        </div>
      ) : null}

      <SaveToDashboardModal />
    </section>
  );
}
