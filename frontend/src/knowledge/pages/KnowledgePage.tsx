import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { BrainCircuit, Database, Plus } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { PageState } from '../../components/PageState';
import { StatusChip } from '../../components/StatusChip';
import { formatLocalDateTime } from '../../lib/datetime';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { listDataSources } from '../../data-sources/api/data-source-api';
import * as api from '../api/knowledge-api';

export function KnowledgePage() {
  const navigate = useNavigate();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';

  const sources = useQuery({
    queryKey: queryKeys.dataSources.list(orgId),
    queryFn: listDataSources,
    enabled: Boolean(orgId),
  });

  const statuses = useQueries({
    queries: (sources.data ?? []).map((source) => ({
      queryKey: queryKeys.knowledge.status(orgId, source.id),
      queryFn: () => api.getStatus(source.id),
      enabled: Boolean(orgId),
    })),
  });

  if (sources.isLoading) return <PageState title="Loading knowledge bases" loading />;
  if (sources.isError)
    return <PageState title="Unable to load knowledge bases" description="Data sources could not be loaded." />;

  if (!sources.data?.length) {
    return (
      <PageState
        title="No data sources"
        description={
          canManage
            ? 'Add a data source before generating analytical knowledge.'
            : 'An owner or admin must add a data source first.'
        }
        action={
          canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold"
              onClick={() => navigate('/data-sources/new')}
            >
              <Plus size={14} />
              <span>Add Data Source</span>
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="page max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit size={20} className="text-[var(--db-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--db-text-primary)]">Knowledge Bases & Schemas</h1>
          </div>
          <p className="text-xs text-[var(--db-text-secondary)]">
            Deterministic schema introspection, table definitions, and business annotations.
          </p>
        </div>
      </div>

      <div className="analytical-table-shell">
        <table className="analytical-table" aria-label="Knowledge by data source">
          <thead>
            <tr>
              <th>Data Source</th>
              <th>Status</th>
              <th>Schema Objects</th>
              <th>Last Generated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sources.data.map((source, index) => {
              const status = statuses[index]?.data;
              return (
                <tr key={source.id}>
                  <td>
                    <Link
                      to={`/knowledge/${source.id}`}
                      className="font-medium text-[var(--db-primary)] hover:underline flex items-center gap-1.5"
                    >
                      <Database size={13} className="text-[var(--db-text-muted)]" />
                      <span>{source.name}</span>
                    </Link>
                  </td>
                  <td>
                    <StatusChip status={status?.status ?? (statuses[index]?.isLoading ? 'loading' : 'empty')} />
                  </td>
                  <td className="font-mono text-[var(--db-text-secondary)]">{status?.object_count ?? '—'}</td>
                  <td className="text-[var(--db-text-secondary)]">
                    {status?.generated_at ? formatLocalDateTime(status.generated_at) : 'Never'}
                  </td>
                  <td>
                    <Link
                      to={`/knowledge/${source.id}`}
                      className="text-xs text-[var(--db-primary)] font-semibold hover:underline"
                    >
                      Inspect / Train →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
