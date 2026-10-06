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
            className="inline-flex items-center gap-1 text-xs text-[#8B848C] hover:text-[#4B123F] mb-1 font-medium"
          >
            <ArrowLeft size={12} />
            <span>Back to Models</span>
          </Link>
          <div className="flex items-center gap-2">
            <Cpu size={22} className="text-[#4B123F]" />
            <h1 className="text-xl font-semibold text-[#252127]">{item.name}</h1>
          </div>
          <p className="text-xs text-[#625C64] font-mono mt-0.5">{item.base_url}</p>
        </div>

        <div className="flex items-center gap-2">
          <StatusChip status={item.status} />
          {canManage && (
            <button
              type="button"
              disabled={test.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#252127] border border-[#DAD5CD] rounded text-xs font-semibold transition-colors disabled:opacity-50"
              onClick={() => test.mutate()}
            >
              <Activity size={13} className={test.isPending ? 'animate-spin' : ''} />
              <span>{test.isPending ? 'Testing…' : 'Test Connection'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Metadata & Status Card */}
      <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-5 shadow-xs mb-6">
        <h2 className="text-sm font-semibold text-[#252127] pb-2 mb-3 border-b border-[#E7E3DC]">
          Connection Status
        </h2>
        <dl className="grid grid-cols-3 gap-3 text-xs">
          <dt className="text-[#8B848C] font-semibold uppercase text-[10px]">API Key Status</dt>
          <dd className="col-span-2 flex items-center gap-1 text-[#252127]">
            <ShieldCheck size={13} className="text-[#32745A]" />
            <span>{item.has_api_key ? 'Stored securely in backend vault' : 'Not configured'}</span>
          </dd>

          <dt className="text-[#8B848C] font-semibold uppercase text-[10px]">Last Tested</dt>
          <dd className="col-span-2 text-[#252127]">
            {item.last_tested_at ? formatLocalDateTime(item.last_tested_at) : 'Never'}
          </dd>

          <dt className="text-[#8B848C] font-semibold uppercase text-[10px]">Last Error</dt>
          <dd className="col-span-2 text-[#625C64]">{item.last_error_code ?? '—'}</dd>
        </dl>
      </div>

      {/* Form Settings Card */}
      {canManage && (
        <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-5 shadow-xs mb-6">
          <h2 className="text-sm font-semibold text-[#252127] pb-2 mb-4 border-b border-[#E7E3DC]">
            Endpoint Configuration
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

      {/* Danger Zone */}
      {canManage && (
        <div className="bg-[#FFFDFC] border border-[#A84545]/30 rounded-lg p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-1 text-[#A84545]">
            <AlertTriangle size={16} />
            <h2 className="text-sm font-semibold">Danger Zone</h2>
          </div>
          <p className="text-xs text-[#625C64] mb-3">
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
      <Controller control={control} name="name" render={({ field }) => <FormField label="Connection Name" {...field} error={errors.name?.message} />} />
      <Controller control={control} name="baseUrl" render={({ field }) => <FormField label="Base URL" {...field} error={errors.baseUrl?.message} />} />
      <Controller
        control={control}
        name="apiKey"
        render={({ field }) => (
          <SecretField
            label="Replace API Key"
            {...field}
            autoComplete="new-password"
            error={errors.apiKey?.message}
          />
        )}
      />
      <p className="text-[11px] text-[#8B848C]">
        Leave the replacement field blank to keep the stored key.
      </p>
      {errors.root?.message && (
        <div className="p-2.5 bg-[#F7E7E5] border border-[#DAD5CD] rounded text-xs text-[#A84545]">
          {errors.root.message}
        </div>
      )}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <Save size={13} />
          <span>{isSubmitting ? 'Saving…' : 'Save Changes'}</span>
        </button>
        {connection.has_api_key && (
          <button
            type="button"
            className="px-3 py-1.5 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#625C64] border border-[#DAD5CD] rounded text-xs font-medium transition-colors"
            onClick={() => void api.updateConnection(connection.id, { clear_api_key: true }).then(onSaved)}
          >
            Clear Stored Key
          </button>
        )}
      </div>
    </form>
  );
}
