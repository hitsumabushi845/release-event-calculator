import { test, expect } from '@playwright/test';

test('default state computes a solution', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'リリースイベント計算機' })).toBeVisible();
  // Default: unit 1000, target 10, CD price 1500 → cheapest 10500yen / 7 CDs
  await expect(page.getByText('最安')).toBeVisible();
  await expect(page.getByText('10,500')).toBeVisible();
});
