import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { authSession } from '../auth/session-storage';
import { server } from '../test/server';
import { apiClient, withAuthRefresh } from './client';
const base = 'http://localhost:8000';
const refreshed = {
    access_token: 'new-access',
    refresh_token: 'n'.repeat(32),
    token_type: 'bearer',
    expires_in: 900,
};
const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    display_name: 'Alex',
    is_active: true,
    email_verified_at: null,
    created_at: '2026-08-24T12:00:00Z',
    updated_at: '2026-08-24T12:00:00Z',
};
describe('API authentication recovery', () => {
    it('rotates the token pair once and retries an unauthorized request', async () => {
        authSession.write({
            access_token: 'expired-access',
            refresh_token: 'r'.repeat(32),
            token_type: 'bearer',
            expires_in: 900,
        });
        let refreshCalls = 0;
        server.use(http.get(`${base}/api/v1/auth/me`, ({ request }) => {
            if (request.headers.get('authorization') === 'Bearer new-access') {
                return HttpResponse.json(currentUser);
            }
            return HttpResponse.json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' } }, { status: 401 });
        }), http.post(`${base}/api/v1/auth/refresh`, () => {
            refreshCalls += 1;
            return HttpResponse.json(refreshed);
        }));
        const result = await withAuthRefresh(() => apiClient.GET('/api/v1/auth/me'));
        expect(result.email).toBe('user@example.com');
        expect(refreshCalls).toBe(1);
        expect(authSession.read()?.access_token).toBe('new-access');
        expect(authSession.read()?.refresh_token).toBe(refreshed.refresh_token);
    });
    it('serializes concurrent refresh rotation attempts', async () => {
        authSession.write({
            access_token: 'expired-access',
            refresh_token: 'r'.repeat(32),
            token_type: 'bearer',
            expires_in: 900,
        });
        let refreshCalls = 0;
        server.use(http.get(`${base}/api/v1/auth/me`, ({ request }) => {
            if (request.headers.get('authorization') === 'Bearer new-access') {
                return HttpResponse.json(currentUser);
            }
            return HttpResponse.json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' } }, { status: 401 });
        }), http.post(`${base}/api/v1/auth/refresh`, async () => {
            refreshCalls += 1;
            await delay(20);
            return HttpResponse.json(refreshed);
        }));
        const [first, second] = await Promise.all([
            withAuthRefresh(() => apiClient.GET('/api/v1/auth/me')),
            withAuthRefresh(() => apiClient.GET('/api/v1/auth/me')),
        ]);
        expect(first.email).toBe('user@example.com');
        expect(second.email).toBe('user@example.com');
        expect(refreshCalls).toBe(1);
    });
    it('clears unusable auth state when refresh fails', async () => {
        authSession.write({
            access_token: 'expired-access',
            refresh_token: 'r'.repeat(32),
            token_type: 'bearer',
            expires_in: 900,
        });
        server.use(http.get(`${base}/api/v1/auth/me`, () => HttpResponse.json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' } }, { status: 401 })), http.post(`${base}/api/v1/auth/refresh`, () => HttpResponse.json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Session expired.' } }, { status: 401 })));
        await expect(withAuthRefresh(() => apiClient.GET('/api/v1/auth/me'))).rejects.toMatchObject({
            code: 'AUTHENTICATION_REQUIRED',
        });
        expect(authSession.read()).toBeNull();
    });
});
