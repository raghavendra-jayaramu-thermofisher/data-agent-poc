import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { AuthFrame } from '../components/AuthFrame';
import { FormField } from '../components/FormField';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas/auth-schemas';
import { forgotPassword } from '../auth-api';
import type { AppError } from '../../api/errors';
export function ForgotPasswordPage() {
    const [sent, setSent] = useState(false);
    const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
    const submit = handleSubmit(async (values) => {
        try {
            await forgotPassword(values);
            setSent(true);
        }
        catch (e) {
            setError('root', { message: (e as AppError).message });
        }
    });
    return <AuthFrame title="Reset your password" subtitle="We’ll send reset instructions if an account exists." footer={<Link to="/login">Back to sign in</Link>}>{sent ? <div className="success-state"><h2>Check your email</h2><p>If an account exists, password reset instructions have been sent.</p></div> : <form className="auth-form" onSubmit={submit} noValidate><FormField label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message}/>{errors.root?.message ? <div className="inline-error" role="alert">{errors.root.message}</div> : null}<Button type="submit" fullWidth isPending={isSubmitting}>Send reset instructions</Button></form>}</AuthFrame>;
}
