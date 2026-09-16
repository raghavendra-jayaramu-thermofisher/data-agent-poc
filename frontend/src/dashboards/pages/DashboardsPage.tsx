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

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold transition-colors"
          onClick={() => setCreating((value) => !value)}
        >
          {creating ? <X size={14} /> : <Plus size={14} />}
          <span>{creating ? 'Cancel' : 'New Dashboard'}</span>
        </button>
      </div>

      {creating && (
        <div className="p-4 mb-4 bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-md">
          <h2 className="text-sm font-semibold text-[var(--db-text-primary)] mb-3">Create New Dashboard</h2>
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
        <div className="analytical-table-shell">
          <table className="analytical-table" aria-label="Dashboards">
            <thead>
              <tr>
                <th>Dashboard Title</th>
                <th>Widgets</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dashboards.data.map((dashboard) => (
                <tr key={dashboard.id}>
                  <td>
                    <Link
                      to={`/dashboards/${dashboard.id}`}
                      className="font-medium text-[var(--db-primary)] hover:underline"
                    >
                      {dashboard.title}
                    </Link>
                    {dashboard.description ? (
                      <div className="text-[11px] text-[var(--db-text-secondary)]">{dashboard.description}</div>
                    ) : null}
                  </td>
                  <td className="text-xs text-[var(--db-text-secondary)]">{dashboard.widget_count ?? 0} widgets</td>
                  <td className="text-xs text-[var(--db-text-secondary)]">{formatLocalDateTime(dashboard.updated_at)}</td>
                  <td>
                    <ConfirmationDialog
                      triggerLabel="Delete"
                      title="Delete dashboard?"
                      description="This removes the dashboard and its widgets. The originating analyses remain available."
                      confirmLabel="Delete dashboard"
                      onConfirm={() => void remove(dashboard.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PageState
          title="No dashboards yet"
          description="Create a dashboard, or save useful charts and tables from a conversation."
          action={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} />
              <span>Create dashboard</span>
            </button>
          }
        />
      )}

      <SaveToDashboardModal />
    </section>
  );
}
