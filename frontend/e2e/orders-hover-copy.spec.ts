import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Sale } from '../src/entities/sale';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-08-31T12:00:00.000Z';

const repair: Sale = {
  id: 'sale-repair',
  recordNumber: 'r001312',
  saleDate: iso,
  quantity: 1,
  salePrice: 0,
  kind: 'repair',
  status: 'new',
  paidAmount: 0,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'client-1',
    name: 'Ada Client',
    phone: '+380991112233',
    status: 'new',
  },
  product: {
    id: 'product-1',
    name: 'Saturn TV',
    serialNumber: 'SN-40',
    article: 'ART-1',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: iso,
  updatedAt: iso,
  isFavorite: false,
};

const productSale: Sale = {
  ...repair,
  id: 'sale-shop',
  recordNumber: 's000726',
  kind: 'sale',
  status: 'new',
  product: {
    id: 'product-2',
    name: 'Phone case',
    serialNumber: '',
    article: 'ART-2',
  },
  lineItems: [
    {
      id: 'li-1',
      kind: 'product',
      name: 'Phone case',
      price: 100,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
  client: {
    id: 'client-2',
    name: 'Boris Buyer',
    phone: '+380501112233',
    status: 'new',
  },
};

const boot = async (
  page: Page,
  ordersTab: string,
  sales: Sale[] = [repair, productSale],
) => {
  await installE2eApiMocks(page);
  await page.route(
    (url) =>
      url.pathname === '/api/sales' ||
      url.pathname.startsWith('/api/sales/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET') {
        const body = url.pathname === '/api/sales'
          ? url.searchParams.has('page')
            ? { items: sales, total: sales.length, page: 1, pageSize: 30 }
            : sales
          : sales.find((sale) => url.pathname === `/api/sales/${sale.id}`);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body ?? { occupied: [] }),
        });
        return;
      }
      await route.fallback();
    },
  );
  await page.addInitScript((employee) => {
    window.localStorage.setItem('project-goods.lang', 'en');
    window.localStorage.setItem(
      'project-goods.auth-token',
      'e2e-token',
    );
    window.localStorage.setItem(
      'project-goods.employee-snapshot',
      JSON.stringify(employee),
    );
  }, e2eEmployee);
  await page.context().grantPermissions([
    'clipboard-read',
    'clipboard-write',
  ]);
  await page.goto(`/?page=orders&ordersTab=${ordersTab}`);
  await expect(page.locator('.dashboard-shell')).toBeVisible({
    timeout: 20_000,
  });
};

test('orders list copies the device name and client name', async ({
  page,
}) => {
  await boot(page, 'orders');
  await expect(page.getByText('Saturn TV')).toBeVisible();

  const deviceIcon = page.locator(
    '.order-device-cell .copyable-value-copy',
  );
  await expect(deviceIcon).toHaveCSS('opacity', '0');
  await page.locator('.order-device-name-button').hover();
  await expect(deviceIcon).toHaveCSS('opacity', '1');

  const cell = page.locator('.order-device-cell');
  const cellBox = await cell.boundingBox();
  const iconBox = await deviceIcon.boundingBox();
  expect(cellBox).toBeTruthy();
  expect(iconBox).toBeTruthy();
  expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(
    cellBox!.x + cellBox!.width + 1,
  );

  await deviceIcon.click();
  await expect(deviceIcon).toHaveClass(/copyable-value-copy-success/);
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('Saturn TV');
  await expect(deviceIcon).not.toHaveClass(
    /copyable-value-copy-success/,
    { timeout: 3_000 },
  );
  await deviceIcon.evaluate((node) => {
    if (node instanceof HTMLElement) node.blur();
  });

  await page.locator('.order-device-serial').hover();
  await expect(deviceIcon).toHaveCSS('opacity', '0');
  await expect(page.locator('.order-device-serial button')).toHaveCount(
    0,
  );

  const clientIcon = page
    .locator('.orders-client-cell > .copyable-value')
    .locator('.copyable-value-copy');
  await page.locator('.orders-client-link').hover();
  await expect(clientIcon).toHaveCSS('opacity', '1');
  await clientIcon.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('Ada Client');

  await page.getByRole('tab', { name: 'Sales' }).click();
  await expect(page.getByText('Phone case')).toBeVisible();
  const salesProductIcon = page.locator(
    '.order-device-cell > .copyable-value .copyable-value-copy',
  );
  await expect(salesProductIcon).toHaveCount(1);
  await page.locator('.order-device-name-button').hover();
  await salesProductIcon.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('Phone case');
  await expect(page.getByLabel('Sale card', { exact: true })).toHaveCount(0);
  const salesClientIcon = page
    .locator('.orders-client-cell > .copyable-value')
    .locator('.copyable-value-copy');
  await page.getByRole('button', { name: 'Boris Buyer' }).hover();
  await salesClientIcon.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('Boris Buyer');
});

const longProductName =
  'RocTek GB1 2/32 Gb media player with a deliberately long current product name for checking ellipsis and independent copy controls';

const serializedSale: Sale = {
  ...productSale,
  id: 'sale-current-serials',
  recordNumber: 'r001401',
  product: {
    id: 'stale-product',
    name: 'Removed diagnostics',
    serialNumber: 'SN-OLD-SNAPSHOT',
    article: 'OLD',
  },
  lineItems: [
    {
      id: 'current-product',
      kind: 'product',
      name: `  ${longProductName}  `,
      price: 4400,
      quantity: 2,
      warrantyPeriod: 0,
      serialNumbers: [' S000101 ', ' ', ' S000102 '],
    },
    {
      id: 'extra-service',
      kind: 'service',
      name: 'Setup',
      price: 100,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
};

const expectClipboard = async (page: Page, value: string) => {
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(value);
};

const expectIconInsideCell = async (cell: Locator, icon: Locator) => {
  const cellBox = await cell.boundingBox();
  const iconBox = await icon.boundingBox();
  expect(cellBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  expect(iconBox!.width).toBeGreaterThan(10);
  expect(iconBox!.x).toBeGreaterThanOrEqual(cellBox!.x - 1);
  expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(
    cellBox!.x + cellBox!.width + 1,
  );
};

test('sales product and each serial have independent hover, copy, and sale-card actions', async ({
  page,
}) => {
  await boot(page, 'sales', [serializedSale]);
  const cell = page.locator('.order-device-cell');
  const name = cell.locator('.order-device-name-button');
  const nameIcon = cell.locator('> .copyable-value .copyable-value-copy');
  const serialValues = cell.locator('.order-sale-serial-value');
  const serialIcons = serialValues.locator('.copyable-value-copy');
  await expect(name).toHaveText(longProductName);
  await expect(serialValues).toHaveCount(2);
  await expect(cell.locator('.order-sale-serials')).toHaveText('S/N: S000101, S000102');
  await expect(cell.locator('.order-sale-serials')).not.toContainText('SN-OLD-SNAPSHOT');
  await expect(cell.locator('.copyable-value-copy')).toHaveCount(3);
  await page.mouse.move(5, 5);
  for (const icon of [nameIcon, serialIcons.nth(0), serialIcons.nth(1)]) {
    await expect(icon).toHaveCSS('opacity', '0');
  }

  await name.hover();
  await expect(nameIcon).toHaveCSS('opacity', '1');
  await expect(serialIcons.nth(0)).toHaveCSS('opacity', '0');
  await expect(serialIcons.nth(1)).toHaveCSS('opacity', '0');
  await expectIconInsideCell(cell, nameIcon);
  expect(await name.locator('.orders-table-cell-truncate').evaluate(
    (node) => node.scrollWidth > node.clientWidth,
  )).toBe(true);
  for (const index of [0, 1]) {
    await serialValues.nth(index).locator('.order-device-serial').hover();
    await expect(nameIcon).toHaveCSS('opacity', '0');
    await expect(serialIcons.nth(index)).toHaveCSS('opacity', '1');
    await expect(serialIcons.nth(1 - index)).toHaveCSS('opacity', '0');
    await expectIconInsideCell(cell, serialIcons.nth(index));
  }

  await name.hover();
  await nameIcon.click();
  await expectClipboard(page, longProductName);
  for (const [index, serial] of ['S000101', 'S000102'].entries()) {
    await serialValues.nth(index).hover();
    await serialIcons.nth(index).click();
    await expectClipboard(page, serial);
  }
  await expect(page.getByLabel('Sale card', { exact: true })).toHaveCount(0);
  await expect(page.locator('.product-model-modal')).toHaveCount(0);
  await cell.getByRole('button', { name: 'Show items in this order' }).click();
  const menu = page.getByRole('listbox', { name: 'Show items in this order' });
  await expect(menu).toBeVisible();
  await expect(menu.locator('.copyable-value-copy')).toHaveCount(0);
  await page.keyboard.press('Escape');

  for (const target of [name, ...await serialValues.locator('.order-device-serial').all()]) {
    await target.click();
    const card = page.getByLabel('Sale card', { exact: true });
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'r001401', exact: true })).toBeVisible();
    await expect(page.locator('.product-model-modal')).toHaveCount(0);
    await card.getByRole('button', { name: 'Close order card' }).click();
  }
});

test('sales service name copies its current value and No items stays clickable without an icon', async ({
  page,
}) => {
  const serviceSale: Sale = {
    ...serializedSale,
    id: 'sale-current-service',
    recordNumber: 'r001402',
    lineItems: [{
      id: 'service-only',
      kind: 'service',
      name: '  Current diagnostics  ',
      price: 100,
      quantity: 1,
      warrantyPeriod: 0,
    }],
  };
  const emptySale: Sale = {
    ...serializedSale,
    id: 'sale-empty',
    recordNumber: 'r001403',
    lineItems: [],
  };
  await boot(page, 'sales', [serviceSale, emptySale]);
  const serviceCell = page.locator('.order-device-cell').filter({ hasText: 'Current diagnostics' });
  await serviceCell.locator('.order-device-name-button').hover();
  await serviceCell.locator('.copyable-value-copy').click();
  await expectClipboard(page, 'Current diagnostics');
  await expect(serviceCell.locator('.order-sale-serials')).toHaveCount(0);
  await expect(page.getByLabel('Sale card', { exact: true })).toHaveCount(0);
  await serviceCell.locator('.order-device-name-button').click();
  let card = page.getByLabel('Sale card', { exact: true });
  await expect(card.getByRole('heading', { name: 'r001402', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Close order card' }).click();

  const emptyCell = page.locator('.order-device-cell').filter({ hasText: 'No items' });
  await expect(emptyCell.locator('.copyable-value-copy')).toHaveCount(0);
  await expect(emptyCell.locator('.order-sale-serials')).toHaveCount(0);
  await emptyCell.getByRole('button', { name: 'No items', exact: true }).click();
  card = page.getByLabel('Sale card', { exact: true });
  await expect(card.getByRole('heading', { name: 'r001403', exact: true })).toBeVisible();
});

test('sales copy controls remain contained and usable on a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, 'sales', [serializedSale]);
  const cell = page.locator('.order-device-cell');
  const wrappers = [
    cell.locator('> .copyable-value'),
    ...await cell.locator('.order-sale-serial-value .copyable-value').all(),
  ];
  for (const [index, wrapper] of wrappers.entries()) {
    await wrapper.hover();
    const icon = wrapper.locator('.copyable-value-copy');
    await expect(icon).toHaveCSS('opacity', '1');
    await expectIconInsideCell(cell, icon);
    await icon.click();
    await expectClipboard(page, [longProductName, 'S000101', 'S000102'][index]);
  }
  await expect(page.getByLabel('Sale card', { exact: true })).toHaveCount(0);
});

test('touch users can copy sales name and individual serials without hovering', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await boot(page, 'sales', [serializedSale]);
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
    const cell = page.locator('.order-device-cell');
    const icons = cell.locator('.copyable-value-copy');
    await expect(icons).toHaveCount(3);
    for (const [index, expected] of [longProductName, 'S000101', 'S000102'].entries()) {
      const icon = icons.nth(index);
      await expect(icon).toHaveCSS('opacity', '1');
      await expectIconInsideCell(cell, icon);
      await icon.tap();
      await expectClipboard(page, expected);
    }
    await expect(page.getByLabel('Sale card', { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('kanban card copies number, client, and device', async ({
  page,
}) => {
  await boot(page, 'kanban');
  await expect(page.getByTestId('repair-kanban-board')).toBeVisible();
  const card = page.locator('.repair-kanban-card');
  await expect(card.getByText('#r001312')).toBeVisible();
  await expect(card.locator('.repair-kanban-card-phone')).toBeVisible();
  await expect(
    card.locator('.repair-kanban-card-phone button'),
  ).toHaveCount(0);

  const copyFrom = async (selector: string, expected: string) => {
    const icon = card.locator(`${selector} .copyable-value-copy`);
    await card.locator(selector).hover();
    await expect(icon).toHaveCSS('opacity', '1');
    await icon.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(expected);
  };

  await copyFrom('.repair-kanban-card-number', 'r001312');
  await copyFrom('.repair-kanban-card-client', 'Ada Client');
  await copyFrom('.repair-kanban-card-device', 'Saturn TV');
  await expect(page.getByLabel('Order card')).toHaveCount(0);
});
