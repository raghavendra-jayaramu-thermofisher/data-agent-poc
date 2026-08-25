import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label, Switch } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import type { AppError } from '../../api/errors';
import { SecretField } from '../../components/SecretField';
import { SingleSelect } from '../../components/SingleSelect';
import { FormField } from '../../auth/components/FormField';
import type { RelationalDataSourceCreate } from '../api/data-source-api';
import { modelDefaultsByKind, relationalDataSourceSchema, type RelationalDataSourceValues } from '../schemas/data-source-schemas';
type Props = {
    onSubmit(values: RelationalDataSourceCreate): Promise<void>;
};
const kindOptions = [
    { value: 'postgres', label: 'PostgreSQL' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'mssql', label: 'Microsoft SQL Server' },
] as const;
const sslModeOptions = [
    { value: 'disable', label: 'Disable' }, { value: 'prefer', label: 'Prefer' }, { value: 'require', label: 'Require' }, { value: 'verify-ca', label: 'Verify CA' }, { value: 'verify-full', label: 'Verify full' },
] as const;
export function buildRelationalPayload(values: RelationalDataSourceValues): RelationalDataSourceCreate {
    const credentials = { username: values.username, password: values.password };
    if (values.kind === 'postgres')
        return { kind: 'postgres', name: values.name, credentials, config: { host: values.host, port: values.port, database: values.database, schema_name: values.schemaName || 'public', ssl_mode: values.sslMode ?? 'prefer' } };
    if (values.kind === 'mysql')
        return { kind: 'mysql', name: values.name, credentials, config: { host: values.host, port: values.port, database: values.database, ssl: values.ssl } };
    return { kind: 'mssql', name: values.name, credentials, config: { host: values.host, port: values.port, database: values.database, schema_name: values.schemaName || 'dbo', encrypt: values.encrypt, trust_server_certificate: values.trustServerCertificate, odbc_driver: values.odbcDriver || 'ODBC Driver 18 for SQL Server' } };
}
export function RelationalDataSourceForm({ onSubmit }: Props) {
    const { register, control, watch, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm<RelationalDataSourceValues>({
        resolver: zodResolver(relationalDataSourceSchema),
        defaultValues: { kind: 'postgres', name: '', host: '', port: 5432, database: '', schemaName: 'public', username: '', password: '', sslMode: 'prefer', ssl: false, encrypt: true, trustServerCertificate: false, odbcDriver: 'ODBC Driver 18 for SQL Server' },
    });
    const kind = watch('kind');
    const submit = handleSubmit(async (values) => {
        try {
            await onSubmit(buildRelationalPayload(values));
        }
        catch (error) {
            const appError = error as AppError;
            if (appError.fieldErrors)
                Object.entries(appError.fieldErrors).forEach(([key, message]) => setError(key as keyof RelationalDataSourceValues, { message }));
            else
                setError('root', { message: appError.message ?? 'Unable to save data source.' });
        }
    });
    return <form className="form-stack form-width" onSubmit={submit} noValidate>
    <Controller control={control} name="kind" render={({ field }) => <SingleSelect label="Database type" value={field.value} onChange={(next) => { field.onChange(next); const defaults = modelDefaultsByKind[next]; setValue('port', defaults.port); setValue('schemaName', defaults.schemaName); }} options={kindOptions}/>}/>
    <FormField label="Name" {...register('name')} error={errors.name?.message}/>
    <div className="form-grid-2"><FormField label="Host" {...register('host')} error={errors.host?.message}/><FormField label="Port" type="number" {...register('port')} error={errors.port?.message}/></div>
    <FormField label="Database" {...register('database')} error={errors.database?.message}/>
    {kind !== 'mysql' ? <FormField label="Schema" {...register('schemaName')} error={errors.schemaName?.message}/> : null}
    <div className="form-grid-2"><FormField label="Username" autoComplete="username" {...register('username')} error={errors.username?.message}/><Controller control={control} name="password" render={({ field }) => <SecretField label="Password" {...field} autoComplete="new-password" error={errors.password?.message}/>}/></div>
    {kind === 'postgres' ? <Controller control={control} name="sslMode" render={({ field }) => <SingleSelect label="SSL mode" value={field.value ?? 'prefer'} onChange={field.onChange} options={sslModeOptions}/>}/> : null}
    {kind === 'mysql' ? <Controller control={control} name="ssl" render={({ field }) => <BooleanSwitch label="Use SSL" value={field.value} onChange={field.onChange}/>}/> : null}
    {kind === 'mssql' ? <><Controller control={control} name="encrypt" render={({ field }) => <BooleanSwitch label="Encrypt connection" value={field.value} onChange={field.onChange}/>}/><Controller control={control} name="trustServerCertificate" render={({ field }) => <BooleanSwitch label="Trust server certificate" value={field.value} onChange={field.onChange}/>}/><FormField label="ODBC driver" {...register('odbcDriver')} error={errors.odbcDriver?.message}/></> : null}
    {errors.root?.message ? <div className="inline-error" role="alert">{errors.root.message}</div> : null}
    <div className="form-actions"><Button type="submit" variant="primary" isPending={isSubmitting}>Save data source</Button></div>
  </form>;
}
function BooleanSwitch({ label, value, onChange }: {
    label: string;
    value: boolean;
    onChange(value: boolean): void;
}) {
    return <Switch isSelected={value} onChange={onChange}><Switch.Control><Switch.Thumb /></Switch.Control><Switch.Content><Label>{label}</Label></Switch.Content></Switch>;
}
