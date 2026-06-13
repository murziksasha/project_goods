import { test } from '@playwright/test';

test('login as admin', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('username').fill('admin');
  await page.getByPlaceholder('password').fill('admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'login-after-admin.png', fullPage: true });
});
