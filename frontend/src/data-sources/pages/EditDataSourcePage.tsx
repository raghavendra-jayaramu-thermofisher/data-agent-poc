import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { queryKeys } from '../../api/queryKeys';
import { PageState } from '../../components/PageState';
import { notifications } from '../../components/notifications';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/data-source-api';
import { DataSourceEditForm } from '../components/DataSourceEditForm';

export function EditDataSourcePage() {
  const { dataSourceId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const query = useQuery({
    queryKey: queryKeys.dataSources.detail(orgId, dataSourceId),
    queryFn: () => api.getDataSource(dataSourceId),
    enabled: Boolean(dataSourceId),
  });

  if (!canManage) return <PageState title="Permission required" description="Only workspace owners and admins can edit data sources." />;
  if (query.isLoading) return <PageState title="Loading data source" loading />;
  if (query.isError || !query.data) return <PageState title="Data source not found" />;

  return (
    <section className="page">
      <div className="page-header">
        <div><h1>Edit {query.data.name}</h1><p>Saved credentials are never redisplayed. Enter credentials only when replacing them.</p></div>
      </div>
      <div className="form-panel">
        <DataSourceEditForm
          source={query.data}
          onSubmit={async (values) => {
            await api.updateDataSource(query.data.id, values);
            await queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all(orgId) });
            notifications.success('Data source updated');
            navigate(`/data-sources/${query.data.id}`);
          }}
        />
      </div>
    </section>
  );
}
