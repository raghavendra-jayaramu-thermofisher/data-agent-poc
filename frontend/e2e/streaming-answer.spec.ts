import { expect, test } from '@playwright/test';
import chartFixture from '../../test-fixtures/combo-chart.json' with { type: 'json' };

for (const { width, cancel } of [
  { width: 1280, cancel: false },
  { width: 390, cancel: false },
  { width: 1280, cancel: true },
]) {
  test(`answer streams, recovers and ${cancel ? 'stops safely' : 'becomes the saved response'} at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 844 });
    const time = new Date().toISOString();
    const chartId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const chart = {
      id: chartId,
      job_id: 'j1',
      kind: 'chart',
      name: chartFixture.title,
      source_sql_execution_id: chartFixture.source_sql_execution_id,
      payload: chartFixture,
      created_at: time,
    };
    const columns = Object.keys(chartFixture.data[0]!);
    const sql = {
      id: chartFixture.source_sql_execution_id,
      tool_execution_id: 't1',
      data_source_id: 'ds1',
      sql_text: 'SELECT month, online, store, fulfilled, target FROM monthly_summary',
      status: 'succeeded',
      row_count: 6,
      truncated: false,
      columns,
      result_bytes: 1000,
      duration_ms: 1,
      error_code: null,
      error_message: null,
      started_at: time,
      finished_at: time,
    };
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
      conversation_id: 'c1',
      job_type: 'chat_query',
      status: 'running',
      requested_by: 'u1',
      input: {},
      result: null,
      attempt_count: 1,
      max_attempts: 3,
      cancel_requested_at: null as string | null,
      error_code: null,
      error_message: null,
      created_at: time,
      started_at: time,
      finished_at: null as string | null,
    };
    const first = `## Summary\n\nOrders increased. 🌍\n\n[[artifact:${chartId}]]`;
    const second =
      '\n\n## Details\n\n' +
      Array.from(
        { length: 25 },
        (_, index) => `Finding ${index + 1}: Orders grew compared with the previous period.`,
      ).join('\n\n');
    const third = '\n\nThe latest finding arrived while you were reading earlier text.';
    const messages = [
      {
        id: 'q1',
        conversation_id: 'c1',
        role: 'user',
        content: 'Compare monthly orders.',
        job_id: 'j1',
        metadata: {},
        created_at: time,
      },
    ];
    const event = (
      sequence: number,
      event_type: string,
      payload: Record<string, unknown> = {},
    ) => ({ sequence, event_type, payload, level: 'info', created_at: time });
    const events = [
      event(1, 'job.started'),
      event(2, 'finalization.started'),
      event(3, 'answer.started', { stream_id: 'a1' }),
      event(4, 'answer.delta', { stream_id: 'a1', offset: 0, text: first }),
      event(5, 'answer.delta', {
        stream_id: 'a1',
        offset: first.length,
        text: second.slice(0, 20),
      }),
      event(6, 'answer.delta', {
        stream_id: 'a1',
        offset: first.length + 20,
        text: second.slice(20),
      }),
      event(7, 'answer.delta', {
        stream_id: 'a1',
        offset: first.length + second.length,
        text: third,
      }),
      event(8, cancel ? 'job.cancelled' : 'finalization.completed'),
      event(9, 'job.completed'),
    ];
    const sse = (items: typeof events) =>
      items
        .map(
          (item) =>
            `id: ${item.sequence}\nevent: ${item.event_type}\ndata: ${JSON.stringify(item)}\n\n`,
        )
        .join('');
    let available = 4;
    let gapInjected = false;
    let recovered = false;
    let disposed = false;
    let wake = () => {};
    let changed = new Promise<void>((resolve) => {
      wake = resolve;
    });
    const advance = (sequence: number) => {
      available = sequence;
      wake();
      changed = new Promise<void>((resolve) => {
        wake = resolve;
      });
    };
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
      else if (path.endsWith('/conversations/c1/messages')) json = messages;
      else if (path.endsWith('/conversations/c1')) json = { ...conversation, messages };
      else if (path.endsWith('/conversations')) json = [conversation];
      else if (path.endsWith('/jobs/j1/execution'))
        json = { tools: [], models: [], sql: [sql], artifacts: [chart] };
      else if (path.endsWith('/jobs/j1/cancel')) {
        job.cancel_requested_at = time;
        job.status = 'cancelled';
        job.finished_at = time;
        json = job;
        advance(8);
      } else if (path.endsWith('/jobs/j1/events')) {
        const cursor = Math.max(
          Number(url.searchParams.get('after_sequence') ?? 0),
          Number(route.request().headers()['last-event-id'] ?? 0),
        );
        if (!gapInjected) {
          gapInjected = true;
          return route.fulfill({
            contentType: 'text/event-stream',
            body: sse([...events.slice(0, 4), events[5]!]),
          });
        }
        if (cursor === 4) recovered = true;
        while (!disposed && cursor >= available) await changed;
        if (disposed) return route.abort().catch(() => undefined);
        return route
          .fulfill({
            contentType: 'text/event-stream',
            body: sse(
              events.filter((item) => item.sequence > cursor && item.sequence <= available),
            ),
          })
          .catch(() => undefined);
      } else if (path.endsWith('/jobs/j1')) json = job;
      else if (path.endsWith('/jobs'))
        json =
          !url.searchParams.get('status') || url.searchParams.get('status') === job.status
            ? [job]
            : [];
      await route.fulfill({ json });
    });
    try {
      await page.goto('/conversations/c1');
      const preview = page.getByRole('article', { name: 'Answer being written', exact: true });
      await expect(preview).toContainText('Orders increased. 🌍');
      await expect(page.getByRole('button', { name: 'Present answer', exact: true })).toHaveCount(
        0,
      );
      await expect(preview.getByRole('tablist')).toHaveCount(0);
      await expect(preview.locator('canvas')).toHaveCount(1);
      const artifact = preview.locator('.artifact-frame');
      await artifact.getByRole('button', { name: 'Hide chart', exact: true }).click();
      await expect(artifact).toHaveAttribute('data-collapsed', 'true');
      await expect.poll(() => recovered).toBe(true);
      advance(6);
      await expect(preview).toContainText('Finding 25: Orders grew');
      await expect(artifact).toHaveAttribute('data-collapsed', 'true');
      await expect(page.locator('.analysis-progress-card')).toHaveCount(1);
      const scroller = page.locator('.chat-main-scroll');
      await expect.poll(() =>
        scroller.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop),
      ).toBeLessThan(85);
      await page.getByRole('button', { name: 'Show analysis activity' }).click();
      await expect(
        page.getByRole('region', { name: 'Analysis activity', exact: true }).getByRole('listitem'),
      ).toHaveCount(2);
      await page.getByRole('button', { name: 'Hide analysis activity' }).click();
      await scroller.evaluate((node) => {
        node.scrollTop = 0;
      });
      await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBe(0);
      advance(7);
      await expect(preview).toContainText('The latest finding arrived');
      expect(await scroller.evaluate((node) => node.scrollTop)).toBe(0);
      await page
        .getByRole('textbox', { name: 'Ask a follow-up', exact: true })
        .fill('Compare with last quarter.');
      await expect(page.getByRole('button', { name: 'Send question', exact: true })).toBeEnabled();
      // Reload reconstructs the complete preview from durable events, without duplicates.
      await page.reload();
      await expect(preview).toContainText('Finding 25: Orders grew');
      await expect(preview.getByText('Orders increased. 🌍', { exact: true })).toHaveCount(1);
      await expect(page.getByText(/follow_up_suggestions|\[\[artifact:/)).toHaveCount(0);
      if (cancel) {
        await page.getByRole('button', { name: 'Stop', exact: true }).click();
        const incomplete = page.getByRole('article', { name: 'Incomplete answer', exact: true });
        await expect(incomplete).toContainText('Incomplete response');
        await expect(incomplete).toContainText('Finding 25: Orders grew');
        await expect(incomplete).toHaveAttribute('aria-busy', 'false');
        await expect(page.getByRole('button', { name: 'Present answer', exact: true })).toHaveCount(
          0,
        );
      } else {
        messages.push({
          ...messages[0]!,
          id: 'a1',
          role: 'assistant',
          content: first + second + third,
          metadata: {},
          created_at: time,
        });
        job.status = 'succeeded';
        job.finished_at = time;
        advance(9);
        await expect(preview).toHaveCount(0);
        await expect(page.locator('.assistant-card')).toHaveCount(1);
        await expect(
          page.getByRole('button', { name: 'Present answer', exact: true }),
        ).toBeEnabled();
        await expect(page.locator('.analysis-progress-card')).toHaveCount(0);
        await expect(page.getByRole('tablist', { name: 'Answer sections' })).toBeVisible();
      }
      expect(errors).toEqual([]);
      await page.screenshot({
        path: test
          .info()
          .outputPath(`streamed-answer-${width}-${cancel ? 'cancelled' : 'complete'}.png`),
        animations: 'disabled',
      });
    } finally {
      disposed = true;
      wake();
    }
  });
}
