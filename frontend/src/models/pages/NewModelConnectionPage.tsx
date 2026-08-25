import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../auth/components/FormField';
import { SecretField } from '../../components/SecretField';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/models-api';
import { modelConnectionSchema, type ModelConnectionValues } from '../schemas/model-schemas';
export function NewModelConnectionPage() { const navigate = useNavigate(); const qc = useQueryClient(); const { activeOrganization } = useOrganization(); const orgId = activeOrganization?.id ?? null; const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ModelConnectionValues>({ resolver: zodResolver(modelConnectionSchema), defaultValues: { name: '', baseUrl: 'https://api.openai.com/v1', apiKey: '' } }); if (activeOrganization?.role !== 'owner' && activeOrganization?.role !== 'admin')
    return <section className="page"><div className="inline-error">Only owners and admins can configure model connections.</div></section>; const submit = handleSubmit(async (v) => { try {
    const c = await api.createConnection({ name: v.name, base_url: v.baseUrl, api_key: v.apiKey || null });
    await qc.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
    navigate(`/models/connections/${c.id}`);
}
catch (e) {
    setError('root', { message: (e as AppError).message });
} }); return <section className="page"><div className="page-header"><div><h1>Add model connection</h1><p>Saved API keys are never returned by the backend.</p></div></div><form className="form-stack form-width form-panel" onSubmit={submit}><FormField label="Name" {...register('name')} error={errors.name?.message}/><FormField label="Base URL" {...register('baseUrl')} error={errors.baseUrl?.message}/><Controller control={control} name="apiKey" render={({ field }) => <SecretField label="API key (optional)" {...field} autoComplete="new-password" error={errors.apiKey?.message}/>}/>{errors.root?.message ? <div className="inline-error">{errors.root.message}</div> : null}<div className="form-actions"><Button type="submit" variant="primary" isPending={isSubmitting}>Save connection</Button></div></form></section>; }
