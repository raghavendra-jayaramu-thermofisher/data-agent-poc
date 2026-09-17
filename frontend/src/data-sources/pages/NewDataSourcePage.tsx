import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Database, FileSpreadsheet } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { useJobManager } from '../../jobs/JobManagerProvider';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/data-source-api';
import { ExcelUploadForm } from '../components/ExcelUploadForm';
import { RelationalDataSourceForm } from '../components/RelationalDataSourceForm';

export function NewDataSourcePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const jobs = useJobManager();
  const [mode, setMode] = useState<'database' | 'excel'>('database');
  const orgId = activeOrganization?.id ?? null;

  if (activeOrganization?.role !== 'owner' && activeOrganization?.role !== 'admin') {
    return (
      <section className="page">
        <div className="inline-error">Only workspace owners and admins can create data sources.</div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="form-container">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--db-text-secondary)] hover:text-[var(--db-text-primary)] mb-4 transition-colors cursor-pointer"
          onClick={() => navigate('/data-sources')}
        >
          <ArrowLeft size={14} />
          <span>Back to Data Sources</span>
        </button>

        <div className="form-card">
          <div className="form-card-header">
            <div>
              <h1 className="text-lg font-semibold text-[var(--db-text-primary)] m-0">Add data source</h1>
              <p className="text-xs text-[var(--db-text-secondary)] mt-1 mb-0">
                Credentials are submitted directly to the backend and are never persisted in your browser.
              </p>
            </div>

            <div className="segmented-pill-container" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'database'}
                className={`segmented-pill-btn ${mode === 'database' ? 'is-active' : ''}`}
                onClick={() => setMode('database')}
              >
                <Database size={15} />
                <span>Database</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'excel'}
                className={`segmented-pill-btn ${mode === 'excel' ? 'is-active' : ''}`}
                onClick={() => setMode('excel')}
              >
                <FileSpreadsheet size={15} />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {mode === 'database' ? (
            <RelationalDataSourceForm
              onSubmit={async (payload) => {
                const source = await api.createRelationalDataSource(payload);
                await queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all(orgId) });
                navigate(`/data-sources/${source.id}`);
              }}
            />
          ) : (
            <ExcelUploadForm
              onSubmit={async (name, file) => {
                const result = await api.createExcelDataSource(name, file);
                await jobs.registerJob(result.job_id);
                await queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all(orgId) });
                navigate(`/data-sources/${result.data_source.id}`);
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

