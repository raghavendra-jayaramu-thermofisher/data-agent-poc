import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { AppError } from '../../api/errors';
import { SingleSelect } from '../../components/SingleSelect';
import { annotationSchema, type AnnotationValues } from '../schemas/annotation-schema';

const scopes = [
  { value: 'datasource', label: 'Data source' },
  { value: 'table', label: 'Table' },
  { value: 'column', label: 'Column' },
  { value: 'metric', label: 'Metric' },
] as const;
export function AnnotationForm({
  onSubmit,
  onCancel,
}: {
  onSubmit(values: AnnotationValues): Promise<void>;
  onCancel?(): void;
}) {
  const id = useId();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<AnnotationValues>({
    resolver: zodResolver(annotationSchema),
    defaultValues: { scopeType: 'datasource', scopeKey: '', content: '' },
  });
  const scope = useWatch({ control, name: 'scopeType' });
  const submit = handleSubmit(async (values) => {
    clearErrors('root');
    try {
      await onSubmit(values);
      reset({ scopeType: 'datasource', scopeKey: '', content: '' });
    } catch (error) {
      setError('root', {
        message: (error as AppError)?.message || 'Unable to add knowledge. Please try again.',
      });
    }
  });
  return (
    <form className="annotation-form" onSubmit={submit}>
      <Controller
        control={control}
        name="scopeType"
        render={({ field }) => (
          <SingleSelect
            label="Applies to"
            value={field.value}
            onChange={field.onChange}
            options={scopes}
            disabled={isSubmitting}
          />
        )}
      />
      {scope !== 'datasource' && (
        <div className="knowledge-field">
          <label htmlFor={id + '-scope'}>
            {scope === 'metric' ? 'Metric name' : scope === 'column' ? 'Column name' : 'Table name'}
          </label>
          <input
            id={id + '-scope'}
            {...register('scopeKey')}
            maxLength={600}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.scopeKey)}
            aria-describedby={errors.scopeKey ? id + '-scope-error' : undefined}
          />
          {errors.scopeKey && (
            <p className="knowledge-inline-error" id={id + '-scope-error'} role="alert">
              {errors.scopeKey.message}
            </p>
          )}
        </div>
      )}
      <div className="knowledge-field">
        <label htmlFor={id + '-instructions'}>
          Instructions <span aria-hidden="true">*</span>
        </label>
        <textarea
          id={id + '-instructions'}
          {...register('content')}
          rows={7}
          maxLength={20000}
          placeholder="Add a definition, business rule, or reporting guideline…"
          disabled={isSubmitting}
          required
          aria-invalid={Boolean(errors.content)}
          aria-describedby={errors.content ? id + '-content-error' : id + '-help'}
        />
        <p className="knowledge-field-help" id={id + '-help'}>
          Use plain text or Markdown.
        </p>
        {errors.content && (
          <p className="knowledge-inline-error" id={id + '-content-error'} role="alert">
            {errors.content.message}
          </p>
        )}
      </div>
      {errors.root && (
        <p className="knowledge-inline-error" role="alert">
          {errors.root.message}
        </p>
      )}
      <div className="knowledge-form-actions">
        {onCancel && (
          <Button type="button" variant="secondary" onPress={onCancel} isDisabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" isPending={isSubmitting}>
          Add knowledge
        </Button>
      </div>
    </form>
  );
}
