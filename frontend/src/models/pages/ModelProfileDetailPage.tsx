import { zodResolver } from '@hookform/resolvers/zod';
import { Label, Switch } from '@heroui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams, Link } from 'react-router';
import { ArrowLeft, Cpu, Save, Star, AlertTriangle } from 'lucide-react';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../auth/components/FormField';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PageState } from '../../components/PageState';
import { SingleSelect } from '../../components/SingleSelect';
import { notifications } from '../../components/notifications';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/models-api';
import {
  modelProfileSchema,
  parseOptionalNumberInput,
  type ModelProfileValues,
} from '../schemas/model-schemas';

export function ModelProfileDetailPage() {
  const { profileId = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';

  const profile = useQuery({
    queryKey: queryKeys.models.profile(orgId, profileId),
    queryFn: () => api.getProfile(profileId),
    enabled: Boolean(profileId),
  });
  const connections = useQuery({
    queryKey: queryKeys.models.connections(orgId),
    queryFn: api.listConnections,
    enabled: Boolean(orgId),
  });

  if (profile.isLoading || connections.isLoading)
    return <PageState title="Loading model profile…" loading />;
  if (profile.isError || !profile.data)
    return <PageState title="Model profile not found" />;

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
    await profile.refetch();
  };

  const item = profile.data;

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
            <h1 className="text-xl font-semibold text-[#252127]">{item.display_name}</h1>
          </div>
          <p className="text-xs text-[#625C64] font-mono mt-0.5">{item.model_name}</p>
        </div>

        <div className="flex items-center gap-2">
          {item.is_default ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#FFF4CC] text-[#8C5A00] font-semibold text-xs border border-[#E3AC19]/40">
              <Star size={12} className="fill-[#8C5A00]" /> Default Profile
            </span>
          ) : canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#252127] border border-[#DAD5CD] rounded text-xs font-semibold transition-colors"
              onClick={() =>
                void api.setDefaultProfile(profileId).then(async () => {
                  await invalidate();
                  notifications.success('Default model updated');
                })
              }
            >
              <Star size={13} />
              <span>Make Default</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Edit Form Card */}
      {canManage && connections.data ? (
        <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-6 shadow-xs mb-6">
          <h2 className="text-sm font-semibold text-[#252127] pb-2 mb-4 border-b border-[#E7E3DC]">
            Profile Parameters
          </h2>
          <ProfileEdit
            key={item.id}
            profile={item}
            connections={connections.data}
            onSaved={async () => {
              await invalidate();
              notifications.success('Model profile updated');
            }}
          />
        </div>
      ) : (
        <div className="p-4 bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg text-xs text-[#8B848C] mb-6">
          This profile is read-only for your workspace role.
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
            Delete this reusable AI reasoning profile. The backend will reject deletion if it is currently set as the organization default.
          </p>
          <ConfirmationDialog
            triggerLabel="Delete profile"
            title="Delete model profile?"
            description="Delete this reusable model profile. The backend will reject deletion when it violates default-profile rules."
            confirmLabel="Delete"
            onConfirm={() => {
              void api.deleteProfile(profileId).then(async () => {
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

function ProfileEdit({
  profile,
  connections,
  onSaved,
}: {
  profile: Awaited<ReturnType<typeof api.getProfile>>;
  connections: Awaited<ReturnType<typeof api.listConnections>>;
  onSaved(): Promise<void>;
}) {
  const settings = profile.settings;
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ModelProfileValues>({
    resolver: zodResolver(modelProfileSchema),
    defaultValues: {
      connectionId: profile.connection_id,
      displayName: profile.display_name,
      modelName: profile.model_name,
      enabled: profile.enabled,
      isDefault: profile.is_default,
      temperature: typeof settings.temperature === 'number' ? settings.temperature : undefined,
      maxTokens: typeof settings.max_tokens === 'number' ? settings.max_tokens : undefined,
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      const nextSettings: Record<string, unknown> = { ...settings };
      if (values.temperature === undefined) delete nextSettings.temperature;
      else nextSettings.temperature = values.temperature;
      if (values.maxTokens === undefined) delete nextSettings.max_tokens;
      else nextSettings.max_tokens = values.maxTokens;

      await api.updateProfile(profile.id, {
        connection_id: values.connectionId,
        display_name: values.displayName,
        model_name: values.modelName,
        enabled: values.enabled,
        settings: nextSettings,
      });

      if (values.isDefault && !profile.is_default) {
        await api.setDefaultProfile(profile.id);
      }
      await onSaved();
    } catch (error) {
      setError('root', {
        message: (error as AppError).message ?? 'Unable to update profile.',
      });
    }
  });

  return (
    <form className="space-y-4 max-w-xl" onSubmit={submit}>
      <Controller
        control={control}
        name="connectionId"
        render={({ field }) => (
          <SingleSelect
            label="Backend Provider Connection"
            value={field.value}
            onChange={field.onChange}
            options={connections.map((connection) => ({
              value: connection.id,
              label: connection.name,
            }))}
          />
        )}
      />
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => <FormField label="Display Name" {...field} error={errors.displayName?.message} />}
      />
      <Controller
        control={control}
        name="modelName"
        render={({ field }) => <FormField label="Model Identifier" {...field} error={errors.modelName?.message} />}
      />

      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={control}
          name="temperature"
          render={({ field }) => <FormField label="Temperature" type="number" step="0.1" {...field} value={field.value ?? ''} onChange={(event) => field.onChange(parseOptionalNumberInput(event.target.value))} error={errors.temperature?.message} />}
        />
        <Controller
          control={control}
          name="maxTokens"
          render={({ field }) => <FormField label="Max Tokens" type="number" {...field} value={field.value ?? ''} onChange={(event) => field.onChange(parseOptionalNumberInput(event.target.value))} error={errors.maxTokens?.message} />}
        />
      </div>

      <div className="space-y-3 pt-2">
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Switch isSelected={field.value} onChange={field.onChange}>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Content>
                <Label>Enable Profile for Analysis</Label>
              </Switch.Content>
            </Switch>
          )}
        />
        <Controller
          control={control}
          name="isDefault"
          render={({ field }) => (
            <Switch isSelected={field.value} onChange={field.onChange}>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Content>
                <Label>Set as Default Workspace Profile</Label>
              </Switch.Content>
            </Switch>
          )}
        />
      </div>

      {errors.root?.message && (
        <div className="p-2.5 bg-[#F7E7E5] border border-[#DAD5CD] rounded text-xs text-[#A84545]">
          {errors.root.message}
        </div>
      )}

      <div className="pt-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <Save size={13} />
          <span>{isSubmitting ? 'Saving…' : 'Save Profile Changes'}</span>
        </button>
      </div>
    </form>
  );
}
