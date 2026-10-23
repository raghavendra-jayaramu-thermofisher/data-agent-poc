import { expect, test } from '@playwright/test';

test('a paused analysis waits for answers on the same job and resumes after them', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const at = (second: number) => new Date(Date.UTC(2026, 9, 23, 0, 0, second)).toISOString();
  const conversation = {
    id: 'c1',
    organization_id: 'org1',
    created_by: 'u1',
    title: 'Overdue backlog',
    model_profile_id: null,
    data_source_ids: [],
    table_scope: [],
    created_at: at(0),
    updated_at: at(0),
  };
  const messages: Record<string, unknown>[] = [
    {
      id: 'q1',
      conversation_id: 'c1',
      role: 'user',
      content: 'Show overdue backlog',
      job_id: 'j1',
      metadata: {},
      created_at: at(0),
    },
    {
      id: 'a1',
      conversation_id: 'c1',
      role: 'assistant',
      content: '# A few questions before I continue',
      job_id: 'j1',
      created_at: at(5),
      metadata: {
        resumable: true,
        clarification: {
          reason: 'The division changes the totals.',
          questions: [
            {
              id: 'division',
              kind: 'choice',
              prompt: 'Which division?',
              options: [{ label: 'BID' }, { label: 'LSG' }, { label: 'Other', is_other: true }],
            },
            {
              id: 'additional_context',
              kind: 'text',
              prompt: 'Anything else I should know?',
              required: false,
              is_extra: true,
            },
          ],
        },
      },
    },
  ];
  let status = 'waiting_for_input';
  let posted: unknown;
  const job = () => ({
    id: 'j1',
    organization_id: 'org1',
    job_type: 'chat_query',
    status,
    requested_by: 'u1',
    conversation_id: 'c1',
    input: {},
    result: null,
    attempt_count: 1,
    max_attempts: 3,
    cancel_requested_at: null,
    error_code: null,
    error_message: null,
    created_at: at(0),
    started_at: at(0),
    finished_at: null,
  });
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
    const url = new URL(route.request().url());
    const path = url.pathname;
    const page1 = <T>(items: T[]) => ({ items, next_cursor: null, has_more: false });
    let json: unknown = [];
    if (path.endsWith('/auth/me'))
      json = {
        id: 'u1',
        email: 't@example.com',
        display_name: 'Tester',
        is_active: true,
        created_at: at(0),
        updated_at: at(0),
      };
    else if (path.endsWith('/organizations'))
      json = [{ id: 'org1', name: 'Test', role: 'owner', created_at: at(0), updated_at: at(0) }];
    else if (path.endsWith('/clarification-answers')) {
      posted = route.request().postDataJSON();
      status = 'queued';
      messages.push({
        id: 'q2',
        conversation_id: 'c1',
        role: 'user',
        job_id: 'j1',
        created_at: at(20),
        content: 'Answers to your questions:\n- Which division? BID',
        metadata: {
          answers_message_id: 'a1',
          clarification_answers: [{ question_id: 'division', selected: ['BID'] }],
        },
      });
      return route.fulfill({ status: 202, json: { message_id: 'q2', job_id: 'j1' } });
    } else if (path.endsWith('/conversations/c1/messages')) json = page1(messages);
    else if (path.endsWith('/conversations/c1')) json = conversation;
    else if (path.endsWith('/conversations')) json = page1([conversation]);
    else if (path.endsWith('/jobs/j1')) json = job();
    else if (path.endsWith('/jobs'))
      json =
        url.searchParams.get('status') && url.searchParams.get('status') !== status ? [] : [job()];
    else if (path.includes('/events')) return route.abort();
    await route.fulfill({ json });
  });

  await page.goto('/conversations/c1');
  const card = page.getByRole('region', { name: 'Clarifying questions' });
  await expect(card.getByRole('button', { name: 'Cancel analysis' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ask a follow-up' })).toBeDisabled();
  await expect(card.getByRole('textbox', { name: 'Anything else I should know?' })).toBeVisible();

  await card.getByRole('radio', { name: 'BID' }).check();
  await card.getByRole('button', { name: 'Send answers' }).click();

  await expect
    .poll(() => posted)
    .toEqual({
      answers: [
        { question_id: 'division', selected: ['BID'] },
        { question_id: 'additional_context' },
      ],
    });
  await expect(card.getByRole('button', { name: 'Send answers' })).toHaveCount(0);
  await expect(card.getByText('BID', { exact: true })).toBeVisible();
  // The answers follow the card, and the resumed job's progress appears once, after them.
  const bubbles = page.locator('.user-bubble');
  await expect(bubbles).toHaveCount(2);
  await expect(bubbles.last()).toContainText('Which division? BID');
  const progress = page.getByLabel('Analysis in progress');
  await expect(progress).toHaveCount(1);
  const answersBox = await bubbles.last().boundingBox();
  const progressBox = await progress.boundingBox();
  expect(progressBox!.y).toBeGreaterThan(answersBox!.y);
});
