import { expect, type Locator } from '@playwright/test';

export async function checkArtifactHeader(artifact: Locator, kind: string) {
  const header = artifact.locator(':scope > .artifact-viewer-header');
  const content = artifact.locator(':scope > .artifact-frame-content');
  const toggle = header.locator('.artifact-header-toggle');
  await header.scrollIntoViewIfNeeded();
  const background = await header.evaluate((element) => getComputedStyle(element).backgroundColor);
  const expandedBounds = (await header.boundingBox())!;
  const titleBounds = (await header.locator('.artifact-heading').boundingBox())!;
  const titleY = titleBounds.y + titleBounds.height / 2 - expandedBounds.y;

  // Click the title/icon area, then the spare space before the action controls.
  await header.click({ position: { x: 24, y: titleY } });
  await expect(content).toHaveCount(0);
  await expect(toggle).toHaveAccessibleName(/^View /);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(header.getByRole('button', { name: `View ${kind}`, exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(header).toHaveCSS('background-color', background);
  expect((await header.boundingBox())!.height).toBeCloseTo(expandedBounds.height, 0);
  const headingBounds = (await header.locator('.artifact-heading').boundingBox())!;
  await header.click({
    position: {
      x: headingBounds.x + headingBounds.width - expandedBounds.x - 4,
      y: titleY,
    },
  });
  await expect(content).toBeVisible();
  await expect(header).toHaveCSS('background-color', background);

  await toggle.focus();
  await toggle.press('Space');
  await expect(content).toHaveCount(0);
  await toggle.press('Enter');
  await expect(content).toBeVisible();

  await artifact.page().evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}
