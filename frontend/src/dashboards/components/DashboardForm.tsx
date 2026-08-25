import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useForm } from 'react-hook-form';
import type { AppError } from '../../api/errors';
import { FormField } from '../../auth/components/FormField';
import { dashboardFormSchema, type DashboardFormValues } from '../schemas/dashboard-schemas';

export function DashboardForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial?: Partial<DashboardFormValues>;
  submitLabel: string;
  onSubmit(values: DashboardFormValues): Promise<void>;
  onCancel?(): void;
}) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<DashboardFormValues>({
    resolver: zodResolver(dashboardFormSchema),
    defaultValues: { title: initial?.title ?? '', description: initial?.description ?? '' },
  });
  const submit = handleSubmit(async (values) => {
    try { await onSubmit(values); }
    catch (error) { setError('root', { message: (error as AppError).message }); }
  });
  return <form className="form-stack dashboard-form" onSubmit={submit}>
    <FormField label="Title" {...register('title')} error={errors.title?.message}/>
    <FormField label="Description" {...register('description')} error={errors.description?.message}/>
    {errors.root?.message ? <div className="inline-error" role="alert">{errors.root.message}</div> : null}
    <div className="form-actions">
      <Button type="submit" variant="primary" isPending={isSubmitting}>{submitLabel}</Button>
      {onCancel ? <Button type="button" variant="secondary" onPress={onCancel}>Cancel</Button> : null}
    </div>
  </form>;
}
