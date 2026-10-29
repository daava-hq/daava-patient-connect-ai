import { test, expect } from '@playwright/test';

test('home page has correct title and heading', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Patient Connect');
  await expect(page.getByRole('heading', { name: 'Patient Connect' })).toBeVisible();
});
