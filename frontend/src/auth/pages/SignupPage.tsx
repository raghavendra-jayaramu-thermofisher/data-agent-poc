import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../AuthProvider';
import { signupSchema, type SignupValues } from '../schemas/auth-schemas';
import { AuthFrame } from '../components/AuthFrame';
import { FormField } from '../components/FormField';
import { SecretField } from '../../components/SecretField';
import type { AppError } from '../../api/errors';
export function SignupPage() {
    const { signUp, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<SignupValues>({ resolver: zodResolver(signupSchema), defaultValues: { email: '', password: '', displayName: '', organizationName: '' } });
    if (isAuthenticated)
        return <Navigate to="/ask" replace/>;
    const submit = handleSubmit(async (values) => {
        try {
            await signUp(values);
            navigate('/ask', { replace: true });
        }
        catch (e) {
            const err = e as AppError;
            if (err.fieldErrors)
                Object.entries(err.fieldErrors).forEach(([name, message]) => setError(name === 'display_name' ? 'displayName' : name === 'organization_name' ? 'organizationName' : name as keyof SignupValues, { message }));
            else
                setError('root', { message: err.message });
        }
    });
    return <AuthFrame title="Create your workspace" subtitle="Set up your account and first organization." footer={<>Already have an account? <Link to="/login">Sign in</Link></>}><form className="auth-form" onSubmit={submit} noValidate><FormField label="Work email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message}/><FormField label="Your name" autoComplete="name" {...register('displayName')} error={errors.displayName?.message}/><FormField label="Organization name" autoComplete="organization" {...register('organizationName')} error={errors.organizationName?.message}/><Controller control={control} name="password" render={({ field }) => <SecretField label="Password" {...field} autoComplete="new-password" error={errors.password?.message}/>}/><p className="form-hint">At least 10 characters with uppercase, lowercase, and a number.</p>{errors.root?.message ? <div className="inline-error" role="alert">{errors.root.message}</div> : null}<Button type="submit" fullWidth isPending={isSubmitting}>Create account</Button></form></AuthFrame>;
}
