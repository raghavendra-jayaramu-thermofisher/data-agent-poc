import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { authSession } from '../../auth/session-storage';
import { setApiOrganizationId } from '../../organizations/organization-store';
import { server } from '../../test/server';
import { getOperationalStatus, listAuditLogs, updateOrganization } from './settings-api';

beforeEach(() => {
  authSession.write({ access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 900 });
  setApiOrganizationId('org-1');
});

describe('settings API', () => {
  it('updates organization metadata with auth and organization scope', async () => {
    server.use(http.patch('http://localhost:8000/api/v1/organizations/org-1', async ({ request }) => {
      expect(request.headers.get('authorization')).toBe('Bearer a');
      expect(request.headers.get('x-organization-id')).toBe('org-1');
      expect(await request.json()).toEqual({ name: 'Acme Analytics' });
      return HttpResponse.json({ id: 'org-1', name: 'Acme Analytics', slug: 'acme', created_by: 'u1', role: 'owner', created_at: '2026-08-24T00:00:00Z', updated_at: '2026-08-25T00:00:00Z' });
    }));
    expect((await updateOrganization('org-1', { name: 'Acme Analytics' })).name).toBe('Acme Analytics');
  });

  it('reads admin audit and operational status without exposing transport differences', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/audit', ({ request }) => {
        expect(new URL(request.url).searchParams.get('limit')).toBe('100');
        return HttpResponse.json([{ id: 1, organization_id: 'org-1', user_id: 'u1', action: 'dashboard.updated', resource_type: 'dashboard', resource_id: 'd1', metadata: {}, created_at: '2026-08-25T00:00:00Z' }]);
      }),
      http.get('http://localhost:8000/api/v1/ops/status', () => HttpResponse.json({ api: 'ok', workers: { active: 1 } })),
    );
    expect((await listAuditLogs()).length).toBe(1);
    expect((await getOperationalStatus()).api).toBe('ok');
  });
});
