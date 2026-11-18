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
      locations: [{ id: 'loc-1', name: 'Shelf 1' }],
    },
  ],
  administrators: [],
  createdAt: iso,
  updatedAt: iso,
};

const stockProduct = (
  id: string,
  serialNumber: string,
) => ({
  id,
  name: 'Battery Pack',
  article: 'ART-BAT',
  serialNumber,
  warehouseId: 'wh-1',
  locationId: 'loc-1',
  costPrice: 5,
  retailPrice: 10,
  wholesalePrice: 8,
  quantity: 1,
  purchaseDate: '2026-07-01',
  createdAt: iso,
  updatedAt: iso,
});

const products = [
  ...Array.from({ length: 12 }, (_, index) =>
    stockProduct(`p-${index + 1}`, `S000${String(index + 1).padStart(3, '0')}`),
  ),
  stockProduct('p-issued', 'S000113'),
  stockProduct('p-returned', 'S000114'),
];

const stockLinks = [
  {
    productId: 'p-issued',
    serialNumber: 'S000113',
    saleId: 'sale-255',
    recordNumber: 'r000255',
    kind: 'sale',
    status: 'issued',
  },
  {
    productId: 'p-returned',
    serialNumber: 'S000114',
    saleId: 'sale-256',
    recordNumber: 'r000256',
    kind: 'sale',
    status: 'returned',
  },
  {
    productId: 'p-1',
    serialNumber: 'S000001',
    saleId: 'sale-088',
    recordNumber: 'r000088',
    kind: 'repair',
    status: 'reserved',
  },
  {
    productId: 'p-2',
    serialNumber: 'S000002',
    saleId: 'sale-010',
    recordNumber: 'r000010',
    kind: 'repair',
    status: 'new',
  },
  {
    productId: 'p-2',
    serialNumber: 'S000002',
    saleId: 'sale-099',
    recordNumber: 'r000099',
    kind: 'sale',
    status: 'paid',
  },
];

test('purchase-by-serial header stays pinned and client orders open and copy', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
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
        body: JSON.stringify(products),
      });
    },
  );

  await page.route(
    (url) => url.pathname.includes('/api/sales/stock-links'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ links: stockLinks }),
      });
    },
  );

  await page.route(
    (url) => url.pathname === '/api/sales',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    },
  );

  page.on('pageerror', (error) => {
    console.log(`PAGE ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`CONSOLE ${message.text()}`);
  });

  await page.addInitScript((employee) => {
    window.localStorage.setItem('project-goods.lang', 'en');
    window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
    window.localStorage.setItem(
      'project-goods.employee-snapshot',
      JSON.stringify(employee),
    );
  }, e2eEmployee);

  await page.goto('/?page=warehouse&warehouseTab=stock');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });

  const groupRow = page.locator('tr', { hasText: 'Battery Pack' }).first();
  await expect(groupRow).toBeVisible();
  await groupRow.locator('.warehouse-expand-button').click();
  const stockTable = page.locator('table').first();
  await expect(stockTable).toContainText('S000114');
  await expect(stockTable).not.toContainText('S000113');

  await page.getByRole('button', { name: 'Toggle visible columns' }).click();
  await page.getByRole('checkbox', { name: 'Client order' }).check();
  await expect(stockTable).toContainText('r000256');
  await expect(stockTable).toContainText('r000088');
  await expect(stockTable).not.toContainText('r000255');

  await groupRow.locator('.settings-link-button').first().click();
  const modal = page.locator('.product-model-modal');
  await expect(modal).toBeVisible();
  const wrap = modal.locator('.product-model-serial-purchases-table-wrap');
  const table = wrap.locator('table');
  await expect(table).toContainText('Client order');
  await expect(table).toContainText('S000114');
  await expect(table).toContainText('r000256');
  await expect(table).toContainText('r000010');
  await expect(table).toContainText('r000099');
  await expect(table).not.toContainText('S000113');
  await expect(modal.getByRole('heading', { name: 'Selected serial purchase' })).toHaveCount(0);

  const header = wrap.locator('thead th').first();
  const headerBefore = await header.boundingBox();
  expect(headerBefore).not.toBeNull();
  await wrap.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const headerAfter = await header.boundingBox();
  const wrapBox = await wrap.boundingBox();
  expect(headerAfter).not.toBeNull();
  expect(wrapBox).not.toBeNull();
  expect(headerAfter!.y).toBeGreaterThanOrEqual(wrapBox!.y - 1);
  expect(headerAfter!.y).toBeLessThan(wrapBox!.y + 8);
  expect(Math.abs(headerAfter!.y - headerBefore!.y)).toBeLessThan(2);

  const orderCopy = wrap
    .locator('.copyable-value')
    .filter({ hasText: 'r000088' })
    .first();
  await orderCopy.locator('button.copyable-value-copy').click({ force: true });
  await expect(orderCopy.locator('button.copyable-value-copy')).toHaveClass(
    /copyable-value-copy-success/,
  );
  await expect(page).toHaveURL(/warehouseTab=stock/);
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('r000088');

  await page.setViewportSize({ width: 390, height: 800 });
  const scrollMetrics = await wrap.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);

  await wrap.locator('a.warehouse-link-badge', { hasText: 'r000088' }).click();
  await expect(page).toHaveURL(/page=orders/);
  await expect(page).toHaveURL(/ordersTab=orders/);
  await expect(page).toHaveURL(/saleId=sale-088/);
});
