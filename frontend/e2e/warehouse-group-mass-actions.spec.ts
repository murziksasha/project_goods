import { expect, test } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-08-31T12:00:00.000Z';

const mockWarehouseSettings = {
  id: 'ws-1',
  serviceCenters: [],
  warehouses: [
    {
      id: 'wh-1',
      name: 'Main Warehouse',
      isActive: true,
      serviceCenterId: 'sc-1',
      receiptAddress: '',
      receiptPhone: '',
      locations: [
        { id: 'loc-1', name: 'Shelf 1' },
        { id: 'loc-2', name: 'Shelf 2' },
      ],
    },
    {
      id: 'wh-2',
      name: 'Second Warehouse',
      isActive: true,
      serviceCenterId: 'sc-1',
      receiptAddress: '',
      receiptPhone: '',
      locations: [{ id: 'loc-3', name: 'Shelf 3' }],
    },
  ],
  administrators: [],
  createdAt: iso,
  updatedAt: iso,
};

test.describe('Warehouse group mass actions', () => {
  test('exercises group checkbox indeterminate, group transfer with stays & remove, child transfer replace, group delete confirm, and units view compatibility', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    let products = [
      {
        id: 'p-1',
        name: 'TerraE 30E INR18650 3000mAh',
        article: 'ART-BAT-1',
        serialNumber: 'S000001',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        costPrice: 5,
        retailPrice: 10,
        wholesalePrice: 8,
        quantity: 1,
        createdAt: iso,
        updatedAt: iso,
      },
      {
        id: 'p-2',
        name: 'TerraE 30E INR18650 3000mAh',
        article: 'ART-BAT-1',
        serialNumber: 'S000002',
        warehouseId: 'wh-1',
        locationId: 'loc-2',
        costPrice: 5,
        retailPrice: 10,
        wholesalePrice: 8,
        quantity: 1,
        createdAt: iso,
        updatedAt: iso,
      },
      {
        id: 'p-3',
        name: 'TerraE 30E INR18650 3000mAh',
        article: 'ART-BAT-1',
        serialNumber: 'S000003',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        costPrice: 5,
        retailPrice: 10,
        wholesalePrice: 8,
        quantity: 1,
        createdAt: iso,
        updatedAt: iso,
      },
      {
        id: 'p-4',
        name: 'TerraE 30E INR18650 3000mAh',
        article: 'ART-BAT-1',
        serialNumber: 'S000004',
        warehouseId: 'wh-1',
        locationId: 'loc-2',
        costPrice: 5,
        retailPrice: 10,
        wholesalePrice: 8,
        quantity: 1,
        createdAt: iso,
        updatedAt: iso,
      },
      {
        id: 'p-single',
        name: 'Solo Display Panel',
        article: 'ART-SOLO-1',
        serialNumber: 'S000099',
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        costPrice: 50,
        retailPrice: 100,
        wholesalePrice: 80,
        quantity: 1,
        createdAt: iso,
        updatedAt: iso,
      },
    ];

    await installE2eApiMocks(page);

    await page.route(
      (url) => url.pathname.includes('/api/warehouse-settings'),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockWarehouseSettings),
        });
      },
    );

    await page.route(
      (url) => url.pathname.includes('/api/products'),
      async (route) => {
        const req = route.request();
        const method = req.method();
        const urlObj = new URL(req.url());
        const id = urlObj.pathname.split('/').pop();

        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(products),
          });
          return;
        }

        if (method === 'PATCH' && id) {
          const payload = req.postDataJSON() ?? {};
          products = products.map((p) =>
            p.id === id ? { ...p, ...payload, updatedAt: new Date().toISOString() } : p,
          );
          const updated = products.find((p) => p.id === id);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(updated),
          });
          return;
        }

        if (method === 'DELETE' && id) {
          products = products.filter((p) => p.id !== id);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
          return;
        }

        await route.fulfill({ status: 200, body: JSON.stringify({}) });
      },
    );

    // Initial auth
    await page.addInitScript((employee) => {
      window.localStorage.setItem('project-goods.lang', 'en');
      window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
      window.localStorage.setItem(
        'project-goods.employee-snapshot',
        JSON.stringify(employee),
      );
    }, e2eEmployee);

    // Open Warehouse -> Stock balances
    await page.goto('/?page=warehouse&warehouseTab=stock');
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });

    // Verify Models view is active
    const groupRow = page.locator('tr', { hasText: 'TerraE 30E INR18650 3000mAh' }).first();
    await expect(groupRow).toBeVisible();

    // Group checkbox
    const groupCheckbox = groupRow.locator('input[type="checkbox"]').first();
    await expect(groupCheckbox).not.toBeChecked();

    // Group row Action cell should not render kebab yet (0 checks in group)
    const initialGroupKebab = groupRow.locator('.warehouse-row-menu-toggle');
    await expect(initialGroupKebab).toHaveCount(0);

    // Expand the group row to see children
    const expandButton = groupRow.locator('.warehouse-expand-button');
    await expandButton.click();

    // Find children serial rows
    const childRow1 = page.locator('tr', { hasText: 'S000001' });
    const childRow2 = page.locator('tr', { hasText: 'S000002' });
    const childRow3 = page.locator('tr', { hasText: 'S000003' });
    await expect(childRow1).toBeVisible();
    await expect(childRow2).toBeVisible();
    await expect(childRow3).toBeVisible();

    // Check 3 of the 4 units
    await childRow1.locator('input[type="checkbox"]').check();
    await childRow2.locator('input[type="checkbox"]').check();
    await childRow3.locator('input[type="checkbox"]').check();

    // Group checkbox must be indeterminate (3 of 4 selected)
    const isIndeterminate = await groupCheckbox.evaluate(
      (el: HTMLInputElement) => el.indeterminate,
    );
    expect(isIndeterminate).toBe(true);

    // Group row kebab must now be visible!
    await expect(initialGroupKebab).toBeVisible();

    // Open group kebab menu
    await initialGroupKebab.click();
    const portalMenu = page.locator('.warehouse-row-menu-panel-portal');
    await expect(portalMenu).toBeVisible();
    await expect(portalMenu.locator('button', { hasText: 'Transfer' })).toBeVisible();
    await expect(portalMenu.locator('button', { hasText: 'Delete' })).toBeVisible();

    // Click Transfer
    await portalMenu.locator('button', { hasText: 'Transfer' }).click();

    // Verify batch mode in Transfers tab
    await expect(page.locator('.warehouse-transfer-panel')).toBeVisible();
    // Dropdown for single product is hidden in batch mode
    await expect(page.locator('.warehouse-transfer-form select', { hasText: 'Select stock item' })).toHaveCount(0);

    // Batch table title is visible
    await expect(page.locator('.warehouse-transfer-section-title', { hasText: 'Batch stock to move' })).toBeVisible();

    // Batch table lists the 3 checked products
    const batchRows = page.locator('.warehouse-transfer-row');
    await expect(batchRows).toHaveCount(3);
    await expect(page.locator('text=S000001')).toBeVisible();
    await expect(page.locator('text=S000002')).toBeVisible();
    await expect(page.locator('text=S000003')).toBeVisible();

    // Target warehouse & location: choose wh-1 / Shelf 1 (loc-1)
    // S000001 and S000003 are already at wh-1 / loc-1 -> they should become "Stays"
    const targetWhSelect = page.locator('label:has-text("Target warehouse") select');
    await targetWhSelect.selectOption('wh-1');
    const targetLocSelect = page.locator('label:has-text("Target location") select');
    await targetLocSelect.selectOption('loc-1');

    // Verify "Stays" markers appear for S000001 and S000003
    const stayBadges = page.locator('.warehouse-data-badge-stay');
    await expect(stayBadges).toHaveCount(2);

    // Submit button should count only movers: only S000002 moves -> "Transfer 1"
    const submitTransferBtn = page.locator('.warehouse-transfer-actions button');
    await expect(submitTransferBtn).toContainText('Transfer 1');

    // Remove S000002 from the batch using its row Remove button
    // S000002 is the second row
    const row2RemoveBtn = batchRows.nth(1).locator('.warehouse-transfer-remove-button');
    await row2RemoveBtn.click();

    // Now only 2 rows remain in batch (S000001 and S000003)
    await expect(batchRows).toHaveCount(2);
    // Both are stays!
    await expect(page.locator('.warehouse-data-badge-stay')).toHaveCount(2);
    // Movers count is 0, so submit button should be disabled
    await expect(submitTransferBtn).toBeDisabled();

    // Navigate back to Stock balances tab
    await page.locator('button.warehouse-tab', { hasText: 'Stock balances' }).click();

    // The group row is collapsed on tab mount: re-expand to inspect children
    await page.locator('tr.warehouse-group-row .warehouse-expand-button').click();

    // Confirm that removed S000002 became unchecked, while S000001 and S000003 remain checked
    await expect(childRow1.locator('input[type="checkbox"]')).toBeChecked();
    await expect(childRow2.locator('input[type="checkbox"]')).not.toBeChecked();
    await expect(childRow3.locator('input[type="checkbox"]')).toBeChecked();

    // Test group Delete:
    // Open group kebab menu again
    const currentGroupKebab = page.locator('tr.warehouse-group-row .warehouse-row-menu-toggle');
    await currentGroupKebab.click();
    await expect(portalMenu).toBeVisible();
    await portalMenu.locator('button', { hasText: 'Delete' }).click();

    // In-app confirm modal opens
    const deleteModal = page.locator('.modal-backdrop, .modal-overlay, .modal-card');
    await expect(deleteModal).toBeVisible();
    await expect(deleteModal.locator('text=Delete stock units')).toBeVisible();
    await expect(deleteModal.locator('text=Delete 2 stock units of TerraE 30E INR18650 3000mAh?')).toBeVisible();
    // Serial preview shows S000001, S000003
    await expect(deleteModal.locator('text=S000001, S000003')).toBeVisible();

    // Confirm delete
    const modalDeleteBtn = deleteModal.locator('button', { hasText: 'Delete' }).last();
    await modalDeleteBtn.click();

    // Modal closes
    await expect(deleteModal).not.toBeVisible();

    // Deleted units S000001 and S000003 are gone
    await expect(page.locator('text=S000001')).toHaveCount(0);
    await expect(page.locator('text=S000003')).toHaveCount(0);

    // Remaining units S000002 and S000004 exist and are unchecked
    await expect(page.locator('text=S000002')).toBeVisible();
    await expect(page.locator('text=S000004')).toBeVisible();
    // No units of this group are checked now, so group kebab must disappear
    await expect(initialGroupKebab).toHaveCount(0);

    // Switch to Units view
    await page.locator('button', { hasText: 'Units' }).click();
    // Units view should show all individual rows
    const unitRow = page.locator('tr:has-text("S000002")');
    await expect(unitRow).toBeVisible();
    // Single unit row has its own kebab
    const unitKebab = unitRow.locator('.warehouse-row-menu-toggle');
    await expect(unitKebab).toBeVisible();

    // Check S000002 in Units view
    const unitCheck = unitRow.locator('input[type="checkbox"]');
    await unitCheck.check();
    await expect(unitCheck).toBeChecked();

    // Clear selection toolbar button works
    const clearSelectionBtn = page.locator('.warehouse-selection-clear-button');
    await expect(clearSelectionBtn).toBeVisible();
    await clearSelectionBtn.click();
    await expect(unitCheck).not.toBeChecked();
  });
});
