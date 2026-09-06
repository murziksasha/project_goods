import { expect, test } from '@playwright/test';

test('login form renders when logged out', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('project-goods.lang', 'en');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
