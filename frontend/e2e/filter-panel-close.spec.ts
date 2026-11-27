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
  ],
  administrators: [],
  createdAt: iso,
  updatedAt: iso,
};

test.describe('Filter panel close and Save filter sheet', () => {
  test.beforeEach(async ({ page }) => {
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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      },
    );

    await page.addInitScript((employee) => {
      window.localStorage.setItem('project-goods.lang', 'en');
      window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
      window.localStorage.setItem(
        'project-goods.employee-snapshot',
        JSON.stringify(employee),
      );
    }, e2eEmployee);
  });

  test('Supplier Order: panel close leaves draft, Save filter portals full-height, Escape closes sheet then panel', async ({
    page,
  }) => {
    await page.goto('/?page=orders&ordersTab=supplierOrders');

    // 1. Open Filter panel
    const filterBtn = page.getByRole('button', { name: /^Filter/ });
    await filterBtn.click();
    const panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();

    // Type a draft filter
    const productInput = panel.getByPlaceholder('Product name');
    await productInput.fill('Test Screen 123');

    // Close panel with ×
    const closeBtn = panel.locator('.orders-filter-panel-close');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(panel).not.toBeVisible();

    // Reopen: draft preserved
    await filterBtn.click();
    const reopenedPanel = page.locator('.orders-filter-panel-open');
    await expect(reopenedPanel).toBeVisible();
    await expect(reopenedPanel.getByPlaceholder('Product name')).toHaveValue('Test Screen 123');

    // Open Save filter sheet
    const saveFilterBtn = reopenedPanel.getByRole('button', { name: 'Save filter' });
    await saveFilterBtn.click();

    // Backdrop is portaled to document.body and visible
    const backdrop = page.locator('body > .orders-filter-drawer-backdrop');
    await expect(backdrop).toBeVisible();
    const drawer = backdrop.locator('.orders-filter-drawer');
    await expect(drawer).toBeVisible();

    // Save and Cancel buttons in drawer are visible
    const drawerSaveBtn = drawer.getByRole('button', { name: 'Save', exact: true });
    const drawerCancelBtn = drawer.getByRole('button', { name: 'Cancel', exact: true });
    await expect(drawerSaveBtn).toBeVisible();
    await expect(drawerCancelBtn).toBeVisible();

    // Empty name: click Save -> drawer stays open
    await drawerSaveBtn.click();
    await expect(drawer).toBeVisible();

    // Press Escape: drawer closes, but filter panel stays open
    await page.keyboard.press('Escape');
    await expect(backdrop).not.toBeVisible();
    await expect(reopenedPanel).toBeVisible();

    // Press Escape again: filter panel closes
    await page.keyboard.press('Escape');
    await expect(page.locator('.orders-filter-panel-open')).not.toBeVisible();
  });

  test('Panel close × is present and closes panel on Orders, Kanban, and Sales', async ({
    page,
  }) => {
    // Orders
    await page.goto('/?page=orders&ordersTab=orders');
    await page.getByRole('button', { name: /^Filter/ }).click();
    let panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();
    await panel.locator('.orders-filter-panel-close').click();
    await expect(page.locator('.orders-filter-panel-open')).not.toBeVisible();

    // Kanban
    await page.goto('/?page=orders&ordersTab=kanban');
    await page.getByRole('button', { name: /^Filter/ }).click();
    panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();
    await panel.locator('.orders-filter-panel-close').click();
    await expect(page.locator('.orders-filter-panel-open')).not.toBeVisible();

    // Sales
    await page.goto('/?page=orders&ordersTab=sales');
    await page.getByRole('button', { name: /^Filter/ }).click();
    panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();
    await panel.locator('.orders-filter-panel-close').click();
    await expect(page.locator('.orders-filter-panel-open')).not.toBeVisible();
  });

  test('Panel close × is present and closes panel on Clients, Suppliers tab, Catalog, and Warehouse', async ({
    page,
  }) => {
    // Clients
    await page.goto('/?page=clients');
    await page.getByRole('button', { name: /^Filter/ }).click();
    let panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();
    await panel.locator('.orders-filter-panel-close').click();
    await expect(page.locator('.orders-filter-panel-open')).not.toBeVisible();

    // Suppliers tab in Clients
    const suppliersTab = page.getByRole('tab', { name: /^Suppliers/ });
    await expect(suppliersTab).toBeVisible();
    await suppliersTab.click();
    await page.getByRole('button', { name: /^Filter/ }).click();
    panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();
    await panel.locator('.orders-filter-panel-close').click();
    await expect(page.locator('.orders-filter-panel-open')).not.toBeVisible();

    // Catalog
    await page.goto('/?page=catalog');
    await page.getByRole('button', { name: /^Filter/ }).click();
    panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();
    await panel.locator('.orders-filter-panel-close').click();
    await expect(page.locator('.orders-filter-panel-open')).not.toBeVisible();

    // Warehouse
    await page.goto('/?page=warehouse');
    await page.getByRole('button', { name: /^Filter/ }).click();
    panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();
    await panel.locator('.orders-filter-panel-close').click();
    await expect(page.locator('.orders-filter-panel-open')).not.toBeVisible();
  });

  test('Narrow viewport: × stays in reserved right padding and does not overlap Save filter', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 500, height: 800 });
    await page.goto('/?page=orders&ordersTab=supplierOrders');

    await page.getByRole('button', { name: /^Filter/ }).click();
    const panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();

    const closeBtn = panel.locator('.orders-filter-panel-close');
    const saveFilterBtn = panel.getByRole('button', { name: 'Save filter' });

    await expect(closeBtn).toBeVisible();
    await expect(saveFilterBtn).toBeVisible();

    const closeBox = await closeBtn.boundingBox();
    const saveBox = await saveFilterBtn.boundingBox();

    expect(closeBox).not.toBeNull();
    expect(saveBox).not.toBeNull();

    if (closeBox && saveBox) {
      const overlapX =
        closeBox.x < saveBox.x + saveBox.width &&
        closeBox.x + closeBox.width > saveBox.x;
      const overlapY =
        closeBox.y < saveBox.y + saveBox.height &&
        closeBox.y + closeBox.height > saveBox.y;
      const isOverlapping = overlapX && overlapY;
      expect(isOverlapping).toBe(false);
    }
  });

  test('Save filter sheet: closing and reopening drawer while save is pending leaves reopened drawer open', async ({
    page,
  }) => {
    let completeSaveRoute: () => void;
    const savePromise = new Promise<void>((resolve) => {
      completeSaveRoute = resolve;
    });

    await page.route(
      (url) => url.pathname.includes('/api/saved-filters'),
      async (route) => {
        if (route.request().method() === 'POST') {
          await savePromise;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'sf-test-123',
              employeeId: 'e2e-employee',
              scope: 'orders',
              tab: 'supplierOrders',
              name: 'Filter 1',
              icon: '⭐',
              filters: {},
              createdAt: iso,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
      },
    );

    await page.goto('/?page=orders&ordersTab=supplierOrders');
    await page.getByRole('button', { name: /^Filter/ }).click();
    const panel = page.locator('.orders-filter-panel-open');
    await expect(panel).toBeVisible();

    // 1. Open Save filter sheet
    await panel.getByRole('button', { name: 'Save filter' }).click();
    const backdrop = page.locator('body > .orders-filter-drawer-backdrop');
    await expect(backdrop).toBeVisible();
    const drawer = backdrop.locator('.orders-filter-drawer');

    // Type filter name and click Save
    await drawer.getByLabel('Filter name').fill('Filter 1');
    await drawer.getByRole('button', { name: 'Save', exact: true }).click();

    // 2. While save is in flight, close drawer with x
    await drawer.getByRole('button', { name: 'Close save filter panel' }).click();
    await expect(backdrop).not.toBeVisible();

    // 3. Reopen drawer and type another name
    await panel.getByRole('button', { name: 'Save filter' }).click();
    await expect(backdrop).toBeVisible();
    await drawer.getByLabel('Filter name').fill('Filter 2');

    // 4. In-flight save finishes
    completeSaveRoute!();

    // Verify drawer is still open and name is still "Filter 2"
    await page.waitForTimeout(500);
    await expect(backdrop).toBeVisible();
    await expect(drawer.getByLabel('Filter name')).toHaveValue('Filter 2');
  });
});
