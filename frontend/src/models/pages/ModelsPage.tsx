import { Button, Tabs } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Eye, Pencil, Plus, RefreshCw, Star, Trash2, Unplug } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { PageError, PageLoading } from '../../components/PageState';
import {
  ManagementDeleteDialog,
  ManagementHeader,
  ManagementMenu,
  ManagementSearch,
  ManagementStatus,
} from '../../components/management/ManagementUI';
import { notifications } from '../../components/notifications';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/models-api';

type Removal = { id: string; name: string; type: 'profile' | 'connection' };
export function ModelsPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const [tab, setTab] = useState('profiles');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<Removal | null>(null);
  const connections = useQuery({
    queryKey: queryKeys.models.connections(orgId),
    queryFn: api.listConnections,
    enabled: Boolean(orgId),
  });
  const profiles = useQuery({
    queryKey: queryKeys.models.profiles(orgId),
    queryFn: api.listProfiles,
    enabled: Boolean(orgId),
  });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
  const test = useMutation({
    mutationFn: api.testConnection,
    onSuccess: async (result) => {
      await invalidate();
      notifications.success('Connection test passed.', result.model_count + ' models available.');
    },
    onError: (error: AppError) => notifications.error('Connection test failed', error.message),
  });
  const makeDefault = useMutation({
    mutationFn: api.setDefaultProfile,
    onSuccess: async () => {
      await invalidate();
      notifications.success('Default model updated.');
    },
    onError: (error: AppError) =>
      notifications.error('Unable to change the default model', error.message),
  });
  if (connections.isLoading || profiles.isLoading) return <PageLoading label="Loading models…" />;
  if (connections.isError || profiles.isError)
    return (
      <PageError
        title="Unable to load models"
        retry={() => {
          void connections.refetch();
          void profiles.refetch();
        }}
      />
    );
  const term = search.trim().toLocaleLowerCase();
  const visibleProfiles = (profiles.data ?? []).filter((item) =>
    (item.display_name + ' ' + item.model_name).toLocaleLowerCase().includes(term),
  );
  const visibleConnections = (connections.data ?? []).filter((item) =>
    (item.name + ' ' + item.base_url).toLocaleLowerCase().includes(term),
  );
  const canAddProfile = Boolean(connections.data?.length);
  const empty = (kind: 'profiles' | 'connections') => (
    <div className="management-empty">
      <Cpu size={26} aria-hidden="true" />
      <h2>{search ? 'No matching ' + kind : 'No model ' + kind + ' yet'}</h2>
      {search ? (
        <Button variant="secondary" onPress={() => setSearch('')}>
          Clear search
        </Button>
      ) : (
        <p>
          {kind === 'profiles'
            ? canAddProfile
              ? 'Add a profile to choose a model and its settings.'
              : 'Add a connection before creating a model profile.'
            : canManage
              ? 'Connect your model provider to get started.'
              : 'Ask a workspace admin to add a model connection.'}
        </p>
      )}
    </div>
  );
  return (
    <section className="management-page">
      <ManagementHeader title="Models">
        <ManagementSearch label="Search models" value={search} onChange={setSearch} />
        {canManage && (
          <Button
            variant="primary"
            onPress={() =>
              void navigate(
                tab === 'connections' || !canAddProfile
                  ? '/models/connections/new'
                  : '/models/profiles/new',
              )
            }
          >
            <Plus size={15} aria-hidden="true" />
            {tab === 'connections' || !canAddProfile ? 'Add connection' : 'Add profile'}
          </Button>
        )}
      </ManagementHeader>
      {(test.isError || makeDefault.isError) && (
        <p className="management-error" role="alert">
          {test.error?.message || makeDefault.error?.message}
        </p>
      )}
      <Tabs
        className="management-tabs"
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(key) => setTab(String(key))}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Model settings">
            <Tabs.Tab id="profiles">
              Profiles
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="connections">
              Connections
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="profiles">
          <div className="management-list">
            {visibleProfiles.map((item) => (
              <article className="management-row" key={item.id}>
                <Link className="management-row-link" to={'/models/profiles/' + item.id}>
                  <span className="management-row-icon">
                    <Cpu size={17} aria-hidden="true" />
                  </span>
                  <span className="management-row-copy">
                    <span className="management-row-title">{item.display_name}</span>
                    <span className="management-row-meta">{item.model_name}</span>
                  </span>
                </Link>
                <div className="management-row-tags">
                  {item.is_default && (
                    <span className="management-badge" data-tone="accent">
                      Workspace default
                    </span>
                  )}
                  {!item.enabled && <ManagementStatus status="disabled" />}
                </div>
                <ManagementMenu
                  name={item.display_name}
                  disabled={makeDefault.isPending}
                  actions={[
                    {
                      id: 'view',
                      label: canManage ? 'Edit profile' : 'View profile',
                      icon: canManage ? <Pencil size={15} /> : <Eye size={15} />,
                    },
                    ...(canManage
                      ? [
                          ...(!item.is_default && item.enabled
                            ? [
                                {
                                  id: 'default',
                                  label: 'Make workspace default',
                                  icon: <Star size={15} />,
                                },
                              ]
                            : []),
                          {
                            id: 'delete',
                            label: 'Delete profile',
                            icon: <Trash2 size={15} />,
                            danger: true,
                            disabled: item.is_default,
                          },
                        ]
                      : []),
                  ]}
                  onAction={(key) => {
                    if (key === 'view') void navigate('/models/profiles/' + item.id);
                    if (key === 'default') makeDefault.mutate(item.id);
                    if (key === 'delete')
                      setDeleting({ id: item.id, name: item.display_name, type: 'profile' });
                  }}
                />
              </article>
            ))}
          </div>
          {!visibleProfiles.length && empty('profiles')}
        </Tabs.Panel>
        <Tabs.Panel id="connections">
          <div className="management-list">
            {visibleConnections.map((item) => (
              <article className="management-row" key={item.id}>
                <Link className="management-row-link" to={'/models/connections/' + item.id}>
                  <span className="management-row-icon">
                    <Unplug size={17} aria-hidden="true" />
                  </span>
                  <span className="management-row-title">{item.name}</span>
                </Link>
                <div className="management-row-tags">
                  <ManagementStatus
                    status={test.isPending && test.variables === item.id ? 'running' : item.status}
                  />
                </div>
                <ManagementMenu
                  name={item.name}
                  disabled={test.isPending}
                  actions={[
                    {
                      id: 'view',
                      label: canManage ? 'Edit connection' : 'View connection',
                      icon: canManage ? <Pencil size={15} /> : <Eye size={15} />,
                    },
                    ...(canManage
                      ? [
                          { id: 'test', label: 'Test connection', icon: <RefreshCw size={15} /> },
                          {
                            id: 'delete',
                            label: 'Delete connection',
                            icon: <Trash2 size={15} />,
                            danger: true,
                          },
                        ]
                      : []),
                  ]}
                  onAction={(key) => {
                    if (key === 'view') void navigate('/models/connections/' + item.id);
                    if (key === 'test') test.mutate(item.id);
                    if (key === 'delete')
                      setDeleting({ id: item.id, name: item.name, type: 'connection' });
                  }}
                />
              </article>
            ))}
          </div>
          {!visibleConnections.length && empty('connections')}
        </Tabs.Panel>
      </Tabs>
      {deleting && (
        <ManagementDeleteDialog
          title={'Delete model ' + deleting.type + '?'}
          description={
            'Remove “' +
            deleting.name +
            '” from this workspace? ' +
            (deleting.type === 'connection'
              ? 'Profiles using this connection will need another connection.'
              : 'This can’t be undone.')
          }
          confirmLabel={'Delete ' + deleting.type}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (deleting.type === 'connection') await api.deleteConnection(deleting.id);
            else await api.deleteProfile(deleting.id);
            await invalidate();
            notifications.success('Model ' + deleting.type + ' deleted.');
          }}
        />
      )}
    </section>
  );
}
