import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Shield } from 'lucide-react';
import type { AppError } from '../../api/errors';
import { FormField } from '../../auth/components/FormField';
import { PageLoading, PageState } from '../../components/PageState';
import { notifications } from '../../components/notifications';
import { formatLocalDateTime } from '../../lib/datetime';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { hasAdminRole } from '../components/AdminSettingsGate';
import { useUpdateOrganization } from '../hooks/useSettings';
import {
  organizationSettingsSchema,
  type OrganizationSettingsValues,
} from '../schemas/organization-settings-schema';

export function OrganizationSettingsPage() {
  const { activeOrganization, isLoading } = useOrganization();
  const mutation = useUpdateOrganization();
  const canManage = hasAdminRole(activeOrganization?.role);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationSettingsValues>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: { name: activeOrganization?.name ?? '' },
  });

  useEffect(() => {
    reset({ name: activeOrganization?.name ?? '' });
  }, [activeOrganization?.id, activeOrganization?.name, reset]);

  const submit = handleSubmit(async (values) => {
    if (!activeOrganization || !canManage) return;
    try {
      await mutation.mutateAsync({ organizationId: activeOrganization.id, name: values.name });
      notifications.success('Organization updated');
    } catch (error) {
      setError('root', { message: (error as AppError).message });
    }
  });

  if (isLoading) return <PageLoading label="Loading organization…" />;
  if (!activeOrganization) {
    return (
      <PageState
        title="No active organization"
        description="Choose an available workspace to continue."
      />
    );
  }

  return (
    <div>
      <div className="pb-3 mb-4 border-b border-[var(--db-border-default)]">
        <h2 className="text-sm font-semibold text-[var(--db-text-primary)]">Organization Profile</h2>
        <p className="text-xs text-[var(--db-text-secondary)]">Current workspace metadata and membership role.</p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-xs mb-6 p-4 bg-[var(--db-surface)] border border-[var(--db-border-default)] rounded-md">
        <dt className="text-[var(--db-text-muted)] font-semibold uppercase text-[10px]">Workspace ID</dt>
        <dd className="col-span-2 font-mono text-[var(--db-text-primary)]">{activeOrganization.id}</dd>

        <dt className="text-[var(--db-text-muted)] font-semibold uppercase text-[10px]">Slug</dt>
        <dd className="col-span-2 text-[var(--db-text-primary)]">{activeOrganization.slug}</dd>

        <dt className="text-[var(--db-text-muted)] font-semibold uppercase text-[10px]">Your Role</dt>
        <dd className="col-span-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[var(--db-primary-soft)] text-[var(--db-primary)]">
            <Shield size={11} /> {activeOrganization.role ?? 'member'}
          </span>
        </dd>

        <dt className="text-[var(--db-text-muted)] font-semibold uppercase text-[10px]">Created</dt>
        <dd className="col-span-2 text-[var(--db-text-secondary)]">{formatLocalDateTime(activeOrganization.created_at)}</dd>

        <dt className="text-[var(--db-text-muted)] font-semibold uppercase text-[10px]">Updated</dt>
        <dd className="col-span-2 text-[var(--db-text-secondary)]">{formatLocalDateTime(activeOrganization.updated_at)}</dd>
      </dl>

      {canManage ? (
        <form className="space-y-4 max-w-md" onSubmit={submit}>
          <FormField label="Organization Name" {...register('name')} error={errors.name?.message} />
          {errors.root?.message ? (
            <div className="p-2.5 bg-[var(--db-danger-soft)] border border-[var(--db-border-default)] rounded text-xs text-[var(--db-danger)]" role="alert">
              {errors.root.message}
            </div>
          ) : null}
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Save size={13} />
              <span>{isSubmitting ? 'Saving…' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-[var(--db-text-muted)]">Only an owner or admin can rename this organization.</p>
      )}
    </div>
  );
}
