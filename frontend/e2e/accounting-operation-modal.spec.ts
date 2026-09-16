import { expect, test } from '@playwright/test';
import { bootAuthenticatedApp } from './helpers/auth';

test.describe('Cashbox operation modal', () => {
  test('shows Confirm and Confirm and close, no large-amount warning', async ({
    page,
  }) => {
    await bootAuthenticatedApp(page);

    await expect(page.getByRole('button', { name: 'Add cashbox' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Operation' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const confirm = dialog.getByRole('button', { name: 'Confirm', exact: true });
    const confirmAndClose = dialog.getByRole('button', {
      name: 'Confirm and close',
      exact: true,
    });

    await expect(confirm).toBeVisible();
    await expect(confirmAndClose).toBeVisible();
    await expect(confirm).toHaveClass(/finance-operation-confirm-stay/);
    await expect(confirmAndClose).toHaveClass(/primary-button/);
    await expect(dialog.getByRole('heading', { name: 'Withdraw' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Type' })).toHaveValue(
      'withdraw',
    );
    await expect(dialog.getByRole('combobox', { name: 'From cashbox' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'To cashbox' })).toHaveCount(0);
    await expect(
      dialog.getByText(/this is a large amount|велика сума/i),
    ).toHaveCount(0);
    await dialog.locator('.finance-category-select-trigger').click();
    await expect(dialog.getByRole('option', { name: 'Rent' })).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Add category', exact: true }),
    ).toBeVisible();
    await expect(confirmAndClose).toBeVisible();

    const modalScroll = await dialog.evaluate((element) => {
      const style = getComputedStyle(element);
      const canScroll =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        element.scrollHeight > element.clientHeight + 1;
      return { canScroll, overflowY: style.overflowY };
    });
    expect(modalScroll.canScroll).toBe(false);

    const listMetrics = await dialog
      .locator('.finance-category-options')
      .evaluate((element) => {
        const option = element.querySelector('.finance-category-option');
        const optionHeight = option instanceof HTMLElement ? option.offsetHeight : 36;
        return {
          overflowY: getComputedStyle(element).overflowY,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          optionCount: element.querySelectorAll('.finance-category-option').length,
          optionHeight,
        };
      });
    expect(listMetrics.overflowY).toBe('auto');
    expect(listMetrics.optionCount).toBeGreaterThan(5);
    expect(listMetrics.scrollHeight).toBeGreaterThan(listMetrics.clientHeight);
    expect(listMetrics.clientHeight).toBeLessThanOrEqual(
      listMetrics.optionHeight * 5 + 16,
    );
  });

  test('category menu does not scroll the operation modal on a phone viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootAuthenticatedApp(page);
    await page.getByRole('button', { name: 'Operation' }).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('.finance-category-select-trigger').click();
    await expect(dialog.getByRole('option', { name: 'Rent' })).toBeVisible();

    const modalScroll = await dialog.evaluate((element) => {
      const style = getComputedStyle(element);
      const body = element.querySelector('.catalog-edit-body');
      const bodyStyle = body ? getComputedStyle(body) : null;
      const canScroll = (overflowY: string, node: Element) =>
        (overflowY === 'auto' || overflowY === 'scroll') &&
        node.scrollHeight > (node as HTMLElement).clientHeight + 1;
      return {
        dialog: canScroll(style.overflowY, element),
        body: body && bodyStyle ? canScroll(bodyStyle.overflowY, body) : false,
      };
    });
    expect(modalScroll.dialog).toBe(false);
    expect(modalScroll.body).toBe(false);
    await expect(
      dialog.getByRole('button', { name: 'Confirm', exact: true }),
    ).toBeVisible();
  });

  test('category settings expose Save for a renamed row', async ({ page }) => {
    await bootAuthenticatedApp(page);
    await page.getByRole('button', { name: 'Accounting settings' }).click();
    await page.getByRole('button', { name: 'Categories' }).click();

    await expect(page.locator('input[data-category-slug="client_payment"]')).toBeDisabled();
    await expect(page.locator('input[data-category-slug="other"]')).toBeDisabled();

    const rentInput = page.locator('input[data-category-slug="rent"]');
    await expect(rentInput).toBeEnabled();
    await expect(rentInput).toHaveValue('Rent');
    await rentInput.fill('Office rent');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(rentInput).toHaveValue('Office rent');
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });

  test('category settings delete removes a used custom category', async ({ page }) => {
    await bootAuthenticatedApp(page);
    await page.getByRole('button', { name: 'Accounting settings' }).click();
    await page.getByRole('button', { name: 'Categories' }).click();

    const adsRow = page.locator('.finance-currency-activity-item').filter({
      has: page.locator('input[data-category-slug="c_aaaaaaaaaaaaaaaaaaaaaaaa"]'),
    });
    await expect(adsRow.getByRole('button', { name: 'Delete' })).toBeEnabled();
    await adsRow.getByRole('button', { name: 'Delete' }).click();
    await expect(
      page.locator('input[data-category-slug="c_aaaaaaaaaaaaaaaaaaaaaaaa"]'),
    ).toHaveCount(0);
  });

  test('Confirm keeps the modal open; Confirm and close dismisses it', async ({
    page,
  }) => {
    await bootAuthenticatedApp(page);
    await page.getByRole('button', { name: 'Operation' }).first().click();

    const dialog = page.getByRole('dialog');
    const amount = dialog.getByRole('textbox', { name: 'Amount' });

    await amount.fill('100');
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(amount).toHaveValue('', { timeout: 10_000 });

    await amount.fill('50');
    await dialog
      .getByRole('button', { name: 'Confirm and close', exact: true })
      .click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });
});
