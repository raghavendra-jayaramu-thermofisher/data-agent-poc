import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 764 },
  { width: 390, height: 844 },
]) {
  test(
    'template library and editor remain usable at ' + viewport.width + 'px',
    async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const time = '2026-10-18T00:00:00Z';
      const makeTemplate = (
        id: string,
        name: string,
        description: string | null,
        command: string | null,
        is_default = false,
        enabled = true,
      ) => ({
        id,
        name,
        description,
        command,
        is_default,
        enabled,
        content:
          'Lead with the direct answer. Include the reporting period, show the supporting data, and explain any limitations.\n\nUse the workspace definitions for backlog and stock availability.',
        prompt_template: command ? 'Analyze the backlog for: {prompt}' : null,
        organization_id: 'org1',
        created_by: 'u1',
        created_at: time,
        updated_at: time,
      });
      let templates = [
        makeTemplate('default', 'Reporting rules', null, null, true),
        makeTemplate(
          'drivers',
          'Backlog drivers and concentration',
          'Identify where backlog is concentrated across regions, customers, and products, and highlight the largest contributors.',
          'backlog-drivers',
        ),
        makeTemplate(
          'risk',
          'Backlog risk and attention',
          'Prioritize risks using backlog value, aging, stock availability, and operational exposure.',
          'backlog-risks',
        ),
        makeTemplate(
          'trend',
          'Backlog trend analysis',
          'Compare weekly movements and explain whether the backlog is improving or deteriorating.',
          'backlog-trend',
        ),
        makeTemplate(
          'weekly',
          'Weekly backlog changes',
          'Explain the largest improvements and deteriorations between two weekly snapshots.',
          'backlog-changes',
        ),
        makeTemplate(
          'disabled',
          'Quarterly review',
          'Summarize performance across the quarter.',
          'quarterly-review',
          false,
          false,
        ),
      ];
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
          json = [
            { id: 'org1', name: 'Operations', role: 'owner', created_at: time, updated_at: time },
          ];
        else if (path.endsWith('/instructions')) {
          if (method === 'POST') {
            const created = {
              ...makeTemplate('created', '', null, null),
              ...route.request().postDataJSON(),
            };
            templates.push(created);
            json = created;
          } else json = templates;
        } else if (path.includes('/instructions/')) {
          const id = path.split('/').pop();
          if (method === 'DELETE') {
            templates = templates.filter((item) => item.id !== id);
            return route.fulfill({ status: 204 });
          }
          const body = route.request().postDataJSON();
          templates = templates.map((item) => ({
            ...item,
            ...(body.is_default ? { is_default: false } : {}),
            ...(item.id === id ? body : {}),
          }));
          json = templates.find((item) => item.id === id);
        }
        await route.fulfill({ json });
      });
      await page.goto('/skills');
      await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
      await expect(page.locator('.template-card')).toHaveCount(6);
      await expect(page.locator('.template-card').first()).toHaveAccessibleName('Reporting rules');
      await expect(page.getByText('Disabled', { exact: true })).toBeVisible();
      expect(
        await page
          .locator('.main-content')
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath('templates-' + viewport.width + '.png'),
        fullPage: true,
      });

      const card = page.getByRole('article', { name: 'Backlog drivers and concentration' });
      await expect(card.locator('p')).toHaveCount(0);
      await expect(card.getByRole('button')).toHaveCount(1);
      await card.getByRole('button', { name: /More actions/ }).click();
      await page.getByRole('menuitem', { name: 'View instructions', exact: true }).click();
      const viewer = page.getByRole('dialog', {
        name: 'Template instructions: Backlog drivers and concentration',
        exact: true,
      });
      await expect(viewer.locator('pre')).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator('.template-editor-backdrop')
            .evaluate(
              (element) =>
                element
                  .getAnimations({ subtree: true })
                  .filter((animation) => animation.playState === 'running').length,
            ),
        )
        .toBe(0);
      await page.screenshot({
        path: testInfo.outputPath('template-viewer-' + viewport.width + '.png'),
        fullPage: true,
      });
      await viewer.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(viewer).not.toBeVisible();
      await page
        .getByRole('button', { name: 'More actions for Reporting rules', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'View instructions', exact: true }).click();
      const defaultViewer = page.getByRole('dialog', {
        name: 'Template instructions: Reporting rules',
        exact: true,
      });
      await expect(
        defaultViewer
          .locator('.template-editor-header')
          .getByText('Workspace default', { exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator('.template-editor-backdrop')
            .evaluate(
              (element) =>
                element
                  .getAnimations({ subtree: true })
                  .filter((animation) => animation.playState === 'running').length,
            ),
        )
        .toBe(0);
      await page.screenshot({
        path: testInfo.outputPath('template-default-viewer-' + viewport.width + '.png'),
        fullPage: true,
      });
      await defaultViewer.getByRole('button', { name: 'Close', exact: true }).click();
      const search = page.getByRole('searchbox', { name: 'Search templates' });
      await search.focus();
      await expect(search).toHaveCSS('outline-style', 'none');
      await expect(search).toHaveCSS('box-shadow', 'none');
      await expect(page.locator('.templates-search')).not.toHaveCSS('box-shadow', 'none');
      if (viewport.width > 640) {
        const titleBox = (await page.locator('.templates-heading').boundingBox())!;
        const searchBox = (await page.locator('.templates-search').boundingBox())!;
        const buttonBox = (await page
          .getByRole('button', { name: 'New template', exact: true })
          .boundingBox())!;
        expect(
          Math.abs(titleBox.y + titleBox.height / 2 - searchBox.y - searchBox.height / 2),
        ).toBeLessThan(2);
        expect(
          Math.abs(buttonBox.y + buttonBox.height / 2 - searchBox.y - searchBox.height / 2),
        ).toBeLessThan(2);
      }
      await page.getByRole('searchbox', { name: 'Search templates' }).fill('backlog-trend');
      await expect(page.locator('.template-card')).toHaveCount(1);
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();

      const newButton = page.getByRole('button', { name: 'New template', exact: true });
      await newButton.click();
      const dialog = page.getByRole('dialog', { name: 'New template', exact: true });
      await expect(dialog).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator('.template-editor-backdrop')
            .evaluate(
              (element) =>
                element
                  .getAnimations({ subtree: true })
                  .filter((animation) => animation.playState === 'running').length,
            ),
        )
        .toBe(0);
      await expect(
        dialog.getByRole('textbox', { name: 'Template name', exact: true }),
      ).toBeFocused();
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(3);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
      const geometry = await dialog.evaluate((element) => ({
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflow: Array.from(element.querySelectorAll('*'))
          .filter(
            (child) =>
              child.getBoundingClientRect().right > element.getBoundingClientRect().right + 1,
          )
          .map((child) => ({
            tag: child.tagName,
            className: child.className,
            width: child.getBoundingClientRect().width,
          })),
      }));
      expect(geometry.scrollWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(
        geometry.width + 1,
      );
      const footer = await dialog.locator('.template-editor-footer').boundingBox();
      await page.screenshot({
        path: testInfo.outputPath('template-editor-' + viewport.width + '.png'),
        fullPage: true,
      });
      await dialog.getByRole('button', { name: 'Save template', exact: true }).click();
      await expect(dialog.getByText('Enter a template name.')).toBeVisible();
      await dialog
        .getByRole('textbox', { name: 'Template name', exact: true })
        .fill('Monthly review');
      await dialog
        .getByRole('textbox', { name: 'Instructions', exact: true })
        .fill('Compare the month with the previous period.');
      await dialog
        .getByRole('textbox', { name: 'Slash command', exact: true })
        .fill('monthly-review');
      await dialog.getByText('Template enabled', { exact: true }).click();
      await dialog.getByText('Workspace default', { exact: true }).click();
      await expect(
        dialog.getByRole('switch', { name: 'Template enabled', exact: true }),
      ).toBeChecked();
      await expect(
        dialog.getByRole('switch', { name: 'Template enabled', exact: true }),
      ).toBeDisabled();
      const option = dialog.locator('.template-option').first();
      const textBox = await option.locator('.template-option-copy').boundingBox();
      const controlBox = await option.locator('.switch__control').boundingBox();
      expect(controlBox!.x).toBeGreaterThan(textBox!.x + textBox!.width);
      expect(controlBox!.y).toBeLessThan(textBox!.y + textBox!.height);
      expect((await dialog.locator('.template-editor-footer').boundingBox())!.y).toBeCloseTo(
        footer!.y,
        0,
      );
      await page.screenshot({
        path: testInfo.outputPath('template-settings-' + viewport.width + '.png'),
        fullPage: true,
      });
      await dialog.getByRole('button', { name: 'Save template', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole('article', { name: 'Monthly review', exact: true }),
      ).toBeVisible();

      await page
        .getByRole('button', { name: 'More actions for Monthly review', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Edit template', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Instructions', exact: true })).toHaveValue(
        'Compare the month with the previous period.',
      );
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page
        .getByRole('button', { name: 'More actions for Monthly review', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Delete template', exact: true }).click();
      const confirmation = page.getByRole('alertdialog', { name: 'Delete template?', exact: true });
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole('button', { name: 'Delete template', exact: true }).click();
      await expect(confirmation).not.toBeVisible();
      await expect(
        page.getByRole('article', { name: 'Monthly review', exact: true }),
      ).not.toBeVisible();
      expect(errors).toEqual([]);
    },
  );
}
