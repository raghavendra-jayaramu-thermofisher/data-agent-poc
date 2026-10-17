import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import {
  Database,
  Edit,
  RefreshCw,
  Upload,
  ArrowLeft,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PageState } from '../../components/PageState';
import { StatusChip } from '../../components/StatusChip';
import { notifications } from '../../components/notifications';
import { formatLocalDateTime } from '../../lib/datetime';
import { safeDisplayEntries, safeJsonStringify } from '../../lib/security';
import { useJobManager } from '../../jobs/JobManagerProvider';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/data-source-api';
import { ConnectionDiagnosticsPanel } from '../components/ConnectionDiagnosticsPanel';

export function DataSourceDetailPage() {
  const { dataSourceId = '' } = useParams();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const jobs = useJobManager();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showSchema, setShowSchema] = useState(true);
  const replacementRef = useRef<HTMLInputElement>(null);

  const sourceQuery = useQuery({
    queryKey: queryKeys.dataSources.detail(orgId, dataSourceId),
    queryFn: () => api.getDataSource(dataSourceId),
    enabled: Boolean(dataSourceId),
  });

  const schemaQuery = useQuery({
    queryKey: queryKeys.dataSources.schema(orgId, dataSourceId),
    queryFn: () => api.getDataSourceSchema(dataSourceId),
    enabled: showSchema && Boolean(dataSourceId),
    staleTime: 60000,
  });

  const test = useMutation({
    mutationFn: () => api.testDataSource(dataSourceId),
    onSuccess: async ({ job_id }) => {
      await jobs.registerJob(job_id);
      notifications.info('Connection test started');
    },
    onError: (error) => notifications.error('Unable to start connection test', error instanceof Error ? error.message : undefined),
  });

  if (sourceQuery.isLoading) return <PageState title="Loading data source…" loading />;
  if (sourceQuery.isError || !sourceQuery.data)
    return (
      <PageState
        title="Data source not found"
        description="This data source is unavailable in the active workspace."
      />
    );

  const source = sourceQuery.data;

  return (
    <section className="page max-w-5xl mx-auto">
      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <Link
            to="/data-sources"
            className="inline-flex items-center gap-1 text-xs text-[var(--db-text-muted)] hover:text-[var(--db-primary)] mb-1 font-medium"
          >
            <ArrowLeft size={12} />
            <span>Back to data sources</span>
          </Link>
          <div className="flex items-center gap-2">
            <Database size={22} className="text-[var(--db-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--db-text-primary)]">{source.name}</h1>
          </div>
          <p className="text-xs text-[var(--db-text-secondary)] mt-0.5">
            {source.display_type.toUpperCase()} · Created {formatLocalDateTime(source.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusChip status={source.status} />
          {canManage && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)] text-[var(--db-text-primary)] border border-[var(--db-border-default)] rounded text-xs font-semibold transition-colors"
              onClick={() => navigate(`/data-sources/${source.id}/edit`)}
            >
              <Edit size={13} />
              <span>Edit</span>
            </button>
          )}
          {canManage && (
            <button
              type="button"
              disabled={test.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold transition-colors disabled:opacity-50"
              onClick={() => test.mutate()}
            >
              <RefreshCw size={13} className={test.isPending ? 'animate-spin' : ''} />
              <span>Test connection</span>
            </button>
          )}
        </div>
      </div>

      <ConnectionDiagnosticsPanel diagnostics={source.last_connection_diagnostics} code={source.last_error_code} sourceId={source.id} canManage={canManage} testing={test.isPending} onTest={() => test.mutate()} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Configuration Panel */}
        <div className="bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-[var(--db-text-primary)] pb-2 mb-3 border-b border-[var(--db-border-subtle)]">
            Connection configuration
          </h2>
          <dl className="grid grid-cols-3 gap-3 text-xs">
            {safeDisplayEntries(source.config).map(([key, value]) => (
              <Fragment key={key}>
                <dt className="text-[var(--db-text-muted)] uppercase text-[10px] font-semibold">
                  {key.replaceAll('_', ' ')}
                </dt>
                <dd className="col-span-2 text-[var(--db-text-primary)] font-mono break-all">
                  {value && typeof value === 'object' ? (
                    <pre className="compact-json inline-json">{safeJsonStringify(value)}</pre>
                  ) : (
                    String(value)
                  )}
                </dd>
              </Fragment>
            ))}
            <dt className="text-[var(--db-text-muted)] uppercase text-[10px] font-semibold">Last tested</dt>
            <dd className="col-span-2 text-[var(--db-text-secondary)]">
              {source.last_tested_at ? formatLocalDateTime(source.last_tested_at) : 'Never'}
            </dd>
            <dt className="text-[var(--db-text-muted)] uppercase text-[10px] font-semibold">Last error</dt>
            <dd className="col-span-2 text-[var(--db-danger)] font-mono">{source.last_error_code ?? '—'}</dd>
          </dl>
        </div>

        {/* Schema Introspection Panel */}
        <div className="bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--db-border-subtle)]">
            <div className="flex items-center gap-1.5">
              <Layers size={16} className="text-[var(--db-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--db-text-primary)]">Direct schema introspection</h2>
            </div>
            {!showSchema && (
              <button
                type="button"
                className="px-2.5 py-1 bg-[var(--db-surface-muted)] hover:bg-[var(--db-surface-hover)] text-[var(--db-text-primary)] border border-[var(--db-border-default)] rounded text-xs font-medium"
                onClick={() => setShowSchema(true)}
              >
                Inspect schema
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--db-text-secondary)] mb-3">
            Direct schema inspection queries live table catalogs and data types from the database.
          </p>
          {showSchema && (
            <div className="flex-1">
              {schemaQuery.isError ? <div role="alert" className="text-xs text-[var(--db-danger)]">
                <p className="font-semibold">Unable to load schema</p>
                <p>{schemaQuery.error?.message || 'Database schema inspection failed. Review the connection diagnostics and retry.'}</p>
                <button type="button" className="underline mt-2" onClick={() => void schemaQuery.refetch()}>Retry schema inspection</button>
              </div> : <SchemaView loading={schemaQuery.isLoading} tables={schemaQuery.data?.tables ?? []} />}
            </div>
          )}
        </div>
      </div>

      {source.display_type === 'excel' && canManage && (
        <div className="bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg p-5 shadow-xs mb-6">
          <div className="flex items-center gap-2 mb-1 text-[var(--db-text-primary)]">
            <FileSpreadsheet size={16} className="text-[var(--db-success)]" />
            <h2 className="text-sm font-semibold">Active Excel materialization</h2>
          </div>
          <p className="text-xs text-[var(--db-text-secondary)] mb-3">
            {source.active_file?.original_filename ?? 'Materialization is preparing.'}
          </p>
          <input
            ref={replacementRef}
            className="visually-hidden-file hidden"
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              void api.replaceExcelDataSource(source.id, file).then(async ({ job_id }) => {
                await jobs.registerJob(job_id);
                notifications.info('Workbook replacement started');
                event.currentTarget.value = '';
              });
            }}
          />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)] text-[var(--db-text-primary)] border border-[var(--db-border-default)] rounded text-xs font-semibold"
            onClick={() => replacementRef.current?.click()}
          >
            <Upload size={13} />
            <span>Upload replacement workbook</span>
          </button>
        </div>
      )}

      {/* Danger zone */}
      {canManage && (
        <div className="bg-[var(--db-surface-raised)] border border-[var(--db-danger)]/30 rounded-lg p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-1 text-[var(--db-danger)]">
            <AlertTriangle size={16} />
            <h2 className="text-sm font-semibold">Danger zone</h2>
          </div>
          <p className="text-xs text-[var(--db-text-secondary)] mb-3">
            Removing this data source will revoke AI assistant access to all its tables and schema documents.
          </p>
          <ConfirmationDialog
            triggerLabel="Delete data source"
            title="Delete data source?"
            description="This removes the data source connection. This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={() => {
              void api.deleteDataSource(source.id).then(async () => {
                await queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all(orgId) });
                navigate('/data-sources');
              });
            }}
          />
        </div>
      )}
    </section>
  );
}

function SchemaView({
  loading,
  tables,
}: {
  loading: boolean;
  tables: Awaited<ReturnType<typeof api.getDataSourceSchema>>['tables'];
}) {
  if (loading) return <PageState title="Inspecting schema…" loading />;
  if (!tables.length)
    return <p className="text-xs text-[var(--db-text-muted)] py-4 text-center">No tables were returned.</p>;

  return (
    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
      {tables.map((table) => (
        <details
          key={`${table.schema}.${table.name}`}
          className="border border-[var(--db-border-default)] rounded-md bg-[var(--db-surface)] overflow-hidden"
        >
          <summary className="p-2.5 cursor-pointer text-xs font-semibold text-[var(--db-text-primary)] hover:bg-[var(--db-surface-muted)] flex items-center justify-between">
            <span>
              {table.schema ? `${table.schema}.` : ''}
              {table.name}
            </span>
            <span className="text-[11px] font-normal text-[var(--db-text-muted)]">
              {table.columns.length} columns
            </span>
          </summary>

          <table className="analytical-table border-t border-[var(--db-border-default)]">
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Nullable</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((column) => (
                <tr key={column.name}>
                  <td className="font-mono text-xs text-[var(--db-text-primary)]">{column.name}</td>
                  <td className="text-xs text-[var(--db-text-secondary)]">{column.native_type}</td>
                  <td className="text-xs text-[var(--db-text-secondary)]">
                    {column.nullable === null ? 'Unknown' : column.nullable ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
