import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import type { AppError } from '../../api/errors';
import { SecretField } from '../../components/SecretField';
import { resetPassword } from '../auth-api';
import { AuthFrame } from '../components/AuthFrame';
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas/auth-schemas';
export function ResetPasswordPage() {
    const [params] = useSearchParams();
    const [done, setDone] = useState(false);
    const { control, handleSubmit, reset, setError, formState: { errors, isSubmitting }, } = useForm<ResetPasswordValues>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { token: params.get('token') ?? '', newPassword: '' },
    });
    const submit = handleSubmit(async (values) => {
        try {
            await resetPassword(values);
            reset({ token: '', newPassword: '' });
            setDone(true);
        }
        catch (error) {
            setError('root', { message: (error as AppError).message });
        }
    });
    return (<AuthFrame title="Choose a new password" subtitle="Use a strong password you don’t reuse elsewhere." footer={<Link to="/login">Back to sign in</Link>}>
      {done ? (<div className="success-state">
          <h2>Password updated</h2>
          <p>You can now sign in with your new password.</p>
        </div>) : (<form className="auth-form" onSubmit={submit} noValidate>
          <Controller control={control} name="newPassword" render={({ field }) => (<SecretField label="New password" {...field} autoComplete="new-password" error={errors.newPassword?.message}/>)}/>
          {errors.token?.message ? (<div className="inline-error" role="alert">
              {errors.token.message}
            </div>) : null}
          {errors.root?.message ? (<div className="inline-error" role="alert">
              {errors.root.message}
            </div>) : null}
          <Button type="submit" fullWidth isPending={isSubmitting}>
            Update password
          </Button>
        </form>)}
    </AuthFrame>);
}
