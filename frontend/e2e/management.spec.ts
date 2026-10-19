import { expect, test, type Page } from '@playwright/test';

async function mockSettings(page: Page, role = 'owner') {
  const time = '2026-10-18T00:00:00Z';
  let sources = [
    {
      id: 's1',
      name: 'Sales reporting',
      display_type: 'postgres',
      kind: 'postgres',
      config: {
        host: 'db.example.com',
        port: 5432,
        database: 'sales',
        schema_name: 'public',
        ssl_mode: 'prefer',
      },
    },
    { id: 's2', name: 'Regional operations', display_type: 'mssql', kind: 'mssql', config: {} },
    { id: 's3', name: 'Weekly orders', display_type: 'excel', kind: 'duckdb', config: {} },
  ].map((item) => ({
    ...item,
    organization_id: 'org1',
    created_by: 'u1',
    status: 'active',
    last_tested_at: time,
    last_error_code: null,
    created_at: time,
    updated_at: time,
  }));
  let connections = [
    {
      id: 'c1',
      name: 'Primary provider',
      base_url: 'https://provider.example/v1',
      has_api_key: true,
      status: 'active',
      organization_id: 'org1',
      created_by: 'u1',
      created_at: time,
      updated_at: time,
      last_tested_at: time,
      last_error_code: null,
    },
  ];
  let profiles = [
    {
      id: 'p1',
      display_name: 'Reporting model',
      model_name: 'analysis-model',
      enabled: true,
      is_default: true,
    },
    {
      id: 'p2',
      display_name: 'Quick answers',
      model_name: 'fast-model',
      enabled: true,
      is_default: false,
    },
    {
      id: 'p3',
      display_name: 'Quarterly review',
      model_name: 'review-model',
      enabled: false,
      is_default: false,
    },
  ].map((item) => ({
    ...item,
    connection_id: 'c1',
    organization_id: 'org1',
    created_at: time,
    updated_at: time,
    settings: { temperature: 0.2, max_tokens: 4000 },
  }));
  const requests = {
    sourceTests: 0,
    modelTests: 0,
    sourceBody: undefined as unknown,
    connectionBody: undefined as unknown,
    profileBody: undefined as unknown,
    upload: false,
  };
  let deleteAttempts = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'db-assistant.auth.v1',
      JSON.stringify({
        access_token: 'mock',
        refresh_token: 'mock',
        token_type: 'bearer',
        expires_in: 900,
      }),
    ),
  );
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let json: unknown = [];
    if (path.endsWith('/auth/me'))
      json = {
        id: 'u1',
        email: 'alex@example.com',
        display_name: 'Alex Morgan',
        is_active: true,
        created_at: time,
        updated_at: time,
      };
    else if (path.endsWith('/organizations'))
      json = [{ id: 'org1', name: 'Operations', role, created_at: time, updated_at: time }];
    else if (path === '/api/v1/data-sources') {
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        requests.sourceBody = body;
        const created = { ...sources[0]!, ...body, id: 'new-source' };
        sources.push(created);
        json = created;
      } else json = sources;
    } else if (path === '/api/v1/data-sources/excel') {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      expect(route.request().postDataBuffer()!.toString()).toContain('orders.xlsx');
      requests.upload = true;
      json = { data_source: sources[2], job_id: 'job1' };
    } else if (path.endsWith('/schema'))
      json = {
        tables: ['orders', 'customers', 'regions'].map((name) => ({
          name,
          schema: 'public',
          columns: [
            { name: 'id', native_type: 'integer', nullable: false },
            { name: 'amount', native_type: 'numeric(18,2)', nullable: true },
          ],
        })),
      };
    else if (/\/data-sources\/[^/]+\/test$/.test(path)) {
      requests.sourceTests++;
      json = { job_id: 'job1' };
    } else if (path === '/api/v1/jobs/job1')
      json = {
        id: 'job1',
        job_type: 'datasource_test',
        status: 'succeeded',
        organization_id: 'org1',
        requested_by: 'u1',
        input: { data_source_id: 's1' },
        result: {},
        attempt_count: 1,
        max_attempts: 1,
        error_code: null,
        error_message: null,
        conversation_id: null,
        cancel_requested_at: null,
        created_at: time,
        started_at: time,
        finished_at: time,
      };
    else if (/^\/api\/v1\/data-sources\/[^/]+$/.test(path)) {
      const id = path.split('/').pop();
      if (method === 'PATCH') {
        const body = route.request().postDataJSON();
        requests.sourceBody = body;
        sources = sources.map((item) => (item.id === id ? { ...item, ...body } : item));
      }
      if (method === 'DELETE') {
        deleteAttempts++;
        if (deleteAttempts === 1)
          return route.fulfill({
            status: 409,
            json: {
              error: { code: 'DATASOURCE_IN_USE', message: 'This data source is still in use.' },
            },
          });
        sources = sources.filter((item) => item.id !== id);
        return route.fulfill({ status: 204 });
      }
      json = sources.find((item) => item.id === id);
    } else if (path === '/api/v1/models/connections') {
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        requests.connectionBody = body;
        const created = {
          ...connections[0]!,
          ...body,
          id: 'c2',
          has_api_key: Boolean(body.api_key),
        };
        connections.push(created);
        json = created;
      } else json = connections;
    } else if (/\/models\/connections\/[^/]+\/test$/.test(path)) {
      requests.modelTests++;
      json = { ok: true, model_count: 3, sample_models: [], tested_at: time };
    } else if (/\/models\/connections\/[^/]+$/.test(path)) {
      const id = path.split('/').pop();
      if (method === 'PATCH') {
        const body = route.request().postDataJSON();
        requests.connectionBody = body;
        connections = connections.map((item) =>
          item.id === id
            ? { ...item, ...body, has_api_key: body.clear_api_key ? false : item.has_api_key }
            : item,
        );
      }
      if (method === 'DELETE') {
        connections = connections.filter((item) => item.id !== id);
        return route.fulfill({ status: 204 });
      }
      json = connections.find((item) => item.id === id);
    } else if (path === '/api/v1/models/profiles') {
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        requests.profileBody = body;
        const created = { ...profiles[1]!, ...body, id: 'new-profile' };
        profiles.push(created);
        json = created;
      } else json = profiles;
    } else if (/\/models\/profiles\/[^/]+\/default$/.test(path)) {
      const id = path.split('/').at(-2);
      profiles = profiles.map((item) => ({ ...item, is_default: item.id === id }));
      json = profiles.find((item) => item.id === id);
    } else if (/\/models\/profiles\/[^/]+$/.test(path)) {
      const id = path.split('/').pop();
      if (method === 'PATCH') {
        const body = route.request().postDataJSON();
        requests.profileBody = body;
        profiles = profiles.map((item) => (item.id === id ? { ...item, ...body } : item));
      }
      if (method === 'DELETE') {
        profiles = profiles.filter((item) => item.id !== id);
        return route.fulfill({ status: 204 });
      }
      json = profiles.find((item) => item.id === id);
    }
    await route.fulfill({ json });
  });
  return { requests, errors };
}
async function screenshot(page: Page, output: string) {
  await page.screenshot({ path: output, fullPage: true, animations: 'disabled' });
}
async function noOverflow(page: Page) {
  expect(
    await page.locator('.main-content').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
}
for (const viewport of [
  { width: 1280, height: 850 },
  { width: 390, height: 844 },
]) {
  test(
    'compact Data Sources and Models workflows at ' + viewport.width + 'px',
    async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const { requests, errors } = await mockSettings(page);
      await page.goto('/data-sources');
      await expect(page.getByRole('heading', { name: 'Data sources', exact: true })).toBeVisible();
      await expect(page.locator('.management-row')).toHaveCount(3);
      await noOverflow(page);
      const search = page.getByRole('searchbox', { name: 'Search data sources' });
      await search.focus();
      await expect(search).toHaveCSS('box-shadow', 'none');
      await expect(page.locator('.management-search')).not.toHaveCSS('box-shadow', 'none');
      await screenshot(page, testInfo.outputPath('data-sources-' + viewport.width + '.png'));
      await search.fill('SQL Server');
      await expect(page.locator('.management-row')).toHaveCount(1);
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await page
        .getByRole('button', { name: 'More actions for Sales reporting', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Test connection', exact: true }).click();
      await expect.poll(() => requests.sourceTests).toBe(1);
      await page.getByRole('link', { name: 'Sales reporting', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Connection', exact: true })).toBeVisible();
      await page.getByText('public.orders', { exact: true }).click();
      await expect(
        page.getByRole('table', { name: 'orders columns' }).getByText('numeric(18,2)'),
      ).toBeVisible();
      await noOverflow(page);
      await screenshot(page, testInfo.outputPath('data-source-detail-' + viewport.width + '.png'));
      await page
        .getByRole('button', { name: 'More actions for Sales reporting', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Edit data source', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
        'Sales reporting',
      );
      await noOverflow(page);
      await screenshot(page, testInfo.outputPath('data-source-edit-' + viewport.width + '.png'));
      await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Updated sales');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Updated sales', exact: true })).toBeVisible();
      expect(requests.sourceBody).toEqual(expect.objectContaining({ name: 'Updated sales' }));
      expect(requests.sourceBody).not.toHaveProperty('credentials');
      await page.goto('/data-sources/new');
      await expect(
        page.getByRole('heading', { name: 'Add data source', exact: true }),
      ).toBeVisible();
      await noOverflow(page);
      await screenshot(page, testInfo.outputPath('data-source-new-' + viewport.width + '.png'));
      await page.getByRole('tab', { name: 'Excel workbook', exact: true }).click();
      await page.locator('#excel-file').setInputFiles({
        name: 'orders.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('test workbook'),
      });
      await page.getByRole('button', { name: 'Upload workbook', exact: true }).click();
      await expect.poll(() => requests.upload).toBe(true);
      await expect(page.getByRole('heading', { name: 'Weekly orders', exact: true })).toBeVisible();
      await page.goto('/data-sources');
      await page
        .getByRole('button', { name: 'More actions for Weekly orders', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Delete data source', exact: true }).click();
      const deletion = page.getByRole('alertdialog');
      await deletion.getByRole('button', { name: 'Delete data source', exact: true }).click();
      await expect(deletion.getByRole('alert')).toContainText('still in use');
      await deletion.getByRole('button', { name: 'Delete data source', exact: true }).click();
      await expect(deletion).not.toBeVisible();
      await expect(page.locator('.management-row')).toHaveCount(2);

      await page.goto('/models');
      await expect(page.getByRole('heading', { name: 'Models', exact: true })).toBeVisible();
      await expect(page.locator('.management-row')).toHaveCount(3);
      await noOverflow(page);
      await screenshot(page, testInfo.outputPath('models-' + viewport.width + '.png'));
      await page.getByRole('searchbox', { name: 'Search models' }).fill('fast-model');
      await expect(page.locator('.management-row')).toHaveCount(1);
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await page
        .getByRole('button', { name: 'More actions for Quick answers', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Make workspace default', exact: true }).click();
      await expect(
        page.locator('.management-row').filter({ hasText: 'Quick answers' }),
      ).toContainText('Workspace default');
      await page.getByRole('link', { name: 'Reporting model analysis-model', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Display name', exact: true })).toHaveValue(
        'Reporting model',
      );
      await expect(
        page.getByRole('switch', { name: 'Profile enabled', exact: true }),
      ).toBeChecked();
      await noOverflow(page);
      await screenshot(page, testInfo.outputPath('model-profile-' + viewport.width + '.png'));
      await page.getByRole('spinbutton', { name: 'Temperature', exact: true }).fill('');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect
        .poll(() => requests.profileBody)
        .toEqual(expect.objectContaining({ settings: { max_tokens: 4000 } }));
      await page.goto('/models');
      await page.getByRole('tab', { name: 'Connections', exact: true }).click();
      await expect(page.locator('.management-row')).toHaveCount(1);
      await screenshot(page, testInfo.outputPath('model-connections-' + viewport.width + '.png'));
      await page
        .getByRole('button', { name: 'More actions for Primary provider', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Test connection', exact: true }).click();
      await expect.poll(() => requests.modelTests).toBe(1);
      await page.getByRole('link', { name: 'Primary provider', exact: true }).click();
      await expect(page.getByLabel('Replace API key', { exact: true })).toHaveValue('');
      await noOverflow(page);
      await screenshot(page, testInfo.outputPath('model-connection-' + viewport.width + '.png'));
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect
        .poll(() => requests.connectionBody)
        .toEqual({
          name: 'Primary provider',
          base_url: 'https://provider.example/v1',
          clear_api_key: false,
        });
      await page.goto('/models/profiles/new');
      await page.getByRole('button', { name: /Connection/ }).click();
      await page.getByRole('option', { name: 'Primary provider', exact: true }).click();
      await page
        .getByRole('textbox', { name: 'Display name', exact: true })
        .fill('Executive review');
      await page.getByRole('textbox', { name: 'Model identifier', exact: true }).fill('review-v2');
      await screenshot(page, testInfo.outputPath('model-profile-new-' + viewport.width + '.png'));
      await page.getByRole('button', { name: 'Save profile', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Models', exact: true })).toBeVisible();
      await expect(page.locator('.management-row')).toHaveCount(4);
      expect(errors).toEqual([]);
    },
  );
}
test('members can inspect Data Sources and Models without management controls', async ({
  page,
}) => {
  await mockSettings(page, 'member');
  await page.goto('/data-sources');
  await expect(page.locator('.management-row')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Add data source', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'More actions for Sales reporting', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Delete data source', exact: true })).toHaveCount(
    0,
  );
  await page.keyboard.press('Escape');
  await page.goto('/models');
  await expect(page.locator('.management-row')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Add profile', exact: true })).toHaveCount(0);
  await page.goto('/models/profiles/p1');
  await expect(page.getByText('analysis-model', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0);
  await page.goto('/models/connections/c1');
  await expect(page.getByText('https://provider.example/v1', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Replace API key', { exact: true })).toHaveCount(0);
});
