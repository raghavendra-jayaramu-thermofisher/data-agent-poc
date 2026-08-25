import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label, TextArea, TextField } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import type { AppError } from '../../api/errors';
import { FormField } from '../../auth/components/FormField';
import { SingleSelect } from '../../components/SingleSelect';
import { annotationSchema, type AnnotationValues } from '../schemas/annotation-schema';
const scopes = [{ value: 'datasource', label: 'Datasource' }, { value: 'table', label: 'Table' }, { value: 'column', label: 'Column' }, { value: 'metric', label: 'Metric' }] as const;
export function AnnotationForm({ onSubmit }: {
    onSubmit(values: AnnotationValues): Promise<void>;
}) { const { register, control, watch, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<AnnotationValues>({ resolver: zodResolver(annotationSchema), defaultValues: { scopeType: 'datasource', scopeKey: '', content: '' } }); const scope = watch('scopeType'); const submit = handleSubmit(async (values) => { try {
    await onSubmit(values);
    reset({ scopeType: 'datasource', scopeKey: '', content: '' });
}
catch (e) {
    setError('root', { message: (e as AppError).message ?? 'Unable to save annotation.' });
} }); return <form className="form-stack annotation-form" onSubmit={submit}><Controller control={control} name="scopeType" render={({ field }) => <SingleSelect label="Scope" value={field.value} onChange={field.onChange} options={scopes}/>}/>{scope !== 'datasource' ? <FormField label={scope === 'metric' ? 'Metric key' : scope === 'column' ? 'Column key' : 'Table key'} {...register('scopeKey')} error={errors.scopeKey?.message}/> : null}<TextField isInvalid={Boolean(errors.content)}><Label>Business knowledge</Label><TextArea rows={4} fullWidth variant="secondary" {...register('content')}/>{errors.content?.message ? <p className="field-error">{errors.content.message}</p> : null}</TextField>{errors.root?.message ? <div className="inline-error">{errors.root.message}</div> : null}<div className="form-actions"><Button type="submit" variant="primary" isPending={isSubmitting}>Add knowledge</Button></div></form>; }
