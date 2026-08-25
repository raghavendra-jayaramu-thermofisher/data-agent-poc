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
            className="inline-flex items-center gap-1 text-xs text-[#8B848C] hover:text-[#4B123F] mb-1 font-medium"
          >
            <ArrowLeft size={12} />
            <span>Back to Data Sources</span>
          </Link>
          <div className="flex items-center gap-2">
            <Database size={22} className="text-[#4B123F]" />
            <h1 className="text-xl font-semibold text-[#252127]">{source.name}</h1>
          </div>
          <p className="text-xs text-[#625C64] mt-0.5">
            {source.display_type.toUpperCase()} · Created {formatLocalDateTime(source.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusChip status={source.status} />
          {canManage && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#252127] border border-[#DAD5CD] rounded text-xs font-semibold transition-colors"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded text-xs font-semibold transition-colors disabled:opacity-50"
              onClick={() => test.mutate()}
            >
              <RefreshCw size={13} className={test.isPending ? 'animate-spin' : ''} />
              <span>Test Connection</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Configuration Panel */}
        <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-[#252127] pb-2 mb-3 border-b border-[#E7E3DC]">
            Connection Configuration
          </h2>
          <dl className="grid grid-cols-3 gap-3 text-xs">
            {safeDisplayEntries(source.config).map(([key, value]) => (
              <Fragment key={key}>
                <dt className="text-[#8B848C] uppercase text-[10px] font-semibold">
                  {key.replaceAll('_', ' ')}
                </dt>
                <dd className="col-span-2 text-[#252127] font-mono break-all">
                  {value && typeof value === 'object' ? (
                    <pre className="compact-json inline-json">{safeJsonStringify(value)}</pre>
                  ) : (
                    String(value)
                  )}
                </dd>
              </Fragment>
            ))}
            <dt className="text-[#8B848C] uppercase text-[10px] font-semibold">Last Tested</dt>
            <dd className="col-span-2 text-[#625C64]">
              {source.last_tested_at ? formatLocalDateTime(source.last_tested_at) : 'Never'}
            </dd>
            <dt className="text-[#8B848C] uppercase text-[10px] font-semibold">Last Error</dt>
            <dd className="col-span-2 text-[#A84545] font-mono">{source.last_error_code ?? '—'}</dd>
          </dl>
        </div>

        {/* Schema Introspection Panel */}
        <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E7E3DC]">
            <div className="flex items-center gap-1.5">
              <Layers size={16} className="text-[#4B123F]" />
              <h2 className="text-sm font-semibold text-[#252127]">Direct Schema Introspection</h2>
            </div>
            {!showSchema && (
              <button
                type="button"
                className="px-2.5 py-1 bg-[#F0EEE9] hover:bg-[#EAE7E1] text-[#252127] border border-[#DAD5CD] rounded text-xs font-medium"
                onClick={() => setShowSchema(true)}
              >
                Inspect Schema
              </button>
            )}
          </div>
          <p className="text-xs text-[#625C64] mb-3">
            Direct schema inspection queries live table catalogs and data types from the database.
          </p>
          {showSchema && (
            <div className="flex-1">
              <SchemaView loading={schemaQuery.isLoading} tables={schemaQuery.data?.tables ?? []} />
            </div>
          )}
        </div>
      </div>

      {source.display_type === 'excel' && canManage && (
        <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-5 shadow-xs mb-6">
          <div className="flex items-center gap-2 mb-1 text-[#252127]">
            <FileSpreadsheet size={16} className="text-[#32745A]" />
            <h2 className="text-sm font-semibold">Active Excel Materialization</h2>
          </div>
          <p className="text-xs text-[#625C64] mb-3">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#252127] border border-[#DAD5CD] rounded text-xs font-semibold"
            onClick={() => replacementRef.current?.click()}
          >
            <Upload size={13} />
            <span>Upload Replacement Workbook</span>
          </button>
        </div>
      )}

      {/* Danger Zone */}
      {canManage && (
        <div className="bg-[#FFFDFC] border border-[#A84545]/30 rounded-lg p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-1 text-[#A84545]">
            <AlertTriangle size={16} />
            <h2 className="text-sm font-semibold">Danger Zone</h2>
          </div>
          <p className="text-xs text-[#625C64] mb-3">
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
    return <p className="text-xs text-[#8B848C] py-4 text-center">No tables were returned.</p>;

  return (
    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
      {tables.map((table) => (
        <details
          key={`${table.schema}.${table.name}`}
          className="border border-[#DAD5CD] rounded-md bg-[#FBFAF7] overflow-hidden"
        >
          <summary className="p-2.5 cursor-pointer text-xs font-semibold text-[#252127] hover:bg-[#F0EEE9] flex items-center justify-between">
            <span>
              {table.schema ? `${table.schema}.` : ''}
              {table.name}
            </span>
            <span className="text-[11px] font-normal text-[#8B848C]">
              {table.columns.length} columns
            </span>
          </summary>

          <table className="analytical-table border-t border-[#DAD5CD]">
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
                  <td className="font-mono text-xs text-[#252127]">{column.name}</td>
                  <td className="text-xs text-[#625C64]">{column.native_type}</td>
                  <td className="text-xs text-[#625C64]">
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
