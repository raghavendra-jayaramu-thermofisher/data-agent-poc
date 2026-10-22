import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from '../../auth/session-storage';
import { setApiOrganizationId } from '../../organizations/organization-store';
import { server } from '../../test/server';
import { parseTableArtifact } from '../../agent/lib/artifacts';
import type { JobArtifact } from '../../agent/api/execution-api';
import { AnalyticalTable } from './AnalyticalTable';

// Resolve fetch after MSW starts instead of capturing the original fetch during imports.
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
vi.mock('../../organizations/OrganizationProvider', () => ({
  useOrganization: () => ({ activeOrganization: { id: 'org-1', role: 'owner' } }),
}));
const saved = vi.hoisted(() => ({ workbook: vi.fn() }));
vi.mock('./excel-export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./excel-export')>()),
  saveWorkbook: saved.workbook,
}));

const ROWS_URL = 'http://localhost:12201/api/v1/jobs/j1/artifacts/a1/rows';
const columns = ['reference', 'amount'];
const row = (index: number) => [`REF-${index}`, index];
const range = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, index) => row(start + index));

function artifact(): JobArtifact {
  return {
    id: 'a1',
    job_id: 'j1',
    kind: 'table',
    name: 'Open lines',
    source_sql_execution_id: null,
    created_at: '2026-10-20T00:00:00Z',
    payload: { schema_version: 1, columns, rows: range(0, 200), row_count: 450 },
    table_rows: { stored_row_count: 450, next_cursor: 'after-200', has_more: true },
  };
}

function renderTable() {
  const model = parseTableArtifact(artifact())!;
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AnalyticalTable model={model} label="Open lines" />
    </QueryClientProvider>,
  );
}

function bodyRows() {
  return within(screen.getByRole('table', { name: 'Open lines' }))
    .getAllByRole('row')
    .filter(
      (element) => element.closest('tbody') && !element.classList.contains('analytical-table-more'),
    );
}

beforeEach(() => {
  authSession.write({
    access_token: 'a',
    refresh_token: 'r',
    token_type: 'bearer',
    expires_in: 900,
  });
  setApiOrganizationId('org-1');
  saved.workbook.mockClear();
});

describe('AnalyticalTable with server-paged rows', () => {
  it('keeps small tables in the browser without a paging request', () => {
    const small = {
      ...artifact(),
      table_rows: { stored_row_count: 3, next_cursor: null, has_more: false },
    };
    expect(parseTableArtifact(small)?.paging).toBeUndefined();
    expect(parseTableArtifact(artifact())?.paging).toEqual({
      jobId: 'j1',
      artifactId: 'a1',
      storedRowCount: 450,
      nextCursor: 'after-200',
    });
  });

  it('starts from the trace rows and loads the next page on demand', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(ROWS_URL, ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        return HttpResponse.json({
          columns,
          rows: range(200, 400),
          matching_count: 450,
          next_cursor: 'after-400',
          has_more: true,
        });
      }),
    );
    renderTable();

    expect(screen.getByRole('table', { name: 'Open lines' })).toHaveAttribute(
      'aria-rowcount',
      '451',
    );
    expect(requests).toHaveLength(0);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.get('cursor')).toBe('after-200');
    expect(requests[0]!.has('sort')).toBe(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled());
  });

  it('asks the server to sort every stored row instead of sorting the loaded page', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(ROWS_URL, ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          columns,
          rows: [row(449), row(448)],
          matching_count: 450,
          next_cursor: null,
          has_more: false,
        });
      }),
    );
    renderTable();

    await userEvent.setup().click(screen.getByRole('button', { name: /Amount/ }));

    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent('REF-449'));
    expect(requests[0]!.get('sort')).toBe('amount');
    expect(requests[0]!.get('descending')).toBe('true');
    expect(requests[0]!.has('cursor')).toBe(false);
  });

  it('exports and copies every stored row in the current view', async () => {
    let exported: unknown;
    const cursors: (string | null)[] = [];
    server.use(
      http.post(
        'http://localhost:12201/api/v1/jobs/j1/artifacts/a1/table/excel',
        async ({ request }) => {
          exported = await request.json();
          return new HttpResponse(new Blob(['workbook']));
        },
      ),
      http.get(ROWS_URL, ({ request }) => {
        const params = new URL(request.url).searchParams;
        cursors.push(params.get('cursor'));
        expect(params.get('limit')).toBe('1000');
        const last = params.get('cursor') === 'next';
        return HttpResponse.json({
          columns,
          rows: last ? range(1000, 1001) : range(0, 1000),
          matching_count: 1001,
          next_cursor: last ? null : 'next',
          has_more: !last,
        });
      }),
    );
    renderTable();
    const user = userEvent.setup();
    // user-event installs its own clipboard; replace it after setup.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    await user.click(screen.getByRole('button', { name: 'Export to Excel' }));
    await waitFor(() => expect(saved.workbook).toHaveBeenCalledOnce());
    expect(exported).toEqual({
      title: 'Open lines',
      headers: ['Reference', 'Amount'],
      sort: null,
      descending: false,
      search: '',
    });

    await user.click(screen.getByRole('button', { name: 'Copy table' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(cursors).toEqual([null, 'next']);
    expect(writeText.mock.calls[0]![0].split('\n')).toHaveLength(1002);
  });
});
