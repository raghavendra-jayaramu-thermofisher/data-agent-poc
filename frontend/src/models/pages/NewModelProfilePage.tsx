import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label, Switch } from '@heroui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../auth/components/FormField';
import { PageState } from '../../components/PageState';
import { SingleSelect } from '../../components/SingleSelect';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/models-api';
import { modelProfileSchema, parseOptionalNumberInput, type ModelProfileValues } from '../schemas/model-schemas';
export function NewModelProfilePage() { const nav = useNavigate(); const qc = useQueryClient(); const { activeOrganization } = useOrganization(); const orgId = activeOrganization?.id ?? null; const connections = useQuery({ queryKey: queryKeys.models.connections(orgId), queryFn: api.listConnections, enabled: Boolean(orgId) }); const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin'; const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ModelProfileValues>({ resolver: zodResolver(modelProfileSchema), defaultValues: { connectionId: '', displayName: '', modelName: '', enabled: true, isDefault: false, temperature: 0.2, maxTokens: 4000 } }); if (!canManage)
    return <PageState title="Permission required" description="Only workspace owners and admins can create model profiles."/>; if (connections.isLoading)
    return <PageState title="Loading model connections" loading/>; if (!connections.data?.length)
    return <PageState title="Add a model connection first"/>; const submit = handleSubmit(async (v) => { try {
    const settings: Record<string, unknown> = {};
    if (v.temperature !== undefined)
        settings.temperature = v.temperature;
    if (v.maxTokens !== undefined)
        settings.max_tokens = v.maxTokens;
    await api.createProfile({ connection_id: v.connectionId, display_name: v.displayName, model_name: v.modelName, enabled: v.enabled, is_default: v.isDefault, settings });
    await qc.invalidateQueries({ queryKey: queryKeys.models.all(orgId) });
    nav('/models');
}
catch (e) {
    setError('root', { message: (e as AppError).message });
} }); return <section className="page"><div className="page-header"><div><h1>Add model profile</h1><p>Profiles keep model choice and generation settings reusable.</p></div></div><form className="form-stack form-width form-panel" onSubmit={submit}><Controller control={control} name="connectionId" render={({ field }) => <SingleSelect label="Connection" value={field.value} onChange={field.onChange} options={connections.data.map(c => ({ value: c.id, label: c.name }))}/>}/><FormField label="Display name" {...register('displayName')} error={errors.displayName?.message}/><FormField label="Model name" {...register('modelName')} error={errors.modelName?.message}/><div className="form-grid-2"><FormField label="Temperature" type="number" step="0.1" {...register('temperature', { setValueAs: parseOptionalNumberInput })} error={errors.temperature?.message}/><FormField label="Max tokens" type="number" {...register('maxTokens', { setValueAs: parseOptionalNumberInput })} error={errors.maxTokens?.message}/></div><Controller control={control} name="enabled" render={({ field }) => <Switch isSelected={field.value} onChange={field.onChange}><Switch.Control><Switch.Thumb /></Switch.Control><Switch.Content><Label>Enabled</Label></Switch.Content></Switch>}/><Controller control={control} name="isDefault" render={({ field }) => <Switch isSelected={field.value} onChange={field.onChange}><Switch.Control><Switch.Thumb /></Switch.Control><Switch.Content><Label>Make default</Label></Switch.Content></Switch>}/>{errors.root?.message ? <div className="inline-error">{errors.root.message}</div> : null}<div className="form-actions"><Button type="submit" variant="primary" isPending={isSubmitting}>Save profile</Button></div></form></section>; }
