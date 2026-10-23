import { expect, test } from '@playwright/test';
for (const viewport of [
  { width: 1280, height: 850 },
  { width: 390, height: 844 },
]) {
  test('compact Jobs list and details at ' + viewport.width + 'px', async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const time = new Date(Date.now() - 180_000).toISOString();
    const base = {
      organization_id: 'org1',
      requested_by: 'u1',
      result: null,
      attempt_count: 1,
      max_attempts: 3,
      error_code: null,
      error_message: null,
      cancel_requested_at: null,
      created_at: time,
      started_at: time,
      finished_at: time,
      duration_ms: 3000,
      conversation_id: null,
    };
    const jobs = [
      {
        ...base,
        id: 'j1',
        job_type: 'datasource_test',
        status: 'succeeded',
        input: { data_source_id: 's1' },
      },
      {
        ...base,
        id: 'j2',
        job_type: 'chat_query',
        status: 'failed',
        input: { question: 'Explain overdue backlog' },
        error_code: 'REQUEST_FAILED',
        error_message: 'The analysis could not be completed. Please try again.',
        conversation_id: 'c1',
        duration_ms: 82_000,
      },
      {
        ...base,
        id: 'j3',
        job_type: 'knowledge_generation',
        status: 'cancelled',
        input: { data_source_id: 's1' },
      },
      {
        ...base,
        id: 'j4',
        job_type: 'chat_query',
        status: 'succeeded',
        input: {
          question:
            'Show regional backlog by stock availability and compare the largest changes between weekly snapshots',
        },
        conversation_id: 'c2',
        duration_ms: 72_000,
      },
    ];
    const errors: string[] = [];
    const requested: string[] = [];
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
      const url = new URL(route.request().url());
      const path = url.pathname;
      let json: unknown = [];
      // The chat sidebar reads paged conversations.
      if (new URL(route.request().url()).pathname.endsWith('/conversations'))
        json = { items: [], next_cursor: null, has_more: false };
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
        json = [
          { id: 'org1', name: 'Operations', role: 'owner', created_at: time, updated_at: time },
        ];
      else if (path.endsWith('/data-sources'))
        json = [
          {
            id: 's1',
            name: 'Sales warehouse',
            kind: 'postgres',
            display_type: 'postgres',
            config: {},
            status: 'active',
            organization_id: 'org1',
            created_by: 'u1',
            created_at: time,
            updated_at: time,
            last_tested_at: time,
            last_error_code: null,
          },
        ];
      else if (path.endsWith('/jobs')) {
        const status = url.searchParams.get('status');
        if (url.searchParams.get('limit') === '100') requested.push(status || 'all');
        json = status ? jobs.filter((item) => item.status === status) : jobs;
      } else if (path.endsWith('/execution'))
        json = { models: [], tools: [], sql: [], artifacts: [] };
      else if (/\/jobs\/j\d$/.test(path)) json = jobs.find((item) => path.endsWith('/' + item.id));
      await route.fulfill({ json });
    });
    await page.goto('/jobs');
    await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
    await expect(page.locator('.jobs-row')).toHaveCount(4);
    await expect(page.getByText('Job Ledger', { exact: true })).toHaveCount(0);
    expect(
      await page.locator('.main-content').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('jobs-' + viewport.width + '.png'),
      animations: 'disabled',
      fullPage: true,
    });
    const search = page.getByRole('searchbox', { name: 'Search jobs' });
    await search.fill('regional backlog');
    await expect(page.locator('.jobs-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.getByRole('tab', { name: 'Failed', exact: true }).click();
    await expect(page.locator('.jobs-row')).toHaveCount(1);
    await expect(page).toHaveURL(/status=failed/);
    expect(requested).toContain('failed');
    await page.locator('.jobs-row-link').click();
    await expect(page.getByRole('heading', { name: 'Data analysis', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('The analysis could not be completed.');
    await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toBeVisible();
    await expect(page.getByText('j2', { exact: true })).not.toBeVisible();
    expect(
      await page.locator('.main-content').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('job-detail-' + viewport.width + '.png'),
      animations: 'disabled',
      fullPage: true,
    });
    await page.getByText('Technical details', { exact: true }).click();
    await expect(page.getByText('j2', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy diagnostics', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to jobs', exact: true }).click();
    await page.getByRole('tab', { name: 'Completed', exact: true }).click();
    await expect(page.locator('.jobs-row')).toHaveCount(2);
    expect(requested).toContain('succeeded');
    await page.getByRole('tab', { name: 'Queued', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No queued jobs', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'All', exact: true }).click();
    await expect(page.locator('.jobs-row')).toHaveCount(4);
    await page.getByRole('button', { name: 'Refresh jobs', exact: true }).click();
    expect(errors).toEqual([]);
  });
}
