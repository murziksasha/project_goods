import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Product, Sale } from '../src/entities/sale';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-11-01T12:00:00.000Z';
const productName = 'RocTek GB1 2/32 Gb';

const stockProduct = (id: string, serialNumber: string): Product => ({
  id,
  name: productName,
  article: 'ROCTEK-GB1',
  serialNumber,
  price: 3000,
  salePriceOptions: [4400],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: 'Main warehouse',
  warehouseId: 'warehouse-main',
  purchaseDate: iso,
  warrantyPeriod: 0,
  isActive: true,
  createdAt: iso,
  updatedAt: iso,
});

const bootSale = async (page: Page, isRapidSale: boolean) => {
  const sale: Sale = {
    id: isRapidSale ? 'sale-rapid' : 'sale-regular',
    recordNumber: 'r001298',
    saleDate: iso,
    quantity: 1,
    salePrice: 100,
    kind: 'sale',
    status: 'new',
    paidAmount: 0,
    isRapidSale,
    note: '',
    userNote: '',
    timeline: [],
    paymentHistory: [],
    lineItems: [
      {
        id: 'diagnostics-line',
        kind: 'service',
        name: 'Diagnostics',
        price: 100,
        quantity: 1,
        warrantyPeriod: 0,
      },
    ],
    product: {
      id: '',
      name: 'Diagnostics',
      article: 'SALE',
      serialNumber: 'SN-OLD-SNAPSHOT',
    },
    client: {
      id: 'client-1',
      name: 'Ada Client',
      phone: '+380991112233',
      status: 'new',
    },
    manager: { id: e2eEmployee.id, name: e2eEmployee.name, role: 'owner' },
    master: null,
    issuedBy: null,
    createdAt: iso,
    updatedAt: iso,
  };
  const stock = [
    stockProduct('stock-1', 'S000101'),
    stockProduct('stock-2', 'S000102'),
  ];
  const savedLines: Sale['lineItems'][] = [];

  await installE2eApiMocks(page);
  await page.route(
    (url) =>
      url.pathname === '/api/products' ||
      url.pathname === '/api/employees' ||
      url.pathname === '/api/warehouse-settings' ||
      url.pathname === '/api/sales' ||
      url.pathname.startsWith('/api/sales/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const fulfill = async (body: unknown) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      };

      if (request.method() === 'GET') {
        if (path === '/api/products') return fulfill(stock);
        if (path === '/api/employees') return fulfill([e2eEmployee]);
        if (path === '/api/warehouse-settings') {
          return fulfill({
            id: 'warehouse-settings',
            serviceCenters: [],
            warehouses: [
              {
                id: 'warehouse-main',
                name: 'Main warehouse',
                isActive: true,
                serviceCenterId: '',
                receiptAddress: '',
                receiptPhone: '',
                locations: [],
              },
            ],
            administrators: [],
            createdAt: iso,
            updatedAt: iso,
          });
        }
        if (path === '/api/sales/occupied-serials') {
          return fulfill({ occupied: [] });
        }
        if (path === '/api/sales') {
          // Return the record even for item queries to exercise the local filter.
          return fulfill(
            url.searchParams.has('page')
              ? { items: [sale], total: 1, page: 1, pageSize: 30 }
              : [sale],
          );
        }
        if (path === `/api/sales/${sale.id}`) return fulfill(sale);
      }

      if (
        request.method() === 'PATCH' &&
        path === `/api/sales/${sale.id}/workspace`
      ) {
        const body = request.postDataJSON() as Partial<Sale>;
        if (body.lineItems) {
          sale.lineItems = body.lineItems;
          savedLines.push(structuredClone(body.lineItems));
        }
        if (body.timeline) sale.timeline = body.timeline;
        if (body.status) sale.status = body.status;
        sale.updatedAt = new Date(Date.parse(iso) + savedLines.length * 1000)
          .toISOString();
        // The creation-time product snapshot intentionally remains unchanged.
        return fulfill(sale);
      }

      await route.fallback();
    },
  );
  await page.addInitScript((employee) => {
    localStorage.setItem('project-goods.lang', 'en');
    localStorage.setItem('project-goods.auth-token', 'e2e-token');
    localStorage.setItem('project-goods.employee-snapshot', JSON.stringify(employee));
  }, e2eEmployee);
  await page.goto('/?page=orders&ordersTab=sales');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });

  return { sale, savedLines };
};

for (const isRapidSale of [false, true]) {
  test(`${isRapidSale ? 'Rapid' : 'Regular'} sale reflects removed services and added goods without a reload`, async ({
    page,
  }) => {
    const { sale, savedLines } = await bootSale(page, isRapidSale);
    const firstCell = page.locator('.order-device-cell').first();
    await expect(firstCell.getByRole('button', { name: 'Diagnostics', exact: true }))
      .toBeVisible();
    await expect(firstCell.locator('small')).toHaveCount(0);
    await page.evaluate(() => {
      document.documentElement.dataset.salesTestDocument = 'original';
    });

    await firstCell.getByRole('button', { name: 'Diagnostics', exact: true }).click();
    let card = page.getByLabel('Sale card', { exact: true });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect.poll(() => savedLines.length).toBe(1);
    expect(savedLines[0]).toEqual([]);
    await card.getByRole('button', { name: 'Close order card' }).click();

    await expect(firstCell.getByRole('button', { name: 'No items', exact: true }))
      .toBeVisible();
    await expect(firstCell.locator('small, .order-extra-lines')).toHaveCount(0);

    await firstCell.getByRole('button', { name: 'No items', exact: true }).click();
    card = page.getByLabel('Sale card', { exact: true });
    await expect(card).toBeVisible();
    const products = card.locator('.order-detail-products-panel');
    const productSearch = products.getByPlaceholder('Name, serial or article');
    for (const [index, serial] of ['S000101', 'S000102'].entries()) {
      await productSearch.fill(serial);
      await products.locator('.line-item-suggestions')
        .getByRole('button', { name: productName, exact: true }).click();
      await expect.poll(() => savedLines.length).toBe(index + 2);
      expect(savedLines[index + 1][index].serialNumbers).toEqual([serial]);
    }

    const entry = products.locator('.order-detail-table-entry-row');
    await productSearch.fill('AAA Panasonic Alkaline');
    await entry.getByRole('textbox', { name: 'Price', exact: true }).fill('50');
    await entry.getByRole('textbox', { name: 'Qty', exact: true }).fill('2');
    await entry.getByRole('button', { name: 'Add product', exact: true }).click();
    await expect.poll(() => savedLines.length).toBe(4);
    expect(savedLines[3]).toHaveLength(3);
    expect(savedLines[3][2].quantity).toBe(2);
    await card.getByRole('button', { name: 'Close order card' }).click();

    await expect(firstCell.locator('.order-device-button')).toContainText(productName);
    await expect(firstCell.locator('.order-sale-serials')).toHaveText('S/N: S000101');
    await expect(firstCell.locator('.order-extra-lines')).toHaveText('+2');
    await expect(firstCell).not.toContainText('Diagnostics');
    await expect(firstCell).not.toContainText('SN-OLD-SNAPSHOT');
    await firstCell.locator('.order-extra-lines').click();
    const menu = page.getByRole('listbox', { name: 'Show items in this order' });
    await expect(menu).toBeVisible();
    await expect(menu.locator('strong')).toHaveText([
      productName,
      productName,
      'AAA Panasonic Alkaline',
    ]);
    await expect(menu.locator('.order-extra-lines-serial')).toHaveText([
      'S000101',
      'S000102',
      '—',
    ]);
    await expect(menu.locator('.order-extra-lines-price').last()).toContainText('× 2');
    await expect(page.getByLabel('Sale card', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    const search = page.getByPlaceholder(
      'Order, client, phone, product, note or manager',
    );
    await search.fill('AAA Panasonic Alkaline');
    await expect(firstCell).toContainText(productName);
    await search.fill('Diagnostics');
    await expect(page.locator('.order-device-cell')).toHaveCount(0);
    await search.fill('S000102');
    await expect(firstCell).toContainText(productName);
    expect(sale.product?.name).toBe('Diagnostics');
    await expect(page.locator('html')).toHaveAttribute('data-sales-test-document', 'original');
  });
}
