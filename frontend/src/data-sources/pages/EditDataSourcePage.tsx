import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { ManagementHeader } from '../../components/management/ManagementUI';
import { queryKeys } from '../../api/queryKeys';
import { PageState } from '../../components/PageState';
import { notifications } from '../../components/notifications';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { useJobManager } from '../../jobs/JobManagerProvider';
import * as api from '../api/data-source-api';
import { DataSourceEditForm } from '../components/DataSourceEditForm';

export function EditDataSourcePage() {
  const { dataSourceId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const jobs = useJobManager();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const query = useQuery({
    queryKey: queryKeys.dataSources.detail(orgId, dataSourceId),
    queryFn: () => api.getDataSource(dataSourceId),
    enabled: Boolean(dataSourceId),
  });

  if (!canManage)
    return (
      <PageState
        title="Permission required"
        description="Only workspace owners and admins can edit data sources."
      />
    );
  if (query.isLoading) return <PageState title="Loading data source" loading />;
  if (query.isError || !query.data) return <PageState title="Data source not found" />;

  return (
    <section className="management-page management-form-page">
      <div className="form-container">
        <ManagementHeader
          title={'Edit ' + query.data.name}
          backTo={'/data-sources/' + query.data.id}
          backLabel="Back to data source"
        />

        <div className="form-card">
          <DataSourceEditForm
            key={query.data.id}
            source={query.data}
            onSubmit={async (values, testConnection) => {
              await api.updateDataSource(query.data.id, values);
              if (values.config) {
                queryClient.removeQueries({
                  queryKey: queryKeys.dataSources.schema(orgId, dataSourceId),
                });
                await queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(orgId) });
              }
              await queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all(orgId) });
              notifications.success('Data source updated');
              if (testConnection) {
                try {
                  const { job_id } = await api.testDataSource(dataSourceId);
                  await jobs.registerJob(job_id);
                  notifications.info('Connection test started. View its result in Jobs.');
                  navigate(`/jobs/${job_id}`);
                } catch (error) {
                  throw new Error(
                    `Changes saved, but the connection test could not be started: ${error instanceof Error ? error.message : 'Please retry from the data source page.'}`,
                    { cause: error },
                  );
                }
                return;
              }
              navigate(`/data-sources/${query.data.id}`);
            }}
          />
        </div>
      </div>
    </section>
  );
}
