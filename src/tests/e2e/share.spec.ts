import { test, expect } from '@playwright/test';

test('share URL restores state', async ({ page, context }) => {
  await page.goto('/');
  // Wait for initial calculation + debounce
  await expect(page.getByText('最安')).toBeVisible();
  // The URL should now contain ?s=
  await page.waitForFunction(() => window.location.search.includes('s='));
  const sharedUrl = page.url();
  const fresh = await context.newPage();
  await fresh.goto(sharedUrl);
  await expect(fresh.getByText('最安')).toBeVisible();
});
