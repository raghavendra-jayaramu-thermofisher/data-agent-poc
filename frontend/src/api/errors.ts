export type AppError = {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
    requestId?: string;
};
type BackendError = {
    error?: {
        code?: string;
        message?: string;
        field_errors?: Record<string, string>;
        request_id?: string;
    };
};
export function normalizeApiError(error: unknown, response?: Response): AppError {
    const payload = error as BackendError | undefined;
    const backend = payload?.error;
    const requestId = backend?.request_id ?? response?.headers.get('x-request-id') ?? undefined;
    if (backend?.message) {
        return {
            code: backend.code ?? 'REQUEST_FAILED',
            message: backend.message,
            ...(backend.field_errors ? { fieldErrors: backend.field_errors } : {}),
            ...(requestId ? { requestId } : {}),
        };
    }
    if (!response) {
        return {
            code: 'NETWORK_ERROR',
            message: 'Unable to reach the server. Check your connection and try again.',
        };
    }
    return {
        code: response.status === 401 ? 'UNAUTHORIZED' : 'REQUEST_FAILED',
        message: response.status === 401
            ? 'Your session is no longer valid.'
            : 'Something went wrong. Please try again.',
        ...(requestId ? { requestId } : {}),
    };
}
