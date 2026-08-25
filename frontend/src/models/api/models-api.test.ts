import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { authSession } from '../../auth/session-storage';
import { server } from '../../test/server';
import { setApiOrganizationId } from '../../organizations/organization-store';
import { setDefaultProfile, testConnection } from './models-api';
beforeEach(() => { authSession.write({ access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 900 }); setApiOrganizationId('org-1'); });
describe('model API behavior', () => { it('tests a connection synchronously and includes organization/auth headers', async () => { server.use(http.post('http://localhost:8000/api/v1/models/connections/c1/test', ({ request }) => { expect(request.headers.get('authorization')).toBe('Bearer a'); expect(request.headers.get('x-organization-id')).toBe('org-1'); return HttpResponse.json({ ok: true, model_count: 2, sample_models: ['a', 'b'], tested_at: '2026-08-24T12:00:00Z' }); })); expect((await testConnection('c1')).model_count).toBe(2); }); it('uses the dedicated default-profile endpoint', async () => { server.use(http.post('http://localhost:8000/api/v1/models/profiles/p1/default', () => HttpResponse.json({ id: 'p1', organization_id: 'org-1', connection_id: 'c1', display_name: 'Default', model_name: 'model-a', settings: {}, is_default: true, enabled: true, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' }))); expect((await setDefaultProfile('p1')).is_default).toBe(true); }); });
