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
    await expect(
      dialog.getByText(/this is a large amount|велика сума/i),
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
