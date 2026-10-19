import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../auth/components/FormField';
import { PageState } from '../../components/PageState';
import { SecretField } from '../../components/SecretField';
import { ManagementHeader } from '../../components/management/ManagementUI';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/models-api';
import { modelConnectionSchema, type ModelConnectionValues } from '../schemas/model-schemas';

export function NewModelConnectionPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ModelConnectionValues>({
    resolver: zodResolver(modelConnectionSchema),
    defaultValues: { name: '', baseUrl: 'https://api.openai.com/v1', apiKey: '' },
  });
  if (activeOrganization?.role !== 'owner' && activeOrganization?.role !== 'admin')
    return (
      <PageState
        title="Permission required"
        description="Only workspace owners and admins can add model connections."
      />
    );
  const submit = handleSubmit(async (values) => {
    try {
      const connection = await api.createConnection({
        name: values.name,
        base_url: values.baseUrl,
        api_key: values.apiKey || null,
      });
      await client.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
      void navigate('/models/connections/' + connection.id);
    } catch (error) {
      setError('root', { message: (error as AppError).message });
    }
  });
  return (
    <section className="management-page management-form-page">
      <ManagementHeader title="Add model connection" backTo="/models" backLabel="Back to models" />
      <form className="form-stack form-panel" onSubmit={submit}>
        <FormField label="Connection name" {...register('name')} error={errors.name?.message} />
        <FormField label="Base URL" {...register('baseUrl')} error={errors.baseUrl?.message} />
        <Controller
          control={control}
          name="apiKey"
          render={({ field }) => (
            <SecretField
              label="API key (optional)"
              {...field}
              value={field.value ?? ''}
              autoComplete="new-password"
              error={errors.apiKey?.message}
            />
          )}
        />
        <p className="management-note">Your saved API key stays hidden.</p>
        {errors.root && (
          <p className="management-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <div className="form-actions">
          <Button
            variant="secondary"
            type="button"
            isDisabled={isSubmitting}
            onPress={() => void navigate('/models')}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" isPending={isSubmitting}>
            Save connection
          </Button>
        </div>
      </form>
    </section>
  );
}
