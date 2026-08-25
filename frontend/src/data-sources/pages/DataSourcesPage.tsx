import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Database, Plus } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { PageState } from '../../components/PageState';
import { StatusChip } from '../../components/StatusChip';
import { formatLocalDateTime } from '../../lib/datetime';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { listDataSources } from '../api/data-source-api';

function displayType(value: string) {
  return value === 'postgres'
    ? 'PostgreSQL'
    : value === 'mysql'
    ? 'MySQL'
    : value === 'mssql'
    ? 'Microsoft SQL Server'
    : value === 'excel'
    ? 'Excel'
    : value;
}

export function DataSourcesPage() {
  const navigate = useNavigate();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const query = useQuery({
    queryKey: queryKeys.dataSources.list(orgId),
    queryFn: listDataSources,
    enabled: Boolean(orgId),
  });

  if (query.isLoading) return <PageState title="Loading data sources" loading />;
  if (query.isError)
    return <PageState title="Unable to load data sources" description="Check your connection and try again." />;

  return (
    <section className="page max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1>Data Sources</h1>
          <p>Database and workbook connections available to this workspace.</p>
        </div>
        {canManage && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded text-xs font-semibold transition-colors"
            onClick={() => navigate('/data-sources/new')}
          >
            <Plus size={14} />
            <span>Add Data Source</span>
          </button>
        )}
      </div>

      {query.data?.length ? (
        <div className="analytical-table-shell">
          <table className="analytical-table" aria-label="Data sources">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Last Tested</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((source) => (
                <tr key={source.id}>
                  <td>
                    <Link
                      to={`/data-sources/${source.id}`}
                      className="font-medium text-[#4B123F] hover:underline flex items-center gap-1.5"
                    >
                      <Database size={13} className="text-[#8B848C]" />
                      <span>{source.name}</span>
                    </Link>
                  </td>
                  <td className="text-[#625C64]">{displayType(source.display_type)}</td>
                  <td>
                    <StatusChip status={source.status} />
                  </td>
                  <td className="text-[#625C64]">
                    {source.last_tested_at ? formatLocalDateTime(source.last_tested_at) : 'Never'}
                  </td>
                  <td className="text-[#625C64]">{formatLocalDateTime(source.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PageState
          title="No data sources"
          description={
            canManage
              ? 'Connect PostgreSQL, MySQL, Microsoft SQL Server, or upload Excel.'
              : 'An owner or admin can add data sources.'
          }
          action={
            canManage ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded text-xs font-semibold"
                onClick={() => navigate('/data-sources/new')}
              >
                <Plus size={14} />
                <span>Add Data Source</span>
              </button>
            ) : undefined
          }
        />
      )}
    </section>
  );
}
