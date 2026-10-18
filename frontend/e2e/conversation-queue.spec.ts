import { expect, test } from '@playwright/test';

for (const width of [1600, 1280, 390]) {
  test(`queued questions keep inline progress and edge scrolling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const time = '2026-10-18T00:00:00Z';
    const later = '2026-10-18T00:00:01Z';
    const conversation = {
      id: 'c1',
      organization_id: 'org1',
      created_by: 'u1',
      title: 'Monthly orders',
      model_profile_id: null,
      data_source_ids: ['ds1'],
      table_scope: [],
      created_at: time,
      updated_at: time,
    };
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
      cancel_requested_at: null,
      error_code: null,
      error_message: null,
      created_at: time,
      started_at: time,
      finished_at: null as string | null,
    };
    const nextJob = { ...job, id: 'j2', status: 'queued', created_at: later };
    const messages = [
      {
        id: 'm1',
        conversation_id: 'c1',
        role: 'user',
        content: 'Compare monthly orders.',
        job_id: 'j1',
        metadata: {},
        created_at: time,
      },
    ];
    let submitted = false;
    let completed = false;
    let complete!: () => void;
    let close!: () => void;
    const completion = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const closing = new Promise<void>((resolve) => {
      close = resolve;
    });
    const streams = new Map<string, number>();
    const event = (sequence: number, event_type: string) =>
      `id: ${sequence}\ndata: ${JSON.stringify({ sequence, event_type, level: 'info', payload: {}, created_at: time })}\n\n`;
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
            id: 'ds1',
            organization_id: 'org1',
            name: 'Warehouse',
            kind: 'postgres',
            display_type: 'postgres',
            status: 'active',
            config: {},
            created_by: 'u1',
            last_tested_at: null,
            last_error_code: null,
            created_at: time,
            updated_at: time,
            active_file: null,
          },
        ];
      else if (path.endsWith('/conversations/c1/messages') && route.request().method() === 'POST') {
        expect(route.request().postDataJSON().content).toBe('Break those orders down by region.');
        submitted = true;
        messages.push({
          ...messages[0],
          id: 'm2',
          content: 'Break those orders down by region.',
          job_id: 'j2',
          created_at: later,
        });
        return route.fulfill({
          status: 202,
          json: { conversation_id: 'c1', message_id: 'm2', job_id: 'j2', status: 'queued' },
        });
      } else if (path.endsWith('/conversations/c1/messages')) json = messages;
      else if (path.endsWith('/conversations/c1')) json = { ...conversation, messages };
      else if (path.endsWith('/conversations')) json = [conversation];
      else if (/\/jobs\/j[12]\/events$/.test(path)) {
        const id = path.includes('/j1/') ? 'j1' : 'j2';
        const count = streams.get(id) ?? 0;
        streams.set(id, count + 1);
        let body: string;
        if (id === 'j1' && count === 0) body = event(1, 'job.started') + event(2, 'sql.started');
        else if (id === 'j1') {
          await completion;
          body = event(3, 'job.completed');
        } else if (count === 0) {
          await completion;
          body = event(1, 'job.started') + event(2, 'sql.started');
        } else {
          await closing;
          body = '';
        }
        return route.fulfill({ contentType: 'text/event-stream', body }).catch(() => undefined);
      } else if (path.endsWith('/jobs/j1')) json = job;
      else if (path.endsWith('/jobs/j2')) json = nextJob;
      else if (path.endsWith('/jobs'))
        json = [job, ...(submitted ? [nextJob] : [])].filter(
          (item) =>
            !url.searchParams.get('status') || item.status === url.searchParams.get('status'),
        );
      else if (path.endsWith('/execution'))
        json = { tools: [], sql: [], models: [], artifacts: [] };
      await route.fulfill({ json });
    });
    try {
      await page.goto('/conversations/c1');
      const progress = page.getByRole('region', { name: 'Analysis in progress', exact: true });
      await expect(progress.getByRole('status')).toHaveText('Retrieving the data…');
      await expect(progress).toHaveCount(1);
      expect(await progress.evaluate((node) => node.previousElementSibling?.textContent)).toContain(
        'Compare monthly orders.',
      );
      const input = page.getByRole('textbox', { name: 'Ask a follow-up', exact: true });
      await input.fill('Break those orders down by region.');
      await expect(page.getByRole('button', { name: 'Send question', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Send question', exact: true }).click();
      await expect(page.locator('.queued-question-label')).toHaveText('Queued');
      await expect(input).toHaveValue('');
      await expect(progress).toHaveCount(1);
      expect(await progress.evaluate((node) => node.previousElementSibling?.textContent)).toContain(
        'Compare monthly orders.',
      );
      await expect(page.locator('.chat-composer-deck .analysis-progress-card')).toHaveCount(0);
      job.status = 'succeeded';
      job.finished_at = new Date().toISOString();
      nextJob.status = 'running';
      messages.push({
        ...messages[0],
        id: 'a1',
        role: 'assistant',
        content: Array.from(
          { length: 18 },
          (_, i) => `## Month ${i + 1}\n\nOrders increased compared with last month.`,
        ).join('\n\n'),
        created_at: '2026-10-18T00:01:00Z',
      });
      completed = true;
      complete();
      await expect(page.locator('.assistant-card')).toHaveCount(1);
      await expect(page.locator('.queued-question-label')).toHaveCount(0);
      await expect(progress).toHaveCount(1);
      await expect
        .poll(() => progress.evaluate((node) => node.previousElementSibling?.textContent))
        .toContain('Break those orders down by region.');
      const checkAlignment = async () => {
        const bounds = await page.evaluate(() => {
          const rect = (selector: string) =>
            document.querySelector(selector)!.getBoundingClientRect();
          const scroll = rect('.chat-main-scroll'),
            workspace = rect('.chat-workspace');
          const stream = rect('.chat-message-stream'),
            composer = rect('.chat-composer-card');
          return {
            scrollRight: scroll.right,
            edge: workspace.right,
            streamLeft: stream.left,
            streamRight: stream.right,
            composerLeft: composer.left,
            composerRight: composer.right,
            scrollable:
              document.querySelector('.chat-main-scroll')!.scrollHeight >
              document.querySelector('.chat-main-scroll')!.clientHeight,
          };
        });
        expect(bounds.scrollable).toBe(true);
        expect(Math.abs(bounds.scrollRight - bounds.edge)).toBeLessThanOrEqual(1);
        expect(Math.abs(bounds.streamLeft - bounds.composerLeft)).toBeLessThanOrEqual(1);
        expect(Math.abs(bounds.streamRight - bounds.composerRight)).toBeLessThanOrEqual(1);
      };
      await checkAlignment();
      if (width >= 768) {
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        await checkAlignment();
        await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        await checkAlignment();
      }
      await page.locator('.chat-main-scroll').evaluate((node) => {
        node.scrollTop = 0;
      });
      await page.screenshot({
        path: test.info().outputPath(`conversation-queue-${width}.png`),
        animations: 'disabled',
      });
    } finally {
      if (!completed) complete();
      close();
    }
  });
}
