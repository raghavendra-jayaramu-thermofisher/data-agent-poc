import { expect, test } from '@playwright/test';
import combo from '../../test-fixtures/combo-chart.json' with { type: 'json' };

for (const { width, touch } of [
  { width: 1440, touch: false },
  { width: 390, touch: true },
]) {
  test.describe(`${width}px ${touch ? 'touch' : 'desktop'} conversation shell`, () => {
    test.use({ viewport: { width, height: 960 }, hasTouch: touch, isMobile: touch });
    test('keeps navigation, workspace controls and chat management accessible without app bars', async ({
      page,
    }) => {
      test.setTimeout(60000);
      const timestamp = '2026-10-17T00:00:00Z';
      const title = 'Weekly operations review';
      const tableId = '11111111-1111-4111-8111-111111111111';
      const chartId = '22222222-2222-4222-8222-222222222222';
      const source = {
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
        created_at: timestamp,
        updated_at: timestamp,
        active_file: null,
      };
      const conversation = {
        id: 'c1',
        organization_id: 'org1',
        created_by: 'u1',
        title,
        model_profile_id: null,
        data_source_ids: ['ds1'],
        table_scope: [
          {
            data_source_id: 'ds1',
            mode: 'selected',
            tables: [{ schema: 'public', name: 'shipments' }],
          },
        ],
        created_at: timestamp,
        updated_at: timestamp,
      };
      const messages = [
        {
          id: 'm1',
          conversation_id: 'c1',
          role: 'user',
          content: 'Show orders by channel and period.',
          job_id: 'j1',
          metadata: {},
          created_at: timestamp,
        },
        {
          id: 'm2',
          conversation_id: 'c1',
          role: 'assistant',
          content: `## Results\n\nHere are the results.\n\n[[artifact:${tableId}]]\n\n[[artifact:${chartId}]]\n\n## Scope\n\nReference results from the selected source.`,
          job_id: 'j1',
          metadata: {},
          created_at: timestamp,
        },
      ];
      const sql = [
        {
          id: 's1',
          columns: ['channel', 'orders'],
          row_count: 2,
          sql_text: 'SELECT channel, orders FROM channel_summary',
        },
        {
          id: combo.source_sql_execution_id,
          columns: Object.keys(combo.data[0]!),
          row_count: combo.data.length,
          sql_text: 'SELECT month, online, store, fulfilled, target FROM monthly_summary',
        },
      ].map((item) => ({
        ...item,
        tool_execution_id: 't1',
        data_source_id: 'ds1',
        status: 'succeeded',
        truncated: false,
        result_bytes: 1000,
        duration_ms: 120,
        error_code: null,
        error_message: null,
        started_at: timestamp,
        finished_at: timestamp,
      }));
      const artifacts = [
        {
          id: tableId,
          job_id: 'j1',
          kind: 'table',
          name: 'Orders by channel',
          source_sql_execution_id: 's1',
          created_at: timestamp,
          payload: {
            schema_version: 1,
            columns: ['channel', 'orders'],
            rows: [
              ['Online', 120],
              ['Store', 80],
            ],
            row_count: 2,
            truncated: false,
            display: 'expanded',
            data_source_id: 'ds1',
          },
        },
        {
          id: chartId,
          job_id: 'j1',
          kind: 'chart',
          name: combo.title,
          source_sql_execution_id: combo.source_sql_execution_id,
          created_at: timestamp,
          payload: combo,
        },
      ];
      const deleted: string[] = [];
      let loggedOut = false;
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
        if (path.endsWith('/auth/me') && loggedOut)
          return route.fulfill({ status: 401, json: { detail: 'Signed out' } });
        if (path.endsWith('/auth/me'))
          json = {
            id: 'u1',
            email: 'tester@example.com',
            display_name: 'Alex Morgan',
            is_active: true,
            created_at: timestamp,
            updated_at: timestamp,
          };
        else if (path.endsWith('/auth/logout')) {
          loggedOut = true;
          return route.fulfill({ status: 204 });
        } else if (path.endsWith('/organizations'))
          json = ['Operations', 'Research'].map((name, i) => ({
            id: `org${i + 1}`,
            name,
            role: 'owner',
            created_at: timestamp,
            updated_at: timestamp,
          }));
        else if (path.endsWith('/conversations/c1/messages')) json = messages;
        else if (path.endsWith('/conversations/c1')) {
          if (method === 'PATCH') {
            expect(route.request().postDataJSON()).toEqual({ title: 'Shipment review' });
            conversation.title = 'Shipment review';
            json = conversation;
          } else if (method === 'DELETE') {
            deleted.push('c1');
            return route.fulfill({ status: 204 });
          } else json = { ...conversation, messages };
        } else if (path.endsWith('/conversations'))
          json = deleted.includes('c1') ? [] : [conversation];
        else if (path.endsWith('/data-sources')) json = [source];
        else if (path.endsWith('/execution')) json = { tools: [], models: [], sql, artifacts };
        await route.fulfill({ json });
      });
      await page.goto('/conversations/c1');
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.locator('.topbar')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Scroll to top' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Scroll to bottom' })).toHaveCount(0);
      await expect(page.locator('.conversation-heading').getByText('Warehouse')).toHaveCount(0);
      await expect(page.locator('.app-shell')).toHaveCSS('background-image', /gradient/);
      await expect(page.locator('.sidebar-brand svg')).toHaveAttribute('viewBox', '0 0 24 24');
      const senderAvatar = page
        .locator('.chat-message-row.user')
        .getByRole('img', { name: 'Alex Morgan avatar' });
      await expect(senderAvatar).toHaveText('AM');
      const assistantLogo = page
        .locator('.chat-message-row.assistant')
        .getByRole('img', { name: 'Data Agent', exact: true });
      await expect(assistantLogo).toHaveAttribute('viewBox', '0 0 24 24');
      await expect(assistantLogo).toBeVisible();
      await expect(page.locator('.assistant-card')).toHaveCSS('border-top-width', '1px');
      await expect(page.locator('.assistant-card')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
      );
      await expect(page.getByRole('tablist', { name: 'Answer sections' })).toBeVisible();
      await expect(
        page.locator('.answer-section-tabs [data-slot="tabs-list-container"]'),
      ).toHaveCSS('border-bottom-width', '1px');
      await expect(page.locator('.analytical-chart .artifact-heading > svg')).toHaveCount(0);
      const activeTabBounds = (await page
        .getByRole('tab', { name: 'Full answer', exact: true })
        .boundingBox())!;
      const tabBarBounds = (await page
        .locator('.answer-section-tabs [data-slot="tabs-list-container"]')
        .boundingBox())!;
      expect(
        Math.abs(tabBarBounds.y + tabBarBounds.height - activeTabBounds.y - activeTabBounds.height),
      ).toBeLessThanOrEqual(1);

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      const user = page.locator('.user-bubble');
      const result = page.locator('.table-artifact');
      await expect(user).toHaveCSS('background-color', 'rgb(236, 238, 249)');
      await expect(result).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await expect(result).toHaveCSS('padding-left', '0px');
      await expect(result).toHaveCSS('border-top-width', '1px');
      await expect(result.getByRole('cell', { name: '120', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Present answer', exact: true }).click();
      const presentation = page.getByRole('dialog', { name: 'Answer presentation', exact: true });
      await expect(presentation.getByRole('heading', { name: messages[0]!.content, exact: true })).toBeVisible();
      const presentationPadding = await presentation.locator('.answer-main-content:visible').evaluate(
        (element) => parseFloat(getComputedStyle(element).paddingLeft),
      );
      expect(presentationPadding).toBeGreaterThanOrEqual(touch ? 16 : 40);
      await page.screenshot({ path: test.info().outputPath(`answer-presentation-${width}.png`), animations: 'disabled' });
      await presentation.getByRole('button', { name: 'Exit presentation' }).click();
      await expect(
        page.getByRole('img', { name: /Interactive Line \+ stacked columns/ }),
      ).toBeVisible();
      await page.locator('.main-content').evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({
        path: test.info().outputPath(`conversation-shell-${width}.png`),
        animations: 'disabled',
      });

      if (touch) await page.getByRole('button', { name: 'Open navigation' }).click();
      const primary = page.getByRole('navigation', { name: 'Primary navigation' });
      await expect(primary.getByRole('link')).toHaveCount(2);
      await expect(primary.getByRole('link', { name: 'Ask', exact: true })).toHaveCount(0);
      await primary.getByRole('button', { name: 'More navigation' }).click();
      const tools = page.getByRole('menu', { name: 'More navigation' });
      for (const tool of ['Knowledge', 'Templates', 'Models', 'Jobs']) {
        await expect(tools.getByRole('menuitem', { name: tool, exact: true })).toBeVisible();
      }
      await page.keyboard.press('Escape');
      if (touch) await page.getByRole('button', { name: 'Close navigation' }).click();

      const more = page.getByRole('button', { name: 'Conversation actions', exact: true });
      await more.click();
      await page.getByRole('menuitem', { name: 'Conversation details' }).click();
      const info = page.getByRole('dialog', { name: 'Conversation details' });
      await expect(info.getByText('Warehouse', { exact: true })).toBeVisible();
      await expect(info.getByText('public.shipments', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(more).toBeFocused();

      if (!touch) {
        const aside = page.getByRole('complementary', { name: 'Application sidebar' });
        expect((await aside.boundingBox())!.width).toBe(248);
        await page.getByRole('button', { name: 'Collapse sidebar' }).click();
        await expect(aside).toHaveCSS('width', '64px');
        await expect(aside.getByRole('button', { name: /Switch organization/ })).toBeVisible();
        await expect(aside.getByRole('button', { name: /User menu/ })).toBeVisible();
        await page.reload();
        await expect(aside).toHaveCSS('width', '64px');
        await page.screenshot({
          path: test.info().outputPath('collapsed-sidebar.png'),
          animations: 'disabled',
        });
        await page.getByRole('button', { name: 'Expand sidebar' }).click();
        await expect(
          page.getByRole('textbox', { name: 'Search conversation history' }),
        ).toBeVisible();
      } else {
        await page.getByRole('button', { name: 'Open navigation' }).click();
        const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
        await expect(drawer.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
        const footer = drawer.getByRole('contentinfo', { name: 'Workspace and account' });
        await expect(footer.getByRole('button', { name: /Switch organization/ })).toBeVisible();
        expect(
          (await footer.boundingBox())!.y + (await footer.boundingBox())!.height,
        ).toBeLessThanOrEqual(960);
        await drawer.screenshot({
          path: test.info().outputPath('mobile-sidebar.png'),
          animations: 'disabled',
        });
      }
      const sidebar = touch
        ? page.getByRole('dialog', { name: 'Navigation', exact: true })
        : page.getByRole('complementary', { name: 'Application sidebar' });
      const chatRow = sidebar.locator('.sidebar-chat-row').first();
      await expect(chatRow.locator('a svg')).toHaveCount(0);
      if (!touch) await chatRow.hover();
      await chatRow.getByRole('button', { name: `Actions for ${title}` }).click();
      await page.getByRole('menuitem', { name: 'Rename chat' }).click();
      const rename = page.getByRole('dialog', { name: 'Rename chat' });
      await rename.getByRole('textbox', { name: 'Chat title' }).fill('Shipment review');
      await rename.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(rename).toHaveCount(0);
      if (touch) await page.keyboard.press('Escape');
      await expect(
        page.getByRole('heading', { name: 'Shipment review', exact: true }),
      ).toBeVisible();

      await more.click();
      await page.getByRole('menuitem', { name: 'Delete chat' }).click();
      const confirm = page.getByRole('dialog', { name: 'Delete chat', exact: true });
      await confirm.getByRole('button', { name: 'Cancel' }).click();
      expect(deleted).toEqual([]);
      await expect(more).toBeFocused();
      await more.click();
      await page.getByRole('menuitem', { name: 'Delete chat' }).click();
      await confirm.getByRole('button', { name: 'Delete chat', exact: true }).click();
      await expect(page).toHaveURL(/\/ask$/);
      expect(deleted).toEqual(['c1']);
      await expect(
        page.getByRole('heading', { name: 'What would you like to know about your data?' }),
      ).toBeVisible();
      await page.screenshot({
        path: test.info().outputPath(`new-analysis-${width}.png`),
        animations: 'disabled',
      });
      if (touch) await page.getByRole('button', { name: 'Open navigation' }).click();
      await sidebar.getByRole('button', { name: /User menu/ }).click();
      await page.getByRole('menuitem', { name: 'Display settings', exact: true }).click();
      const displaySettings = page.getByRole('dialog', { name: 'Display settings', exact: true });
      await expect(displaySettings.getByRole('switch', { name: 'Show Jobs' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(displaySettings).toHaveCount(0);
      if (touch) await page.getByRole('button', { name: 'Open navigation' }).click();
      await sidebar.getByRole('button', { name: /User menu/ }).click();
      await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
      const settingsHeading = page.getByRole('heading', {
        name: 'Workspace Settings',
        exact: true,
      });
      await expect(settingsHeading).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: 'Settings navigation' }).getByRole('link'),
      ).toHaveCount(3);
      if (touch) {
        expect((await settingsHeading.boundingBox())!.y).toBeGreaterThan(64);
        await page.getByRole('button', { name: 'Open navigation' }).click();
      }
      await sidebar.getByRole('button', { name: 'New chat', exact: true }).click();
      await expect(page).toHaveURL(/\/ask$/);
      if (touch) await page.getByRole('button', { name: 'Open navigation' }).click();
      await sidebar.getByRole('button', { name: /Switch organization/ }).click();
      await page.getByRole('menuitemradio', { name: 'Research' }).click();
      await expect(page.getByRole('menu', { name: 'Switch organization' })).toHaveCount(0);
      if (touch) await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(
        sidebar.getByRole('button', { name: 'Switch organization: Research' }),
      ).toBeVisible();
      await sidebar.getByRole('button', { name: /User menu/ }).click();
      await page.getByRole('menuitem', { name: 'Sign out' }).click();
      await expect.poll(() => loggedOut).toBe(true);
      await expect(page).toHaveURL(/\/login$/);
      expect(loggedOut).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}
