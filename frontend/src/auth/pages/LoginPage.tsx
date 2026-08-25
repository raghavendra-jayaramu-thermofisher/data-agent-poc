import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../AuthProvider';
import { loginSchema, type LoginValues } from '../schemas/auth-schemas';
import { AuthFrame } from '../components/AuthFrame';
import { FormField } from '../components/FormField';
import { SecretField } from '../../components/SecretField';
import type { AppError } from '../../api/errors';
export function LoginPage() {
    const { signIn, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
    if (isAuthenticated)
        return <Navigate to="/ask" replace/>;
    const submit = handleSubmit(async (values) => {
        try {
            await signIn(values);
            const from = (location.state as {
                from?: string;
            } | null)?.from ?? '/ask';
            navigate(from, { replace: true });
        }
        catch (e) {
            const err = e as AppError;
            if (err.fieldErrors)
                Object.entries(err.fieldErrors).forEach(([name, message]) => setError(name as keyof LoginValues, { message }));
            else
                setError('root', { message: err.message });
        }
    });
    return <AuthFrame title="Sign in" subtitle="Continue to your analytical workspace." footer={<>New to DB Assistant? <Link to="/signup">Create an account</Link></>}><form className="auth-form" onSubmit={submit} noValidate><FormField label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message}/><Controller control={control} name="password" render={({ field }) => <SecretField label="Password" {...field} autoComplete="current-password" error={errors.password?.message}/>}/>{errors.root?.message ? <div className="inline-error" role="alert">{errors.root.message}</div> : null}<div className="form-row-between"><Link to="/forgot-password">Forgot password?</Link></div><Button type="submit" fullWidth isPending={isSubmitting}>Sign in</Button></form></AuthFrame>;
}
