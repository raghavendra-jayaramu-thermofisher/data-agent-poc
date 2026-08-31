import createClient, { type Middleware } from 'openapi-fetch';
import { authSession } from '../auth/session-storage';
import { getApiOrganizationId } from '../organizations/organization-store';
import { normalizeApiError, type AppError } from './errors';
import type { components, paths } from './generated/schema';
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = configuredApiBaseUrl
    || (import.meta.env.PROD ? window.location.origin : 'http://localhost:8000');
const baseUrl = API_BASE_URL;
export const apiClient = createClient<paths>({ baseUrl });
const headersMiddleware: Middleware = {
    onRequest({ request }) {
        const tokens = authSession.read();
        if (tokens?.access_token) {
            request.headers.set('Authorization', `Bearer ${tokens.access_token}`);
        }
        const organizationId = getApiOrganizationId();
        if (organizationId) {
            request.headers.set('X-Organization-ID', organizationId);
        }
        request.headers.set('Accept', 'application/json');
        return request;
    },
};
apiClient.use(headersMiddleware);
let refreshPromise: Promise<boolean> | null = null;
async function performRefresh(): Promise<boolean> {
    const current = authSession.read();
    if (!current?.refresh_token)
        return false;
    const refreshClient = createClient<paths>({ baseUrl });
    try {
        const { data } = await refreshClient.POST('/api/v1/auth/refresh', { body: { refresh_token: current.refresh_token } });
        if (!data)
            return false;
        authSession.write(data);
        return true;
    }
    catch {
        return false;
    }
}
/** Shares one refresh-token rotation across normal HTTP requests and authenticated SSE. */
export function refreshAuthTokens(): Promise<boolean> {
    refreshPromise ??= performRefresh().finally(() => { refreshPromise = null; });
    return refreshPromise;
}
type ApiResult<T> = {
    data?: T;
    error?: unknown;
    response: Response;
};
async function execute<T>(request: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
    try {
        return await request();
    }
    catch (error) {
        throw normalizeApiError(error);
    }
}
/**
 * Runs an authenticated request with one serialized refresh-token rotation.
 * A request that observes a token already rotated by another request retries with
 * that new access token instead of attempting to reuse the old refresh token.
 */
export async function withAuthRefresh<T>(request: () => Promise<ApiResult<T>>): Promise<T> {
    const accessTokenAtStart = authSession.read()?.access_token;
    let result = await execute(request);
    if (result.response.status === 401) {
        const current = authSession.read();
        if (current?.access_token && current.access_token !== accessTokenAtStart) {
            result = await execute(request);
        }
        else if (current?.refresh_token) {
            if (await refreshAuthTokens()) {
                result = await execute(request);
            }
        }
    }
    if (result.response.ok)
        return result.data as T;
    if (result.response.status === 401) {
        authSession.clear();
    }
    throw normalizeApiError(result.error, result.response);
}
/** Public/non-refreshing request helper with the same normalized error contract. */
export async function unwrapApi<T>(request: () => Promise<ApiResult<T>>): Promise<T> {
    const result = await execute(request);
    if (result.response.ok)
        return result.data as T;
    throw normalizeApiError(result.error, result.response);
}
export function getAuthenticatedHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    const tokens = authSession.read();
    if (tokens?.access_token)
        headers.set('Authorization', `Bearer ${tokens.access_token}`);
    const organizationId = getApiOrganizationId();
    if (organizationId)
        headers.set('X-Organization-ID', organizationId);
    return headers;
}
export function getAuthenticatedHeaderRecord(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    const tokens = authSession.read();
    if (tokens?.access_token)
        headers['Authorization'] = `Bearer ${tokens.access_token}`;
    const organizationId = getApiOrganizationId();
    if (organizationId)
        headers['X-Organization-ID'] = organizationId;
    return headers;
}
export type User = components['schemas']['UserResponse'];
export type Organization = components['schemas']['OrganizationResponse'];
export type { AppError };
