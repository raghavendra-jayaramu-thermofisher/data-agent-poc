import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams, Link } from 'react-router';
import { ArrowLeft, Cpu, Activity, Save, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../auth/components/FormField';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PageState } from '../../components/PageState';
import { SecretField } from '../../components/SecretField';
import { StatusChip } from '../../components/StatusChip';
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
  const qc = useQueryClient();
  const nav = useNavigate();

  const query = useQuery({
    queryKey: queryKeys.models.connection(orgId, connectionId),
    queryFn: () => api.getConnection(connectionId),
    enabled: Boolean(connectionId),
  });

  const test = useMutation({
    mutationFn: () => api.testConnection(connectionId),
    onSuccess: (r) => notifications.success('Connection test succeeded', `${r.model_count} models available`),
    onError: (e: AppError) => notifications.error('Connection test failed', e.message),
  });

  if (query.isLoading) return <PageState title="Loading model connection…" loading />;
  if (query.isError || !query.data) return <PageState title="Connection not found" />;

  const item = query.data;

  return (
    <section className="page max-w-4xl mx-auto">
      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <Link
            to="/models"
            className="inline-flex items-center gap-1 text-xs text-[var(--db-text-muted)] hover:text-[var(--db-primary)] mb-1 font-medium"
          >
            <ArrowLeft size={12} />
            <span>Back to Models</span>
          </Link>
          <div className="flex items-center gap-2">
            <Cpu size={22} className="text-[var(--db-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--db-text-primary)]">{item.name}</h1>
          </div>
          <p className="text-xs text-[var(--db-text-secondary)] font-mono mt-0.5">{item.base_url}</p>
        </div>

        <div className="flex items-center gap-2">
          <StatusChip status={item.status} />
          {canManage && (
            <button
              type="button"
              disabled={test.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)] text-[var(--db-text-primary)] border border-[var(--db-border-default)] rounded text-xs font-semibold transition-colors disabled:opacity-50"
              onClick={() => test.mutate()}
            >
              <Activity size={13} className={test.isPending ? 'animate-spin' : ''} />
              <span>{test.isPending ? 'Testing…' : 'Test connection'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Metadata & Status Card */}
      <div className="bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg p-5 shadow-xs mb-6">
        <h2 className="text-sm font-semibold text-[var(--db-text-primary)] pb-2 mb-3 border-b border-[var(--db-border-subtle)]">
          Connection status
        </h2>
        <dl className="grid grid-cols-3 gap-3 text-xs">
          <dt className="text-[var(--db-text-muted)] font-semibold uppercase text-[10px]">API key status</dt>
          <dd className="col-span-2 flex items-center gap-1 text-[var(--db-text-primary)]">
            <ShieldCheck size={13} className="text-[var(--db-success)]" />
            <span>{item.has_api_key ? 'Stored securely in backend vault' : 'Not configured'}</span>
          </dd>

          <dt className="text-[var(--db-text-muted)] font-semibold uppercase text-[10px]">Last tested</dt>
          <dd className="col-span-2 text-[var(--db-text-primary)]">
            {item.last_tested_at ? formatLocalDateTime(item.last_tested_at) : 'Never'}
          </dd>

          <dt className="text-[var(--db-text-muted)] font-semibold uppercase text-[10px]">Last error</dt>
          <dd className="col-span-2 text-[var(--db-text-secondary)]">{item.last_error_code ?? '—'}</dd>
        </dl>
      </div>

      {/* Form Settings Card */}
      {canManage && (
        <div className="bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg p-5 shadow-xs mb-6">
          <h2 className="text-sm font-semibold text-[var(--db-text-primary)] pb-2 mb-4 border-b border-[var(--db-border-subtle)]">
            Endpoint configuration
          </h2>
          <ConnectionEdit
            key={item.id}
            connection={item}
            onSaved={async () => {
              await qc.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
              notifications.success('Model connection updated');
            }}
          />
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
            Deleting this connection will affect any AI reasoning profiles routed through it.
          </p>
          <ConfirmationDialog
            triggerLabel="Delete connection"
            title="Delete model connection?"
            description="Profiles using this connection may need to be updated first."
            confirmLabel="Delete"
            onConfirm={() => {
              void api.deleteConnection(connectionId).then(async () => {
                await qc.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
                nav('/models');
              });
            }}
          />
        </div>
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
    <form className="space-y-4 max-w-lg" onSubmit={submit}>
      <Controller control={control} name="name" render={({ field }) => <FormField label="Connection name" {...field} error={errors.name?.message} />} />
      <Controller control={control} name="baseUrl" render={({ field }) => <FormField label="Base URL" {...field} error={errors.baseUrl?.message} />} />
      <Controller
        control={control}
        name="apiKey"
        render={({ field }) => (
          <SecretField
            label="Replace API key"
            {...field}
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
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <Save size={13} />
          <span>{isSubmitting ? 'Saving…' : 'Save changes'}</span>
        </button>
        {connection.has_api_key && (
          <button
            type="button"
            className="px-3 py-1.5 bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)] text-[var(--db-text-secondary)] border border-[var(--db-border-default)] rounded text-xs font-medium transition-colors"
            onClick={() => void api.updateConnection(connection.id, { clear_api_key: true }).then(onSaved)}
          >
            Clear stored key
          </button>
        )}
      </div>
    </form>
  );
}
