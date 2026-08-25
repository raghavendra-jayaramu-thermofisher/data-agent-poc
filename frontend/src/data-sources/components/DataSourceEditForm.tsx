import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import type { AppError } from '../../api/errors';
import type { DataSource } from '../../api/types';
import { FormField } from '../../auth/components/FormField';
import { SecretField } from '../../components/SecretField';
import { SingleSelect } from '../../components/SingleSelect';
import type { DataSourceUpdate } from '../api/data-source-api';
import { dataSourceEditSchema, type DataSourceEditValues } from '../schemas/data-source-schemas';
const statuses = [{ value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' }] as const;
export function DataSourceEditForm({ source, onSubmit }: {
    source: DataSource;
    onSubmit(values: DataSourceUpdate): Promise<void>;
}) {
    const { register, control, handleSubmit, resetField, setError, formState: { errors, isSubmitting } } = useForm<DataSourceEditValues>({ resolver: zodResolver(dataSourceEditSchema), defaultValues: { name: source.name, status: source.status === 'disabled' ? 'disabled' : 'active', username: '', password: '' } });
    const submit = handleSubmit(async (values) => { try {
        const credentials = values.username && values.password ? { username: values.username, password: values.password } : undefined;
        await onSubmit({ name: values.name, status: values.status, credentials });
        resetField('username');
        resetField('password');
    }
    catch (error) {
        setError('root', { message: (error as AppError).message ?? 'Update failed.' });
    } });
    return <form className="form-stack" onSubmit={submit} noValidate><FormField label="Name" {...register('name')} error={errors.name?.message}/><Controller control={control} name="status" render={({ field }) => <SingleSelect label="Status" value={field.value} onChange={field.onChange} options={statuses}/>}/><div className="section-divider"><strong>Replace credentials</strong><p className="muted-copy">Stored credentials are never redisplayed. Leave both fields blank to keep the current secret.</p></div><FormField label="Username" autoComplete="off" {...register('username')} error={errors.username?.message}/><Controller control={control} name="password" render={({ field }) => <SecretField label="New password" {...field} autoComplete="new-password" error={errors.password?.message}/>}/>{errors.root?.message ? <div className="inline-error" role="alert">{errors.root.message}</div> : null}<div className="form-actions"><Button type="submit" variant="primary" isPending={isSubmitting}>Save changes</Button></div></form>;
}
