import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`clarifying questions are answered in one card at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const timestamp = '2026-10-23T00:00:00Z';
    const conversation = {
      id: 'c1',
      organization_id: 'org1',
      created_by: 'u1',
      title: 'Overdue backlog',
      model_profile_id: null,
      data_source_ids: [],
      table_scope: [],
      created_at: timestamp,
      updated_at: timestamp,
    };
    const messages: Record<string, unknown>[] = [
      {
        id: 'q1',
        conversation_id: 'c1',
        role: 'user',
        content: 'Show overdue backlog',
        job_id: 'j1',
        metadata: {},
        created_at: timestamp,
      },
      {
        id: 'a1',
        conversation_id: 'c1',
        role: 'assistant',
        content: '# A few questions before I continue',
        job_id: 'j1',
        metadata: {
          clarification: {
            schema_version: 1,
            reason: 'Division and period change the totals.',
            questions: [
              {
                id: 'division',
                kind: 'choice',
                prompt: 'Which division?',
                options: [
                  { label: 'BID', description: 'Bioproduction' },
                  { label: 'LSG' },
                  { label: 'Other', is_other: true },
                ],
              },
              {
                id: 'regions',
                kind: 'choice',
                prompt: 'Which regions?',
                multiple: true,
                options: [{ label: 'ANZ' }, { label: 'Japan' }, { label: 'Other', is_other: true }],
              },
              { id: 'period', kind: 'text', prompt: 'Which period?', required: false },
            ],
          },
        },
        created_at: timestamp,
      },
    ];
    let posted: { answers: unknown[] } | undefined;
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
      const page1 = <T>(items: T[]) => ({ items, next_cursor: null, has_more: false });
      let json: unknown = [];
      if (path.endsWith('/auth/me'))
        json = {
          id: 'u1',
          email: 't@example.com',
          display_name: 'Tester',
          is_active: true,
          created_at: timestamp,
          updated_at: timestamp,
        };
      else if (path.endsWith('/organizations'))
        json = [
          { id: 'org1', name: 'Test', role: 'owner', created_at: timestamp, updated_at: timestamp },
        ];
      else if (path.endsWith('/clarification-answers')) {
        posted = route.request().postDataJSON();
        messages.push({
          id: 'q2',
          conversation_id: 'c1',
          role: 'user',
          content:
            'Answers to your questions:\n- Which division? Other: Clinical\n- Which regions? ANZ',
          job_id: 'j2',
          metadata: { answers_message_id: 'a1', clarification_answers: posted?.answers },
          created_at: timestamp,
        });
        return route.fulfill({ status: 202, json: { message_id: 'q2', job_id: 'j2' } });
      } else if (path.endsWith('/conversations/c1/messages')) json = page1(messages);
      else if (path.endsWith('/conversations/c1')) json = conversation;
      else if (path.endsWith('/conversations')) json = page1([conversation]);
      else if (path.endsWith('/jobs/j2'))
        json = {
          id: 'j2',
          organization_id: 'org1',
          job_type: 'chat_query',
          status: 'queued',
          requested_by: 'u1',
          conversation_id: 'c1',
          input: {},
          result: null,
          attempt_count: 0,
          max_attempts: 3,
          cancel_requested_at: null,
          error_code: null,
          error_message: null,
          created_at: timestamp,
          started_at: null,
          finished_at: null,
        };
      else if (path.includes('/events')) return route.abort();
      await route.fulfill({ json });
    });

    await page.goto('/conversations/c1');
    const card = page.getByRole('region', { name: 'Clarifying questions' });
    await expect(
      card.getByRole('heading', { name: 'A few questions before I continue' }),
    ).toBeVisible();
    const composer = page.getByRole('textbox', { name: 'Ask a follow-up' });
    await expect(composer).toBeDisabled();
    await expect(composer).toHaveAttribute('placeholder', 'Answer the questions above to continue');

    await card.getByRole('radio', { name: /Other/ }).check();
    await card.getByRole('textbox', { name: 'Other answer for: Which division?' }).fill('Clinical');
    await card.getByRole('checkbox', { name: 'ANZ' }).check();
    const box = await card.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await card.getByRole('button', { name: 'Send answers' }).click();

    await expect
      .poll(() => posted)
      .toEqual({
        answers: [
          { question_id: 'division', selected: ['Other'], other_text: 'Clinical' },
          { question_id: 'regions', selected: ['ANZ'] },
          { question_id: 'period' },
        ],
      });
    await expect(card.getByText('Other: Clinical')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Send answers' })).toHaveCount(0);
    await expect(page.locator('.user-bubble').last()).toContainText(
      'Which division? Other: Clinical',
    );
  });
}
