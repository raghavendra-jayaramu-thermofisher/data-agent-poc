import { apiClient, unwrapApi, withAuthRefresh } from '../api/client';
import type { ForgotPasswordValues, LoginValues, ResetPasswordValues, SignupValues, } from './schemas/auth-schemas';
export function login(values: LoginValues) {
    return unwrapApi(() => apiClient.POST('/api/v1/auth/login', { body: values }));
}
export function signup(values: SignupValues) {
    return unwrapApi(() => apiClient.POST('/api/v1/auth/signup', {
        body: {
            email: values.email,
            password: values.password,
            display_name: values.displayName || null,
            organization_name: values.organizationName || null,
        },
    }));
}
export function forgotPassword(values: ForgotPasswordValues) {
    return unwrapApi(() => apiClient.POST('/api/v1/auth/forgot-password', { body: { email: values.email } }));
}
export function resetPassword(values: ResetPasswordValues) {
    return unwrapApi(() => apiClient.POST('/api/v1/auth/reset-password', {
        body: { token: values.token, new_password: values.newPassword },
    }));
}
export function getCurrentUser() {
    return withAuthRefresh(() => apiClient.GET('/api/v1/auth/me'));
}
export function logout(refreshToken: string) {
    return unwrapApi(() => apiClient.POST('/api/v1/auth/logout', { body: { refresh_token: refreshToken } }));
}
