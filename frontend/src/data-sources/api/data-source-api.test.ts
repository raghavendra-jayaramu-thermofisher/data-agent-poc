import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { authSession } from '../../auth/session-storage';
import { setApiOrganizationId } from '../../organizations/organization-store';
import { server } from '../../test/server';
import { createExcelDataSource, testDataSource } from './data-source-api';

// Resolve fetch after the test interceptor is installed.
vi.mock('openapi-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openapi-fetch')>();
  return {
    ...actual,
    default: (options: Parameters<typeof actual.default>[0]) =>
      actual.default({
        ...options,
        fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
      }),
  };
});
beforeEach(() => {
  authSession.write({
    access_token: 'a',
    refresh_token: 'r',
    token_type: 'bearer',
    expires_in: 900,
  });
  setApiOrganizationId('org-1');
});
describe('datasource job APIs', () => {
  it('submits an Excel workbook as multipart and returns its durable job', async () => {
    // Inspect the browser FormData before crossing JSDOM/Node fetch realms.
    // The browser workflow also verifies its multipart wire representation.
    const accepted = { job_id: 'job-excel', data_source: { id: 'ds1' } };
    const post = vi
      .spyOn(apiClient, 'POST')
      .mockResolvedValueOnce({ data: accepted, response: new Response(null, { status: 202 }) });
    try {
      const file = new File(['xlsx'], 'orders.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect((await createExcelDataSource('Orders', file)).job_id).toBe('job-excel');
      const [path, options] = post.mock.calls[0] as unknown as [
        string,
        { bodySerializer: () => FormData },
      ];
      expect(path).toBe('/api/v1/data-sources/excel');
      const serialize = options?.bodySerializer as () => FormData;
      const form = serialize();
      expect(form).toBeInstanceOf(FormData);
      expect(form.get('name')).toBe('Orders');
      expect((form.get('file') as File).name).toBe('orders.xlsx');
    } finally {
      post.mockRestore();
    }
  });
  it('treats datasource testing as an asynchronous job', async () => {
    server.use(
      http.post('http://localhost:12201/api/v1/data-sources/ds1/test', () =>
        HttpResponse.json({ job_id: 'job-test' }, { status: 202 }),
      ),
    );
    expect((await testDataSource('ds1')).job_id).toBe('job-test');
  });
});
