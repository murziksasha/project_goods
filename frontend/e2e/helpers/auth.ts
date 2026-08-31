import { expect, type Page } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './mock-api';

export const bootAuthenticatedApp = async (
  page: Page,
  path = '/?page=accounting&accountingTab=cashboxes',
) => {
  await installE2eApiMocks(page);
  await page.addInitScript((employee) => {
    window.localStorage.setItem('project-goods.lang', 'en');
    window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
    window.localStorage.setItem(
      'project-goods.employee-snapshot',
      JSON.stringify(employee),
    );
  }, e2eEmployee);
  await page.goto(path);
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
};
