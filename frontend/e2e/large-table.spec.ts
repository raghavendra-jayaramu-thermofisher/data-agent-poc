import { expect, test, type Page } from '@playwright/test';

type Mock = { trace: unknown; rowsRequests: URLSearchParams[] };

async function openConversation(page: Page, paged: boolean): Promise<Mock> {
  await page.setViewportSize({ width: 1440, height: 960 });
  const timestamp = '2026-10-17T00:00:00Z';
  const title = 'Open order lines';
  const artifactId = '44444444-4444-4444-8444-444444444444';
  const columns = ['reference', 'region', 'amount'];
  const rows = Array.from({ length: 10_000 }, (_, i) => [`REF-${i}`, `Region ${i % 7}`, i * 3]);
  const conversation = {
    id: 'c1',
    organization_id: 'org1',
    created_by: 'u1',
    title,
    model_profile_id: null,
    data_source_ids: [],
    table_scope: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
  const message = {
    id: 'm1',
    conversation_id: 'c1',
    role: 'assistant',
    content: `[[artifact:${artifactId}]]`,
    job_id: 'j1',
    metadata: {},
    created_at: timestamp,
  };
  const artifact = {
    id: artifactId,
    job_id: 'j1',
    kind: 'table',
    name: title,
    source_sql_execution_id: null,
    created_at: timestamp,
    payload: {
      schema_version: 1,
      columns,
      rows,
      row_count: rows.length,
      truncated: false,
      display: 'expanded',
    },
  };
  if (paged) {
    artifact.payload.rows = rows.slice(0, 200);
    Object.assign(artifact, {
      table_rows: { stored_row_count: rows.length, next_cursor: 'offset-200', has_more: true },
    });
  }
  const mock: Mock = { trace: artifact, rowsRequests: [] };
  const page1 = <T>(items: T[]) => ({ items, next_cursor: null, has_more: false });
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'db-assistant.auth.v1',
      JSON.stringify({
        access_token: 'mock',
        refresh_token: 'mock',
        token_type: 'bearer',
        expires_in: 900,
      }),
    );
  });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path.endsWith('/auth/me'))
      json = {
        id: 'u1',
        email: 'tester@example.com',
        display_name: 'Tester',
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
      };
    else if (path.endsWith('/organizations'))
      json = [
        { id: 'org1', name: 'Test', role: 'owner', created_at: timestamp, updated_at: timestamp },
      ];
    else if (path.endsWith('/conversations/c1/messages')) json = page1([message]);
    else if (path.endsWith('/conversations/c1')) json = conversation;
    else if (path.endsWith('/conversations')) json = page1([conversation]);
    else if (path.endsWith('/execution'))
      json = { tools: [], models: [], sql: [], artifacts: [artifact] };
    else if (path.endsWith('/artifacts/' + artifactId + '/rows')) {
      const params = new URL(route.request().url()).searchParams;
      mock.rowsRequests.push(params);
      const view = params.get('sort')
        ? [...rows].sort((a, b) => Number(b[2]) - Number(a[2]))
        : rows;
      const start = Number(params.get('cursor')?.replace('offset-', '') ?? 0);
      const end = Math.min(view.length, start + Number(params.get('limit') ?? 200));
      json = {
        columns,
        rows: view.slice(start, end),
        matching_count: view.length,
        next_cursor: end < view.length ? `offset-${end}` : null,
        has_more: end < view.length,
      };
    }
    await route.fulfill({ json });
  });

  await page.goto('/conversations/c1');
  return mock;
}

test('a 10,000-row result table renders only the visible rows and scrolls to the end', async ({
  page,
}) => {
  await openConversation(page, false);
  const title = 'Open order lines';
  const table = page.locator('.table-artifact').getByRole('table', { name: title });
  await expect(table.getByText('REF-0', { exact: true })).toBeVisible();
  await expect(table).toHaveAttribute('aria-rowcount', '10001');

  const renderedRows = table.locator('tbody tr:not([aria-hidden])');
  expect(await renderedRows.count()).toBeLessThan(60);

  const viewport = page.locator('.table-artifact .analytical-table-scroll');
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(table.getByText('REF-9999', { exact: true })).toBeVisible();
  await expect(table.getByText('REF-0', { exact: true })).toHaveCount(0);
  expect(await renderedRows.count()).toBeLessThan(60);
  await expect(table.locator('thead th').first()).toBeInViewport();
});

test('a server-paged table downloads rows as the reader scrolls and sorts on the server', async ({
  page,
}) => {
  const mock = await openConversation(page, true);
  const table = page.locator('.table-artifact').getByRole('table', { name: 'Open order lines' });
  await expect(table.getByText('REF-0', { exact: true })).toBeVisible();
  await expect(table).toHaveAttribute('aria-rowcount', '10001');
  expect(mock.rowsRequests).toHaveLength(0);

  const viewport = page.locator('.table-artifact .analytical-table-scroll');
  for (let attempt = 0; attempt < 60; attempt++) {
    await viewport.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    if (await table.getByText('REF-9999', { exact: true }).isVisible()) break;
    await page.waitForTimeout(50);
  }
  await expect(table.getByText('REF-9999', { exact: true })).toBeVisible();
  const cursors = mock.rowsRequests.map((params) => params.get('cursor'));
  expect(cursors[0]).toBe('offset-200');
  expect(new Set(cursors).size).toBe(cursors.length);
  expect(await table.locator('tbody tr:not([aria-hidden])').count()).toBeLessThan(80);

  await table.getByRole('button', { name: /Amount/ }).click();
  await expect(table.getByText('REF-9999', { exact: true })).toBeVisible();
  const sorted = mock.rowsRequests.at(-1)!;
  expect(sorted.get('sort')).toBe('amount');
  expect(sorted.has('cursor')).toBe(false);
});
