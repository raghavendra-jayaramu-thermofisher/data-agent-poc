import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label, TextArea, TextField } from '@heroui/react';
import { useForm } from 'react-hook-form';
import { messageSchema, type MessageFormValues } from '../schemas/conversation-schemas';

export function FollowUpComposer({ onSubmit, disabled }: { onSubmit(values: MessageFormValues): Promise<void>; disabled?: boolean }) {
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<MessageFormValues>({ resolver: zodResolver(messageSchema), defaultValues: { question: '' } });
  const submit = handleSubmit(async (values) => {
    try { await onSubmit(values); reset(); }
    catch (error) { setError('root', { message: error instanceof Error ? error.message : 'Unable to submit the question.' }); }
  });
  return <form className="follow-up-composer" onSubmit={submit}>
    <TextField isInvalid={Boolean(errors.question)}>
      <Label>Ask a follow-up</Label>
      <TextArea rows={2} fullWidth variant="secondary" placeholder="Ask about this analysis…" {...register('question')}/>
      {errors.question?.message ? <p className="field-error" role="alert">{errors.question.message}</p> : null}
    </TextField>
    {errors.root?.message ? <div className="inline-error" role="alert">{errors.root.message}</div> : null}
    <div className="composer-actions"><span>The conversation keeps its existing data-source scope and analytical history.</span><Button type="submit" variant="primary" isPending={isSubmitting} isDisabled={disabled || isSubmitting}>Ask</Button></div>
  </form>;
}
