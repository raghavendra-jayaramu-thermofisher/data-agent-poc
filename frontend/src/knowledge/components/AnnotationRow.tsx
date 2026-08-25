import { Button, Label, TextArea, TextField } from '@heroui/react';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import type { components } from '../../api/generated/schema';
type Annotation = components['schemas']['KnowledgeAnnotationResponse'];
export function AnnotationRow({ annotation, onUpdate, onDelete, canManage }: {
    annotation: Annotation;
    onUpdate(content: string): Promise<void>;
    onDelete(): Promise<void>;
    canManage: boolean;
}) { const [editing, setEditing] = useState(false); const { register, handleSubmit, formState: { isSubmitting } } = useForm<{
    content: string;
}>({ defaultValues: { content: annotation.content } }); return <article className="annotation-row"><div className="annotation-heading"><div><strong>{annotation.scope_type}</strong>{annotation.scope_key ? <span className="font-mono"> {annotation.scope_key}</span> : null}</div>{canManage ? <div className="row-actions"><Button size="sm" variant="ghost" onPress={() => setEditing(v => !v)}>{editing ? 'Cancel' : 'Edit'}</Button><ConfirmationDialog triggerLabel="Delete" title="Delete business knowledge?" description="This removes the annotation from future knowledge use." confirmLabel="Delete" onConfirm={() => void onDelete()}/></div> : null}</div>{editing ? <form className="form-stack" onSubmit={handleSubmit(async (v) => { await onUpdate(v.content); setEditing(false); })}><TextField><Label>Content</Label><TextArea rows={4} fullWidth variant="secondary" {...register('content', { required: true })}/></TextField><Button type="submit" size="sm" variant="primary" isPending={isSubmitting}>Save</Button></form> : <p>{annotation.content}</p>}</article>; }
