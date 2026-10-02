import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { authSession } from '../../auth/session-storage';
import { setApiOrganizationId } from '../../organizations/organization-store';
import { server } from '../../test/server';
import { addWidget, createDashboard, refreshDashboard, refreshWidget } from './dashboard-api';

beforeEach(() => {
  authSession.write({ access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 900 });
  setApiOrganizationId('org-1');
});

describe('dashboard API', () => {
  it('creates dashboards with workspace/auth headers', async () => {
    server.use(http.post('http://localhost:12201/api/v1/dashboards', async ({ request }) => {
      expect(request.headers.get('authorization')).toBe('Bearer a');
      expect(request.headers.get('x-organization-id')).toBe('org-1');
      expect(await request.json()).toEqual({ title: 'Executive metrics', description: null });
      return HttpResponse.json({ id: 'd1', organization_id: 'org-1', title: 'Executive metrics', description: null, created_by: 'u1', widget_count: 0, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' }, { status: 201 });
    }));
    expect((await createDashboard({ title: 'Executive metrics', description: null })).id).toBe('d1');
  });

  it('creates provenance-linked widgets and starts both refresh job types', async () => {
    server.use(
      http.post('http://localhost:12201/api/v1/dashboards/d1/widgets', async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        expect(body.source_job_id).toBe('j1'); expect(body.source_sql_execution_id).toBe('s1');
        return HttpResponse.json({ id: 'w1' }, { status: 201 });
      }),
      http.post('http://localhost:12201/api/v1/dashboards/widgets/w1/refresh', () => HttpResponse.json({ job_id: 'jr1' }, { status: 202 })),
      http.post('http://localhost:12201/api/v1/dashboards/d1/refresh', () => HttpResponse.json({ job_id: 'jr2' }, { status: 202 })),
    );
    await addWidget('d1', { source_job_id: 'j1', source_sql_execution_id: 's1', widget_type: 'table', visualization_config: {}, layout_config: {} });
    expect((await refreshWidget('w1')).job_id).toBe('jr1');
    expect((await refreshDashboard('d1')).job_id).toBe('jr2');
  });
});
