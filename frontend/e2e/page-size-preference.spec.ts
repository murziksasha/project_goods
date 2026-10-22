import { expect, test } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-08-31T12:00:00.000Z';

const secondEmployee = {
  ...e2eEmployee,
  id: 'emp-e2e-2',
  name: 'Second Employee',
  username: 'employee2',
};

const makeMockSale = (index: number, kind: 'repair' | 'sale') => ({
  id: `sale-${index}`,
  recordNumber: `${kind === 'repair' ? 'RO' : 'SL'}-${index}`,
  saleDate: iso,
  quantity: 1,
  salePrice: 100,
  kind,
  status: 'new',
  paidAmount: 0,
  note: '',
  userNote: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: `client-${index}`,
    name: `Client ${index}`,
    phone: '+380991112233',
    status: 'new',
  },
  product: { name: `Product ${index}` },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: iso,
  updatedAt: iso,
  isFavorite: false,
  kanbanRank: null,
});

const mockProducts = Array.from({ length: 150 }, (_, i) => ({
  id: `prod-${i + 1}`,
  name: `Warehouse Part ${i + 1}`,
  article: `ART-${i + 1}`,
  serialNumber: `SN-${i + 1}`,
  warehouseId: 'wh-1',
  locationId: 'loc-1',
  costPrice: 50,
  retailPrice: 100,
  wholesalePrice: 80,
  quantity: 1,
  createdAt: iso,
  updatedAt: iso,
}));

test.describe('Page-size preference per list', () => {
  test('persists per list in browser storage, shares across accounts, and isolates from kanban', async ({
    page,
  }) => {
    const requestedSalesPageSizes: number[] = [];

    await installE2eApiMocks(page);

    await page.route(
      (url) => url.pathname.includes('/api/sales'),
      async (route) => {
        const url = new URL(route.request().url());
        if (!url.searchParams.has('page')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
          return;
        }
        const ps = Number(url.searchParams.get('pageSize') || 30);
        requestedSalesPageSizes.push(ps);
        const kind = url.searchParams.get('kind') === 'repair' ? 'repair' : 'sale';
        const total = 120;
        const items = Array.from({ length: Math.min(ps, 20) }, (_, i) =>
          makeMockSale(i + 1, kind),
        );
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items,
            total,
            page: Number(url.searchParams.get('page') || 1),
            pageSize: ps,
          }),
        });
      },
    );

    await page.route(
      (url) => url.pathname.includes('/api/products'),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProducts),
        });
      },
    );

    await page.route(
      (url) => url.pathname.includes('/api/warehouse-settings'),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
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
          }),
        });
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

    // 1. Open Sales table
    await page.goto('/?page=orders&ordersTab=sales');
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });

    const salesPagination = page.locator('.pagination-panel');
    await expect(salesPagination).toBeVisible();

    const salesSelect = salesPagination.locator('select');
    await expect(salesSelect).toHaveValue('30');

    // Change Sales to 50
    await salesSelect.selectOption('50');
    await expect(salesSelect).toHaveValue('50');

    // Confirm request sent pageSize=50
    expect(requestedSalesPageSizes).toContain(50);

    // 2. Open Warehouse stock and set to 100
    await page.goto('/?page=warehouse&warehouseTab=stock');
    await expect(page.locator('.dashboard-shell')).toBeVisible();

    const warehousePagination = page.locator('.pagination-panel');
    await expect(warehousePagination).toBeVisible();

    const warehouseSelect = warehousePagination.locator('select');
    await expect(warehouseSelect).toHaveValue('30');

    await warehouseSelect.selectOption('100');
    await expect(warehouseSelect).toHaveValue('100');

    // 3. Refresh and confirm Sales stays 50 and Warehouse stays 100
    await page.goto('/?page=orders&ordersTab=sales');
    await expect(page.locator('.pagination-panel select')).toHaveValue('50');

    await page.goto('/?page=warehouse&warehouseTab=stock');
    await expect(page.locator('.pagination-panel select')).toHaveValue('100');

    // 4. Open Orders and confirm it is still 30 (isolated from sales and warehouse)
    await page.goto('/?page=orders&ordersTab=orders');
    await expect(page.locator('.pagination-panel select')).toHaveValue('30');

    // 5. Switch to second employee on the same browser PC and confirm same sizes
    await page.evaluate((employee) => {
      window.localStorage.setItem(
        'project-goods.employee-snapshot',
        JSON.stringify(employee),
      );
    }, secondEmployee);

    await page.goto('/?page=orders&ordersTab=sales');
    await expect(page.locator('.pagination-panel select')).toHaveValue('50');

    await page.goto('/?page=warehouse&warehouseTab=stock');
    await expect(page.locator('.pagination-panel select')).toHaveValue('100');

    // 6. Confirm Kanban has no bottom pagination dropdown and queries pageSize=500
    requestedSalesPageSizes.length = 0;
    await page.goto('/?page=orders&ordersTab=kanban');
    await expect(page.getByTestId('repair-kanban-board')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.pagination-panel')).toHaveCount(0);
    expect(requestedSalesPageSizes).toContain(500);
  });
});
