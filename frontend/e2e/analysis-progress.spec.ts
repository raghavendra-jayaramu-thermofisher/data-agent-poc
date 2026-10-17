import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`compact progress, full history and search focus at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 844 });
    const started = new Date(Date.now() - 15000).toISOString();
    const title = 'Monthly orders';
    const job = {
      id: 'j1',
      organization_id: 'org1',
      job_type: 'chat_query',
      status: 'running',
      requested_by: 'u1',
      conversation_id: 'c1',
      input: {},
      result: null,
      attempt_count: 1,
      max_attempts: 3,
      cancel_requested_at: null as string | null,
      error_code: null,
      error_message: null,
      created_at: started,
      started_at: started,
      finished_at: null as string | null,
    };
    const conversation = {
      id: 'c1',
      organization_id: 'org1',
      created_by: 'u1',
      title,
      model_profile_id: null,
      data_source_ids: [],
      table_scope: [],
      created_at: started,
      updated_at: started,
    };
    const messages = [
      {
        id: 'm1',
        conversation_id: 'c1',
        role: 'user',
        content: 'Compare monthly orders.',
        job_id: 'j1',
        metadata: {},
        created_at: started,
      },
    ];
    const eventTypes = [
      'job.queued',
      'job.started',
      'agent.started',
      'model.request.started',
      'tool.started',
      'sql.started',
      'sql.completed',
      'tool.completed',
      'model.request.started',
      'tool.started',
      'tool.completed',
      'finalization.started',
    ];
    const events = eventTypes.map((event_type, index) => ({
      sequence: index + 1,
      event_type,
      level: 'info',
      payload: {},
      created_at: new Date(Date.parse(started) + index * 1000).toISOString(),
    }));
    let cancelled = 0;
    let streamRequests = 0;
    let finish!: () => void;
    const terminal = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const sse = (event: (typeof events)[number]) =>
      `id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`;
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
      if (path.endsWith('/auth/me'))
        json = {
          id: 'u1',
          email: 'alex@example.com',
          display_name: 'Alex Morgan',
          is_active: true,
          created_at: started,
          updated_at: started,
        };
      else if (path.endsWith('/organizations'))
        json = [
          {
            id: 'org1',
            name: 'Operations',
            role: 'owner',
            created_at: started,
            updated_at: started,
          },
        ];
      else if (path.endsWith('/conversations/c1/messages')) json = messages;
      else if (path.endsWith('/conversations/c1')) json = { ...conversation, messages };
      else if (path.endsWith('/conversations')) json = [conversation];
      else if (path.endsWith('/jobs/j1/events')) {
        if (streamRequests++ === 0)
          return route.fulfill({
            contentType: 'text/event-stream',
            body: events.map(sse).join(''),
          });
        await terminal;
        return route
          .fulfill({
            contentType: 'text/event-stream',
            body: sse({
              sequence: 13,
              event_type: 'job.cancelled',
              level: 'info',
              payload: {},
              created_at: new Date().toISOString(),
            }),
          })
          .catch(() => undefined);
      } else if (path.endsWith('/jobs/j1/cancel')) {
        cancelled++;
        job.cancel_requested_at = new Date().toISOString();
        json = job;
      } else if (path.endsWith('/jobs/j1')) json = job;
      else if (path.endsWith('/jobs'))
        json = url.searchParams.get('status') === 'queued' ? [] : [job];
      await route.fulfill({ json });
    });
    try {
      await page.goto('/conversations/c1');
      const progress = page.getByRole('region', { name: 'Analysis in progress', exact: true });
      await expect(progress.getByRole('status')).toHaveText('Preparing final answer…');
      await expect(
        progress.getByRole('region', { name: 'Analysis activity', exact: true }),
      ).toHaveCount(0);
      expect((await progress.boundingBox())!.height).toBeLessThanOrEqual(60);
      await expect(progress.locator('.analysis-progress-pie path').first()).toHaveCSS(
        'animation-name',
        'analysis-pie-cycle',
      );
      await progress.screenshot({
        path: test.info().outputPath(`progress-collapsed-${width}.png`),
        animations: 'disabled',
      });
      await progress.getByRole('button', { name: 'Show analysis activity' }).click();
      const history = progress.getByRole('region', { name: 'Analysis activity', exact: true });
      await expect(history.getByRole('listitem')).toHaveCount(12);
      await expect(history.getByText('Running analysis tool…', { exact: true })).toHaveCount(2);
      expect((await history.boundingBox())!.height).toBeLessThanOrEqual(180);
      expect(await history.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
        true,
      );
      await progress.screenshot({
        path: test.info().outputPath(`progress-expanded-${width}.png`),
        animations: 'disabled',
      });
      await progress.getByRole('button', { name: 'Hide analysis activity' }).click();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(progress.locator('.analysis-progress-pie path').first()).toHaveCSS(
        'animation-name',
        'none',
      );
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      if (width < 768) await page.getByRole('button', { name: 'Open navigation' }).click();
      const sidebar =
        width < 768
          ? page.getByRole('dialog', { name: 'Navigation', exact: true })
          : page.getByRole('complementary', { name: 'Application sidebar' });
      const search = sidebar.getByRole('textbox', { name: 'Search conversation history' });
      await search.focus();
      await expect(search).toHaveCSS('box-shadow', 'none');
      await expect(search).toHaveCSS('border-top-width', '0px');
      await expect(search).toHaveCSS('outline-style', 'none');
      await page.locator('.sidebar-search-field:visible').screenshot({
        path: test.info().outputPath(`search-focus-${width}.png`),
        animations: 'disabled',
      });
      await search.fill('not-a-matching-chat');
      await expect(sidebar.getByText('No matching chats', { exact: true })).toBeVisible();
      await search.fill('');
      await expect(sidebar.getByRole('link', { name: title, exact: true })).toBeVisible();
      if (width < 768) await page.getByRole('button', { name: 'Close navigation' }).click();
      await progress.getByRole('button', { name: 'Stop', exact: true }).click();
      await expect(progress.getByRole('button', { name: 'Stopping…' })).toBeDisabled();
      await expect(progress.getByRole('status')).toHaveText('Stopping analysis…');
      expect(cancelled).toBe(1);
      job.status = 'cancelled';
      job.finished_at = new Date().toISOString();
      finish();
      await expect(progress).toHaveCount(0);
    } finally {
      finish();
    }
  });
}
