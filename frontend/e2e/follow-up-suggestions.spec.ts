import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`suggestions survive reload and submit without losing drafts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const timestamp = '2026-10-09T00:00:00Z';
    const conversation = { id: 'c1', organization_id: 'org1', created_by: 'u1', title: 'Customer report', model_profile_id: null, data_source_ids: ['ds1'], table_scope: [{ data_source_id: 'ds1', mode: 'selected', tables: [{ schema: 'dbo', name: 'orders' }] }], created_at: timestamp, updated_at: timestamp };
    const messages = [{ id: 'm1', conversation_id: 'c1', role: 'assistant', content: '# Customer report\n\n## Summary\n\nOrders increased.\n\n## Detail\n\nVerified current snapshot.', job_id: 'j1', metadata: { follow_up_suggestions: ['Compare orders with last week.', 'Break down orders by region.', 'How do the missing order amounts affect the completeness of the reported totals for the current snapshot?'] }, created_at: timestamp }];
    const source = { id: 'ds1', organization_id: 'org1', name: 'Warehouse', kind: 'mssql', display_type: 'mssql', status: 'active', config: {}, created_by: 'u1', last_tested_at: null, last_error_code: null, created_at: timestamp, updated_at: timestamp, active_file: null };
    let submitted = 0;
    await page.addInitScript(() => sessionStorage.setItem('db-assistant.auth.v1', JSON.stringify({ access_token: 'mock', refresh_token: 'mock', token_type: 'bearer', expires_in: 900 })));
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = [];
      if (path.endsWith('/auth/me')) json = { id: 'u1', email: 'tester@example.com', display_name: 'Tester', is_active: true, created_at: timestamp, updated_at: timestamp };
      else if (path.endsWith('/organizations')) json = [{ id: 'org1', name: 'Test workspace', role: 'owner', created_at: timestamp, updated_at: timestamp }];
      else if (path.endsWith('/conversations/c1/messages') && route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({ content: 'Compare orders with last week.', model_profile_id: null });
        submitted++;
        return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Please retry.' } } });
      } else if (path.endsWith('/conversations/c1/messages')) json = messages;
      else if (path.endsWith('/conversations/c1')) json = { ...conversation, messages };
      else if (path.endsWith('/conversations')) json = [conversation];
      else if (path.endsWith('/data-sources')) json = [source];
      else if (path.endsWith('/execution')) json = { tools: [], models: [], sql: [], artifacts: [] };
      await route.fulfill({ json });
    });
    await page.goto('/conversations/c1');
    await expect(page.getByRole('region', { name: 'Suggested follow-ups' })).toBeVisible();
    await page.reload();
    const suggestions = page.getByRole('region', { name: 'Suggested follow-ups' });
    await expect(suggestions).toBeVisible();
    await expect(suggestions.getByRole('heading', { name: 'Ask next' })).toBeVisible();
    await expect(suggestions.getByRole('button')).toHaveCount(3);
    expect(await suggestions.evaluate((element) => element.closest('.assistant-card'))).toBeNull();
    expect(await suggestions.evaluate((element) => element.previousElementSibling?.classList.contains('assistant-card'))).toBe(true);
    await page.getByRole('tab', { name: 'Detail', exact: true }).click();
    await expect(suggestions).toBeVisible();
    const input = page.getByRole('textbox', { name: 'Ask a follow-up' });
    await input.fill('My own draft');
    const button = suggestions.getByRole('button', { name: 'Compare orders with last week.' });
    await button.scrollIntoViewIfNeeded();
    const bounds = await button.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const lastButton = suggestions.getByRole('button').last();
    const lastBounds = await lastButton.boundingBox();
    expect(lastBounds!.y).toBeGreaterThan(bounds!.y + bounds!.height);
    expect(lastBounds!.x + lastBounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`suggestions-${width}.png`), animations: 'disabled' });
    await button.click();
    await expect(suggestions.getByRole('alert')).toContainText('Please try again');
    expect(submitted).toBe(1);
    await expect(input).toHaveValue('My own draft');
    await button.click();
    await expect.poll(() => submitted).toBe(2);
    await expect(input).toHaveValue('My own draft');
    await page.getByRole('button', { name: 'Present answer', exact: true }).click();
    await expect(suggestions).toHaveCount(0);
    await page.getByRole('button', { name: 'Exit presentation', exact: true }).click();
    await expect(suggestions).toBeVisible();
  });
}
