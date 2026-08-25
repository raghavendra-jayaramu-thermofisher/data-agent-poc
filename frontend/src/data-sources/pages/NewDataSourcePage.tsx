import { Button } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
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
    if (activeOrganization?.role !== 'owner' && activeOrganization?.role !== 'admin')
        return <section className="page"><div className="inline-error">Only workspace owners and admins can create data sources.</div></section>;
    return <section className="page">
    <div className="page-header"><div><h1>Add data source</h1><p>Credentials are submitted to the backend and are never persisted as browser preferences.</p></div></div>
    <div className="segmented-actions"><Button size="sm" variant={mode === 'database' ? 'primary' : 'secondary'} onPress={() => setMode('database')}>Database</Button><Button size="sm" variant={mode === 'excel' ? 'primary' : 'secondary'} onPress={() => setMode('excel')}>Excel</Button></div>
    <div className="form-panel">{mode === 'database' ? <RelationalDataSourceForm onSubmit={async (payload) => { const source = await api.createRelationalDataSource(payload); await queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all(orgId) }); navigate(`/data-sources/${source.id}`); }}/> : <ExcelUploadForm onSubmit={async (name, file) => { const result = await api.createExcelDataSource(name, file); await jobs.registerJob(result.job_id); await queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all(orgId) }); navigate(`/data-sources/${result.data_source.id}`); }}/>}</div>
  </section>;
}
