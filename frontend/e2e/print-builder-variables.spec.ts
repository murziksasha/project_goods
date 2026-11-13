import { expect, test, type Page } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const openPrintBuilder = async (page: Page) => {
  await installE2eApiMocks(page);
  await page.addInitScript((employee) => {
    localStorage.setItem('project-goods.lang', 'en');
    localStorage.setItem('project-goods.auth-token', 'e2e-token');
    localStorage.setItem('project-goods.employee-snapshot', JSON.stringify(employee));
  }, e2eEmployee);

  await page.goto('/?page=settings');
  await page.locator('#settings-tab-print').click();
};

test('Template variables collapses and expands via mouse and keyboard across Heading, Text, and Barcode', async ({
  page,
}) => {
  await openPrintBuilder(page);

  const templateSelect = page.locator('.settings-print-document-select select');
  const toggleButton = page.getByRole('button', { name: 'Template variables' });
  const variableGrid = page.locator('.settings-variable-grid');
  const variableGroups = page.locator('.settings-variable-group');

  // 1. Text editor (Receipt starts on a Text block) — default expanded
  await expect(toggleButton).toBeVisible();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  await expect(variableGrid).toBeVisible();
  const groupCount = await variableGroups.count();
  expect(groupCount).toBeGreaterThan(1);

  // Mouse click collapses all variable groups together; heading remains visible
  await toggleButton.click();
  await expect(toggleButton).toBeVisible();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  await expect(variableGrid).toHaveCount(0);
  await expect(variableGroups).toHaveCount(0);

  // Mouse click again restores all variable groups and insertion still works
  await toggleButton.click();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  await expect(variableGroups).toHaveCount(groupCount);

  const textArea = page.locator('.print-builder-block-editor textarea');
  const beforeText = await textArea.inputValue();
  await page.getByRole('button', { name: /\{\{orderNumber\}\}/ }).click();
  await expect(textArea).toHaveValue(`${beforeText}{{orderNumber}}`);

  // 2. Heading editor (Check starts on a Heading block) — keyboard Enter & Space
  await templateSelect.selectOption('check');
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  await expect(variableGroups).toHaveCount(groupCount);

  await toggleButton.focus();
  await expect(toggleButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  await expect(variableGroups).toHaveCount(0);

  await page.keyboard.press('Space');
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  await expect(variableGroups).toHaveCount(groupCount);

  const headingInput = page.locator('.print-builder-block-editor .print-formatted-field input');
  const beforeHeading = await headingInput.inputValue();
  await page.getByRole('button', { name: /\{\{clientName\}\}/ }).click();
  await expect(headingInput).toHaveValue(`${beforeHeading}{{clientName}}`);

  // Collapse in Check, reopen the print form editor, and confirm it resets to expanded
  await toggleButton.click();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#settings-tab-company').click();
  await page.locator('#settings-tab-print').click();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  await expect(variableGroups).toHaveCount(groupCount);

  // 3. Barcode editor — add a Barcode block, collapse, expand, and insert into Value
  await page.locator('.print-builder-toolbar').getByRole('button', { name: 'Barcode' }).click();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  await expect(variableGroups).toHaveCount(groupCount);

  await toggleButton.click();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  await expect(variableGroups).toHaveCount(0);

  await toggleButton.click();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  await expect(variableGroups).toHaveCount(groupCount);

  const valueField = page.getByRole('textbox', { name: 'Value', exact: true });
  const beforeBarcode = await valueField.inputValue();
  await page.getByRole('button', { name: /\{\{labelCode\}\}/ }).click();
  await expect(valueField).toHaveValue(`${beforeBarcode}{{labelCode}}`);
});
