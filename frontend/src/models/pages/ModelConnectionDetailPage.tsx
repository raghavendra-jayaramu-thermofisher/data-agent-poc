import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../auth/components/FormField';
import { PageError, PageLoading } from '../../components/PageState';
import { SecretField } from '../../components/SecretField';
import {
  ManagementDeleteDialog,
  ManagementHeader,
  ManagementMenu,
  ManagementStatus,
} from '../../components/management/ManagementUI';
import { notifications } from '../../components/notifications';
import { formatLocalDateTime } from '../../lib/datetime';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/models-api';
import { modelConnectionSchema, type ModelConnectionValues } from '../schemas/model-schemas';

export function ModelConnectionDetailPage() {
  const { connectionId = '' } = useParams();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const client = useQueryClient();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.models.connection(orgId, connectionId),
    queryFn: () => api.getConnection(connectionId),
    enabled: Boolean(connectionId),
  });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
  const test = useMutation({
    mutationFn: () => api.testConnection(connectionId),
    onSuccess: async (result) => {
      await invalidate();
      notifications.success('Connection test passed.', result.model_count + ' models available.');
    },
    onError: (error: AppError) => notifications.error('Connection test failed', error.message),
  });
  if (query.isLoading) return <PageLoading label="Loading model connection…" />;
  if (query.isError || !query.data)
    return <PageError title="Unable to load this connection" retry={() => void query.refetch()} />;
  const item = query.data;
  return (
    <section className="management-page management-form-page management-detail">
      <ManagementHeader
        title={item.name}
        backTo="/models"
        backLabel="Back to models"
        badge={<ManagementStatus status={item.status} />}
      >
        {canManage && (
          <>
            <Button variant="secondary" isPending={test.isPending} onPress={() => test.mutate()}>
              {test.isPending ? 'Testing…' : 'Test connection'}
            </Button>
            <ManagementMenu
              name={item.name}
              actions={[
                {
                  id: 'delete',
                  label: 'Delete connection',
                  icon: <Trash2 size={15} />,
                  danger: true,
                },
              ]}
              onAction={() => setDeleting(true)}
            />
          </>
        )}
      </ManagementHeader>
      {test.isError && (
        <p className="management-error" role="alert">
          {test.error.message}
        </p>
      )}
      <section className="management-panel">
        <h2>Connection settings</h2>
        <dl className="management-definition management-connection-summary">
          {!canManage && (
            <>
              <dt>Base URL</dt>
              <dd>{item.base_url}</dd>
            </>
          )}
          <dt>API key</dt>
          <dd>{item.has_api_key ? 'Saved securely' : 'Not configured'}</dd>
          <dt>Last tested</dt>
          <dd>
            {item.last_tested_at ? formatLocalDateTime(item.last_tested_at) : 'Not tested yet'}
          </dd>
          {item.last_error_code && (
            <>
              <dt>Last error</dt>
              <dd>{item.last_error_code}</dd>
            </>
          )}
        </dl>
        {canManage && (
          <ConnectionEdit
            key={item.id}
            connection={item}
            onSaved={async () => {
              await invalidate();
              notifications.success('Connection updated.');
            }}
          />
        )}
      </section>
      {deleting && (
        <ManagementDeleteDialog
          title="Delete model connection?"
          description={
            'Remove “' +
            item.name +
            '”? Profiles using this connection will need another connection.'
          }
          confirmLabel="Delete connection"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await api.deleteConnection(connectionId);
            await invalidate();
            void navigate('/models');
          }}
        />
      )}
    </section>
  );
}

function ConnectionEdit({
  connection,
  onSaved,
}: {
  connection: Awaited<ReturnType<typeof api.getConnection>>;
  onSaved(): Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<ModelConnectionValues>({
    resolver: zodResolver(modelConnectionSchema),
    defaultValues: { name: connection.name, baseUrl: connection.base_url, apiKey: '' },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await api.updateConnection(connection.id, {
        name: v.name,
        base_url: v.baseUrl,
        clear_api_key: false,
        ...(v.apiKey ? { api_key: v.apiKey } : {}),
      });
      resetField('apiKey');
      await onSaved();
    } catch (e) {
      setError('root', { message: (e as AppError).message });
    }
  });

  return (
    <form className="form-stack" onSubmit={submit}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <FormField label="Connection name" {...field} error={errors.name?.message} />
        )}
      />
      <Controller
        control={control}
        name="baseUrl"
        render={({ field }) => (
          <FormField label="Base URL" {...field} error={errors.baseUrl?.message} />
        )}
      />
      <Controller
        control={control}
        name="apiKey"
        render={({ field }) => (
          <SecretField
            label="Replace API key"
            {...field}
            value={field.value ?? ''}
            autoComplete="new-password"
            error={errors.apiKey?.message}
          />
        )}
      />
      <p className="text-[11px] text-[var(--db-text-muted)]">
        Leave the replacement field blank to keep the stored key.
      </p>
      {errors.root?.message && (
        <div className="p-2.5 bg-[var(--db-danger-soft)] border border-[var(--db-border-default)] rounded text-xs text-[var(--db-danger)]">
          {errors.root.message}
        </div>
      )}
      <div className="form-actions">
        <Button type="submit" isPending={isSubmitting} variant="primary">
          <span>{isSubmitting ? 'Saving…' : 'Save changes'}</span>
        </Button>
        {connection.has_api_key && (
          <button
            type="button"
            className="px-3 py-1.5 bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)] text-[var(--db-text-secondary)] border border-[var(--db-border-default)] rounded text-xs font-medium transition-colors"
            onClick={() =>
              void api
                .updateConnection(connection.id, { clear_api_key: true })
                .then(onSaved)
                .catch((error: AppError) =>
                  setError('root', { message: error.message || 'Unable to clear the saved key.' }),
                )
            }
          >
            Clear stored key
          </button>
        )}
      </div>
    </form>
  );
}
