import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Switch } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../auth/components/FormField';
import { PageError, PageLoading } from '../../components/PageState';
import { SingleSelect } from '../../components/SingleSelect';
import {
  ManagementDeleteDialog,
  ManagementHeader,
  ManagementMenu,
  ManagementStatus,
} from '../../components/management/ManagementUI';
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
  const navigate = useNavigate();
  const client = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const [deleting, setDeleting] = useState(false);
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
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
  const makeDefault = useMutation({
    mutationFn: () => api.setDefaultProfile(profileId),
    onSuccess: async () => {
      await invalidate();
      notifications.success('Default model updated.');
    },
  });
  if (profile.isLoading || connections.isLoading)
    return <PageLoading label="Loading model profile…" />;
  if (profile.isError || !profile.data)
    return <PageError title="Unable to load this profile" retry={() => void profile.refetch()} />;
  if (connections.isError)
    return (
      <PageError
        title="Unable to load model connections"
        retry={() => void connections.refetch()}
      />
    );
  const item = profile.data;
  return (
    <section className="management-page management-form-page management-detail">
      <ManagementHeader
        title={item.display_name}
        backTo="/models"
        backLabel="Back to models"
        badge={
          item.is_default ? (
            <span className="management-badge" data-tone="accent">
              Workspace default
            </span>
          ) : (
            <ManagementStatus status={item.enabled ? 'enabled' : 'disabled'} />
          )
        }
      >
        {canManage && (
          <ManagementMenu
            name={item.display_name}
            disabled={makeDefault.isPending}
            actions={[
              ...(!item.is_default && item.enabled
                ? [{ id: 'default', label: 'Make workspace default', icon: <Star size={15} /> }]
                : []),
              {
                id: 'delete',
                label: 'Delete profile',
                icon: <Trash2 size={15} />,
                danger: true,
                disabled: item.is_default,
              },
            ]}
            onAction={(key) => {
              if (key === 'default') makeDefault.mutate();
              if (key === 'delete') setDeleting(true);
            }}
          />
        )}
      </ManagementHeader>
      {makeDefault.isError && (
        <p className="management-error" role="alert">
          {(makeDefault.error as unknown as AppError)?.message ||
            'Unable to change the default model.'}
        </p>
      )}
      <section className="management-panel">
        <h2>Profile settings</h2>
        {canManage && connections.data ? (
          <ProfileEdit
            key={item.id}
            profile={item}
            connections={connections.data}
            onSaved={async () => {
              await invalidate();
              notifications.success('Profile updated.');
            }}
          />
        ) : (
          <dl className="management-definition">
            <dt>Connection</dt>
            <dd>
              {connections.data?.find((connection) => connection.id === item.connection_id)?.name ??
                'Unavailable'}
            </dd>
            <dt>Model identifier</dt>
            <dd>{item.model_name}</dd>
            {typeof item.settings.temperature === 'number' && (
              <>
                <dt>Temperature</dt>
                <dd>{item.settings.temperature}</dd>
              </>
            )}
            {typeof item.settings.max_tokens === 'number' && (
              <>
                <dt>Max tokens</dt>
                <dd>{item.settings.max_tokens}</dd>
              </>
            )}
          </dl>
        )}
      </section>
      {deleting && (
        <ManagementDeleteDialog
          title="Delete model profile?"
          description={
            'Remove “' + item.display_name + '” from this workspace? This can’t be undone.'
          }
          confirmLabel="Delete profile"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await api.deleteProfile(profileId);
            await invalidate();
            void navigate('/models');
          }}
        />
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
    <form className="form-stack" onSubmit={submit}>
      <Controller
        control={control}
        name="connectionId"
        render={({ field }) => (
          <SingleSelect
            label="Connection"
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
        render={({ field }) => (
          <FormField label="Display name" {...field} error={errors.displayName?.message} />
        )}
      />
      <Controller
        control={control}
        name="modelName"
        render={({ field }) => (
          <FormField label="Model identifier" {...field} error={errors.modelName?.message} />
        )}
      />

      <div className="form-grid-2">
        <Controller
          control={control}
          name="temperature"
          render={({ field }) => (
            <FormField
              label="Temperature"
              type="number"
              step="0.1"
              {...field}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(parseOptionalNumberInput(event.target.value))}
              error={errors.temperature?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="maxTokens"
          render={({ field }) => (
            <FormField
              label="Max tokens"
              type="number"
              {...field}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(parseOptionalNumberInput(event.target.value))}
              error={errors.maxTokens?.message}
            />
          )}
        />
      </div>

      <div className="management-switches">
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Switch isSelected={field.value} onChange={field.onChange} aria-label="Profile enabled">
              <Switch.Content>
                <span className="management-switch-label">Profile enabled</span>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          )}
        />
        <Controller
          control={control}
          name="isDefault"
          render={({ field }) => (
            <Switch
              isSelected={field.value}
              onChange={field.onChange}
              aria-label="Workspace default"
            >
              <Switch.Content>
                <span className="management-switch-label">Workspace default</span>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          )}
        />
      </div>

      {errors.root?.message && (
        <div className="p-2.5 bg-[var(--db-danger-soft)] border border-[var(--db-border-default)] rounded text-xs text-[var(--db-danger)]">
          {errors.root.message}
        </div>
      )}

      <div className="form-actions">
        <Button type="submit" isPending={isSubmitting} variant="primary">
          <span>{isSubmitting ? 'Saving…' : 'Save changes'}</span>
        </Button>
      </div>
    </form>
  );
}
