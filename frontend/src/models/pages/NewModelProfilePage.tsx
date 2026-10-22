import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Switch } from '@heroui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../auth/components/FormField';
import { PageError, PageLoading, PageState } from '../../components/PageState';
import { SingleSelect } from '../../components/SingleSelect';
import { ManagementHeader } from '../../components/management/ManagementUI';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/models-api';
import {
  modelProfileSchema,
  parseOptionalNumberInput,
  PRICE_FIELDS,
  type ModelProfileValues,
} from '../schemas/model-schemas';

export function NewModelProfilePage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const connections = useQuery({
    queryKey: queryKeys.models.connections(orgId),
    queryFn: api.listConnections,
    enabled: Boolean(orgId),
  });
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ModelProfileValues>({
    resolver: zodResolver(modelProfileSchema),
    defaultValues: {
      connectionId: '',
      displayName: '',
      modelName: '',
      enabled: true,
      isDefault: false,
      temperature: 0.2,
      maxTokens: 4000,
    },
  });
  if (!canManage)
    return (
      <PageState
        title="Permission required"
        description="Only workspace owners and admins can add model profiles."
      />
    );
  if (connections.isLoading) return <PageLoading label="Loading model connections…" />;
  if (connections.isError)
    return (
      <PageError title="Unable to load connections" retry={() => void connections.refetch()} />
    );
  const submit = handleSubmit(async (values) => {
    try {
      const settings: Record<string, unknown> = {};
      if (values.temperature !== undefined) settings.temperature = values.temperature;
      if (values.maxTokens !== undefined) settings.max_tokens = values.maxTokens;
      await api.createProfile({
        connection_id: values.connectionId,
        display_name: values.displayName,
        model_name: values.modelName,
        enabled: values.enabled,
        is_default: values.isDefault,
        settings,
        input_price_per_million: values.inputPrice ?? null,
        cached_input_price_per_million: values.cachedInputPrice ?? null,
        output_price_per_million: values.outputPrice ?? null,
      });
      await client.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
      void navigate('/models');
    } catch (error) {
      setError('root', { message: (error as AppError).message });
    }
  });
  return (
    <section className="management-page management-form-page">
      <ManagementHeader title="Add model profile" backTo="/models" backLabel="Back to models" />
      {!connections.data?.length ? (
        <div className="management-empty">
          <h2>Add a connection first</h2>
          <p>A profile needs a connection to your model provider.</p>
          <Button variant="primary" onPress={() => void navigate('/models/connections/new')}>
            Add connection
          </Button>
        </div>
      ) : (
        <form className="form-stack form-panel" onSubmit={submit}>
          <Controller
            control={control}
            name="connectionId"
            render={({ field }) => (
              <SingleSelect
                label="Connection"
                value={field.value}
                onChange={field.onChange}
                options={connections.data.map((connection) => ({
                  value: connection.id,
                  label: connection.name,
                }))}
              />
            )}
          />
          {errors.connectionId && (
            <p className="management-error" role="alert">
              {errors.connectionId.message}
            </p>
          )}
          <FormField
            label="Display name"
            {...register('displayName')}
            error={errors.displayName?.message}
          />
          <FormField
            label="Model identifier"
            {...register('modelName')}
            error={errors.modelName?.message}
          />
          <div className="form-grid-2">
            <FormField
              label="Temperature"
              type="number"
              step="0.1"
              {...register('temperature', { setValueAs: parseOptionalNumberInput })}
              error={errors.temperature?.message}
            />
            <FormField
              label="Max tokens"
              type="number"
              {...register('maxTokens', { setValueAs: parseOptionalNumberInput })}
              error={errors.maxTokens?.message}
            />
          </div>
          <fieldset className="model-pricing-fields">
            <legend>Pricing (USD per 1M tokens)</legend>
            <p>Used to calculate the cost of each question. Leave blank if unknown.</p>
            <div className="form-grid-3">
              {PRICE_FIELDS.map((price) => (
                <FormField
                  key={price.name}
                  label={price.label}
                  type="number"
                  step="0.001"
                  min="0"
                  {...register(price.name, { setValueAs: parseOptionalNumberInput })}
                  error={errors[price.name]?.message}
                />
              ))}
            </div>
          </fieldset>
          <div className="management-switches">
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <Switch
                  isSelected={field.value}
                  onChange={field.onChange}
                  aria-label="Profile enabled"
                >
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
          {errors.root && (
            <p className="management-error" role="alert">
              {errors.root.message}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              isDisabled={isSubmitting}
              onPress={() => void navigate('/models')}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isPending={isSubmitting}>
              Save profile
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
