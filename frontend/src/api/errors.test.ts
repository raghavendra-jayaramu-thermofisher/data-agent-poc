import { describe, expect, it } from 'vitest';
import { normalizeApiError } from './errors';
describe('normalizeApiError', () => { it('maps backend field errors and request id', () => expect(normalizeApiError({ error: { code: 'VALIDATION_ERROR', message: 'Invalid', field_errors: { email: 'Bad email' } } }, new Response(null, { status: 422, headers: { 'x-request-id': 'req-1' } }))).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid', fieldErrors: { email: 'Bad email' }, requestId: 'req-1' })); });
