import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ProtectedRoute } from '../app/route-guards/ProtectedRoute';
import { OrganizationProvider, useOrganization } from '../organizations/OrganizationProvider';
import { authSession } from './session-storage';
import { server } from '../test/server';
const base = 'http://localhost:12201';
const tokens = { access_token: 'access-1', refresh_token: 'r'.repeat(32), token_type: 'bearer', expires_in: 900 };
const user = { id: 'user-1', email: 'user@example.com', display_name: 'Alex', is_active: true, email_verified_at: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const org = { id: 'org-1', name: 'Acme', slug: 'acme', created_by: 'user-1', created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z', role: 'owner' };
function wrapper(ui: ReactNode, initial = '/login') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrganizationProvider>
          <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
        </OrganizationProvider>
      </AuthProvider>
    </QueryClientProvider>);
}
function authenticatedHandlers() {
    server.use(http.get(`${base}/api/v1/auth/me`, () => HttpResponse.json(user)), http.get(`${base}/api/v1/organizations`, () => HttpResponse.json([org])));
}
describe('authentication flow', () => {
    it('shows client validation without making a login request', async () => {
        const userEventApi = userEvent.setup();
        wrapper(<LoginPage />);
        await userEventApi.type(screen.getByLabelText('Email'), 'not-an-email');
        await userEventApi.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    });
    it('renders sanitized invalid-login UX', async () => {
        server.use(http.post(`${base}/api/v1/auth/login`, () => HttpResponse.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } }, { status: 401 })));
        const userEventApi = userEvent.setup();
        wrapper(<LoginPage />);
        await userEventApi.type(screen.getByLabelText('Email'), 'user@example.com');
        await userEventApi.type(screen.getByLabelText('Password'), 'WrongPassword123');
        await userEventApi.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
        expect(authSession.read()).toBeNull();
    });
    it('logs in, restores current user, and reaches the protected route', async () => {
        server.use(http.post(`${base}/api/v1/auth/login`, () => HttpResponse.json(tokens)));
        authenticatedHandlers();
        const userEventApi = userEvent.setup();
        wrapper(<Routes><Route path="/login" element={<LoginPage />}/><Route path="/ask" element={<div>Protected Ask</div>}/></Routes>);
        await userEventApi.type(screen.getByLabelText('Email'), 'user@example.com');
        await userEventApi.type(screen.getByLabelText('Password'), 'StrongPass123');
        await userEventApi.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(await screen.findByText('Protected Ask')).toBeInTheDocument();
        expect(authSession.read()?.refresh_token).toBe(tokens.refresh_token);
        expect(localStorage.getItem('db-assistant.preferences.v1') ?? '').not.toContain('StrongPass123');
    });
    it('signs up with backend-compatible fields', async () => {
        let requestBody: unknown;
        server.use(http.post(`${base}/api/v1/auth/signup`, async ({ request }) => { requestBody = await request.json(); return HttpResponse.json(tokens, { status: 201 }); }), http.get(`${base}/api/v1/auth/me`, () => HttpResponse.json(user)), http.get(`${base}/api/v1/organizations`, () => HttpResponse.json([org])));
        const userEventApi = userEvent.setup();
        wrapper(<Routes><Route path="/signup" element={<SignupPage />}/><Route path="/ask" element={<div>Ask after signup</div>}/></Routes>, '/signup');
        await userEventApi.type(screen.getByLabelText('Work email'), 'user@example.com');
        await userEventApi.type(screen.getByLabelText('Your name'), 'Alex');
        await userEventApi.type(screen.getByLabelText('Organization name'), 'Acme');
        await userEventApi.type(screen.getByLabelText('Password'), 'StrongPass123');
        await userEventApi.click(screen.getByRole('button', { name: 'Create account' }));
        expect(await screen.findByText('Ask after signup')).toBeInTheDocument();
        expect(requestBody).toEqual({ email: 'user@example.com', password: 'StrongPass123', display_name: 'Alex', organization_name: 'Acme' });
        expect(localStorage.getItem('db-assistant.preferences.v1') ?? '').not.toContain('StrongPass123');
    });
    it('restores a session and organization context after reload', async () => {
        authSession.write(tokens);
        authenticatedHandlers();
        function OrgProbe() { const { activeOrganization } = useOrganization(); return <div>{activeOrganization?.name ?? 'No org'}</div>; }
        wrapper(<Routes><Route element={<ProtectedRoute />}><Route path="/ask" element={<OrgProbe />}/></Route><Route path="/login" element={<div>Login</div>}/></Routes>, '/ask');
        expect(await screen.findByText('Acme')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('Login')).not.toBeInTheDocument());
    });
});
