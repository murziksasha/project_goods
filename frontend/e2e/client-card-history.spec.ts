import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Product } from '../src/entities/product';
import type { Sale } from '../src/entities/sale';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-11-10T12:00:00.000Z';

const clientRecord = {
  id: 'client-1',
  phone: '+380991112233',
  phones: ['+380991112233'],
  name: 'Ada Client',
  email: '',
  address: '',
  registrationId: '',
  iban: '',
  note: '',
  status: 'new' as const,
  createdAt: iso,
  updatedAt: iso,
};

const clientSnapshot = {
  id: clientRecord.id,
  name: clientRecord.name,
  phone: clientRecord.phone,
  status: 'new',
};

const powerBoard: Product = {
  id: 'power-board',
  name: 'Power board',
  article: 'PWR-1',
  serialNumber: 'S000111',
  price: 150,
  salePriceOptions: [250],
  quantity: 0,
  reservedQuantity: 0,
  freeQuantity: 0,
  isInStock: false,
  isActive: true,
  note: '',
  purchasePlace: '',
  purchaseDate: '2026-06-12T09:00:00.000Z',
  warrantyPeriod: 1,
  supplierOrderId: 'history-supplier-order',
  supplierOrderItemIndex: 0,
  createdAt: iso,
  updatedAt: iso,
};

const cable: Product = {
  id: 'cable-unit',
  name: 'Cable',
  article: 'CBL-1',
  serialNumber: 'S000900',
  price: 40,
  salePriceOptions: [80],
  quantity: 0,
  reservedQuantity: 0,
  freeQuantity: 0,
  isInStock: false,
  isActive: true,
  note: '',
  purchasePlace: '',
  purchaseDate: '2026-06-12T09:00:00.000Z',
  warrantyPeriod: 1,
  supplierOrderId: 'cable-supplier-order',
  supplierOrderItemIndex: 0,
  createdAt: iso,
  updatedAt: iso,
};

const repair: Sale = {
  id: 'sale-repair',
  recordNumber: 'r000780',
  saleDate: iso,
  quantity: 1,
  salePrice: 330,
  kind: 'repair',
  status: 'new',
  paidAmount: 0,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [
    {
      id: 'part',
      kind: 'product',
      name: 'Power board',
      productId: powerBoard.id,
      price: 125,
      quantity: 2,
      warrantyPeriod: 1,
      serialNumbers: ['  S000111  '],
    },
    {
      id: 'service',
      kind: 'service',
      name: 'BIOS flash',
      price: 80,
      quantity: 1,
      warrantyPeriod: 1,
      serialNumbers: ['SHOULD-NOT-SHOW'],
    },
  ],
  product: {
    id: '',
    name: 'Dell monitor',
    article: 'REPAIR',
    serialNumber: 'SN-1',
  },
  client: clientSnapshot,
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: iso,
  updatedAt: iso,
  isFavorite: false,
};

const emptyRepair: Sale = {
  ...repair,
  id: 'sale-empty',
  recordNumber: 'r000781',
  status: 'paid',
  salePrice: 0,
  paidAmount: 0,
  lineItems: [],
  product: {
    id: '',
    name: 'Old radio',
    article: 'REPAIR',
    serialNumber: 'MISSING-SERIAL',
  },
};

const bundledSale: Sale = {
  ...repair,
  id: 'sale-bundle',
  recordNumber: 's000540',
  kind: 'sale',
  status: 'paid',
  salePrice: 180,
  paidAmount: 180,
  lineItems: [
    {
      id: 'case',
      kind: 'product',
      name: 'Phone case',
      price: 100,
      quantity: 1,
      warrantyPeriod: 1,
      serialNumbers: ['S000533'],
    },
    {
      id: 'cable',
      kind: 'product',
      name: 'Cable',
      productId: cable.id,
      price: 40,
      quantity: 2,
      warrantyPeriod: 1,
      serialNumbers: ['S000900'],
    },
  ],
  product: { id: '', name: '', article: '', serialNumber: '' },
};

const history = [repair, emptyRepair, bundledSale];

const supplierOrder = (
  id: string,
  number: string,
  productName: string,
  price: number,
) => ({
  id,
  orderBaseId: number,
  number,
  supplierId: 'supplier-1',
  supplierName: 'Parts supplier',
  status: 'stocked',
  paymentStatus: 'paid',
  receiptStatus: 'received',
  deliveryDate: iso,
  supplyType: 'Local',
  note: '',
  createdBy: 'Owner',
  total: price,
  paid: price,
  isFavorite: false,
  createdAt: iso,
  updatedAt: iso,
  items: [
    {
      lineId: `${id}-line`,
      itemIndex: 0,
      productName,
      quantity: 1,
      price,
      receiptStatus: 'received',
    },
  ],
});

const boot = async (page: Page) => {
  await installE2eApiMocks(page);
  await page.context().route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (path === '/auth/me' || path.endsWith('/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(e2eEmployee),
      });
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    let body: unknown;
    if (request.method() === 'GET' && path === '/clients') {
      body = [clientRecord];
    } else if (path === `/clients/${clientRecord.id}/history`) {
      body = {
        client: clientRecord,
        sales: history,
        stats: { totalSales: history.length, totalRevenue: 510, totalItemsSold: 3 },
      };
    } else if (path === '/products') {
      body = [powerBoard, cable];
    } else if (path === '/warehouse-settings') {
      body = {
        id: 'wh-settings',
        warehouses: [],
        serviceCenters: [],
        administrators: [],
        createdAt: iso,
        updatedAt: iso,
      };
    } else if (path === '/supplier-orders') {
      body = [
        supplierOrder('history-supplier-order', 'SO-77', 'Power board', 150),
        supplierOrder('cable-supplier-order', 'SO-78', 'Cable', 40),
      ];
    } else if (path === '/sales/occupied-serials') {
      body = { occupied: [] };
    } else if (path === '/sales') {
      const kind = url.searchParams.get('kind');
      const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean);
      let rows = history.filter((sale) => (kind ? sale.kind === kind : true));
      if (statuses?.length) {
        rows = rows.filter((sale) => statuses.includes(sale.status));
      }
      body = url.searchParams.has('page')
        ? {
            items: rows,
            total: rows.length,
            page: Number(url.searchParams.get('page') ?? 1),
            pageSize: Number(url.searchParams.get('pageSize') ?? 30),
          }
        : history;
    } else if (path.startsWith('/sales/')) {
      const id = path.split('/').pop();
      body = history.find((sale) => sale.id === id) ?? repair;
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.context().addInitScript((employee) => {
    window.localStorage.setItem('project-goods.lang', 'en');
    window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
    window.localStorage.setItem(
      'project-goods.employee-snapshot',
      JSON.stringify(employee),
    );
  }, e2eEmployee);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
};

const card = (page: Page) =>
  page.getByRole('dialog', { name: clientRecord.name, exact: true });

const historyRow = (page: Page, number: string) =>
  card(page).locator('tr.clients-history-row').filter({ hasText: number });

const toggle = (page: Page, number: string) =>
  card(page).getByRole('button', {
    name: `Toggle contents of ${number}`,
    exact: true,
  });

const contentsFor = async (button: Locator) => {
  const id = await button.getAttribute('aria-controls');
  return button.page().locator(`[id=${JSON.stringify(id)}]`);
};

const rectOf = (locator: Locator) =>
  locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });

const expectCenteredOnNumber = async (page: Page, number: string) => {
  const linkBox = await rectOf(
    historyRow(page, number).getByRole('link', { name: number, exact: true }),
  );
  const toggleBox = await rectOf(toggle(page, number));
  expect(
    Math.abs(
      linkBox.y + linkBox.height / 2 - (toggleBox.y + toggleBox.height / 2),
    ),
  ).toBeLessThan(2);
};

const expectAttached = async (page: Page, number: string) => {
  const rowBox = await rectOf(historyRow(page, number));
  const detailsBox = await rectOf(await contentsFor(toggle(page, number)));
  expect(Math.abs(detailsBox.y - (rowBox.y + rowBox.height))).toBeLessThanOrEqual(4);
};

const expectNoHorizontalOverflow = async (locator: Locator) => {
  expect(
    await locator.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
};

const copyValue = async (page: Page, target: Locator, expected: string) => {
  const nested = target.locator('.copyable-value');
  const value = (await nested.count()) > 0 ? nested.first() : target;
  const button = value.getByRole('button', { name: 'Copy', exact: true });
  await value.scrollIntoViewIfNeeded();
  await value.hover();
  await expect(button).toHaveCSS('opacity', '1');
  await button.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(expected);
};

const openFromOrders = async (page: Page) => {
  await page.goto('/?page=orders&ordersTab=orders');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  await page.locator('.orders-table .orders-client-link').first().click();
  await expect(card(page)).toBeVisible();
  await expect(page).toHaveURL(/clientCard=client-1/);
};

const openOrdersTab = async (page: Page) => {
  await card(page).getByRole('tab', { name: 'Orders', exact: true }).click();
  await expect(toggle(page, 'r000780')).toBeVisible();
};

const closeProductModel = async (page: Page, name: string) => {
  const model = page.getByRole('dialog', { name, exact: true });
  await expect(model.getByRole('button', { name: 'Save model', exact: true })).toHaveCount(0);
  await model.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(model).toHaveCount(0);
  await expect(card(page)).toBeVisible();
};

test('client card orders and sales keep details on the row and open only from the number', async ({
  page,
}) => {
  await boot(page);
  await openFromOrders(page);
  await openOrdersTab(page);
  await expect(toggle(page, 'r000780')).toHaveAttribute('aria-expanded', 'false');
  await expect(card(page).getByText('Power board', { exact: true })).toHaveCount(0);
  await expectCenteredOnNumber(page, 'r000780');

  await toggle(page, 'r000780').click();
  await toggle(page, 'r000781').click();
  await expect(toggle(page, 'r000780')).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle(page, 'r000781')).toHaveAttribute('aria-expanded', 'true');

  const repairContents = await contentsFor(toggle(page, 'r000780'));
  const part = repairContents.getByRole('listitem').filter({ hasText: 'Power board' });
  await expect(part.getByText('2', { exact: true })).toBeVisible();
  await expect(part.getByText('250,00', { exact: false })).toBeVisible();
  await expect(part.getByRole('button', { name: 'S000111', exact: true })).toBeVisible();
  await expect(repairContents.getByRole('heading', { name: 'Services' })).toBeVisible();
  await expect(repairContents.getByText('BIOS flash', { exact: true })).toBeVisible();
  await expect(repairContents.getByText('SHOULD-NOT-SHOW')).toHaveCount(0);
  await expect(repairContents.getByText(/S\/N:/)).toHaveCount(0);
  const emptyContents = await contentsFor(toggle(page, 'r000781'));
  await expect(emptyContents.getByText('No products or services in this order.')).toBeVisible();
  await expectAttached(page, 'r000780');
  await expectNoHorizontalOverflow(card(page).locator('.orders-table-wrap'));
  await expectNoHorizontalOverflow(repairContents);

  const search = card(page).getByPlaceholder(
    'Search by number, device, serial, status',
  );
  await search.fill('radio');
  await expect(toggle(page, 'r000780')).toHaveCount(0);
  await expect(toggle(page, 'r000781')).toHaveAttribute('aria-expanded', 'true');
  await search.fill('');
  await expect(toggle(page, 'r000780')).toHaveAttribute('aria-expanded', 'true');

  await card(page).getByRole('button', { name: 'Filter', exact: true }).click();
  await card(page).getByRole('combobox', { name: 'Status' }).selectOption('paid');
  await expect(toggle(page, 'r000780')).toHaveCount(0);
  await expect(toggle(page, 'r000781')).toHaveAttribute('aria-expanded', 'true');
  await card(page).getByRole('combobox', { name: 'Status' }).selectOption('all');
  await expect(toggle(page, 'r000780')).toHaveAttribute('aria-expanded', 'true');

  const repairRow = historyRow(page, 'r000780');
  await repairRow.getByText('new', { exact: true }).click();
  await repairRow.getByText('Dell monitor', { exact: true }).click();
  await expect(page).toHaveURL(/clientCard=client-1/);
  await expect(page).not.toHaveURL(/saleId=/);
  await copyValue(
    page,
    repairRow.locator('.clients-history-items > .copyable-value').first(),
    'Dell monitor',
  );

  const rowSerial = repairRow.locator('.clients-history-item-serial');
  await copyValue(page, rowSerial, 'SN-1');
  await expect(page.getByRole('dialog', { name: 'Dell monitor', exact: true })).toHaveCount(0);
  await rowSerial.getByRole('button', { name: 'S/N: SN-1', exact: true }).click();
  const missing = page.getByRole('dialog', { name: 'Dell monitor', exact: true });
  await expect(
    missing.getByText('Purchase information is unavailable for this serial number.'),
  ).toBeVisible();
  await closeProductModel(page, 'Dell monitor');

  const expandedSerial = repairContents.locator('.create-side-request-serial-copy');
  await copyValue(page, expandedSerial, 'S000111');
  await expect(page.getByRole('dialog', { name: 'Power board', exact: true })).toHaveCount(0);
  await expandedSerial.getByRole('button', { name: 'S000111', exact: true }).click();
  const purchase = page.getByRole('region', { name: 'Selected serial purchase' });
  await expect(purchase.getByText('150,00', { exact: false })).toBeVisible();
  await expect(purchase.getByText('12.06.2026', { exact: true })).toBeVisible();
  await expect(purchase.getByText('SO-77', { exact: true })).toBeVisible();
  await closeProductModel(page, 'Power board');

  const repairPopupPromise = page.waitForEvent('popup');
  await repairRow.getByRole('link', { name: 'r000780', exact: true }).click();
  const repairPopup = await repairPopupPromise;
  await expect.poll(() => repairPopup.url()).toMatch(/saleId=sale-repair/);
  await expect.poll(() => repairPopup.url()).not.toMatch(/clientCard/);
  await expect(page).toHaveURL(/clientCard=client-1/);
  await expect(card(page)).toBeVisible();
  await repairPopup.close();

  await card(page).getByRole('tab', { name: 'Sales', exact: true }).click();
  await expect(toggle(page, 's000540')).toHaveAttribute('aria-expanded', 'false');
  const saleRow = historyRow(page, 's000540');
  await expect(saleRow.locator('.clients-history-sale-item .copyable-value-content')).toHaveText([
    'Phone case x1',
    'Cable x2',
  ]);
  await saleRow.getByText('paid', { exact: true }).click();
  await saleRow.getByText('Phone case x1', { exact: true }).click();
  await expect(page).toHaveURL(/clientCard=client-1/);
  await expect(page).not.toHaveURL(/saleId=sale-bundle/);

  const saleItems = saleRow.locator('.clients-history-sale-item');
  await copyValue(page, saleItems.nth(0), 'Phone case');
  await copyValue(page, saleItems.nth(1), 'Cable');

  await toggle(page, 's000540').click();
  await expectCenteredOnNumber(page, 's000540');
  await expectAttached(page, 's000540');
  const saleContents = await contentsFor(toggle(page, 's000540'));
  await expect(saleContents.getByText('Phone case', { exact: true })).toBeVisible();
  await expect(saleContents.getByText('Cable', { exact: true })).toBeVisible();
  await expect(saleContents.getByRole('heading', { name: 'Services' })).toHaveCount(0);
  await expectNoHorizontalOverflow(saleContents);

  const caseSerial = saleRow
    .locator('.clients-history-item-serial')
    .filter({ hasText: 'S000533' });
  await caseSerial.getByRole('button', { name: 'S/N: S000533', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Phone case', exact: true })
      .getByText('Purchase information is unavailable for this serial number.'),
  ).toBeVisible();
  await closeProductModel(page, 'Phone case');

  await saleRow
    .locator('.clients-history-item-serial')
    .filter({ hasText: 'S000900' })
    .getByRole('button', { name: 'S/N: S000900', exact: true })
    .click();
  const cablePurchase = page.getByRole('region', { name: 'Selected serial purchase' });
  await expect(page.getByRole('dialog', { name: 'Cable', exact: true })).toBeVisible();
  await expect(cablePurchase.getByText('40,00', { exact: false })).toBeVisible();
  await expect(cablePurchase.getByText('SO-78', { exact: true })).toBeVisible();
  await closeProductModel(page, 'Cable');

  await card(page).getByRole('tab', { name: 'Orders', exact: true }).click();
  await expect(toggle(page, 'r000780')).toHaveAttribute('aria-expanded', 'false');
  await card(page).getByRole('tab', { name: 'Sales', exact: true }).click();
  const salePopupPromise = page.waitForEvent('popup');
  await saleRow.getByRole('link', { name: 's000540', exact: true }).click();
  const salePopup = await salePopupPromise;
  await expect.poll(() => salePopup.url()).toMatch(/saleId=sale-bundle/);
  await expect.poll(() => salePopup.url()).toMatch(/ordersTab=sales/);
  await expect(page).toHaveURL(/clientCard=client-1/);
  await expect(card(page)).toBeVisible();
});

test('clients list opens the same order and sale details', async ({ page }) => {
  await boot(page);
  await page.goto('/?page=clients');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  await page
    .locator('[data-client-id="client-1"]')
    .getByText('Ada Client', { exact: true })
    .click();
  await expect(card(page)).toBeVisible();
  await openOrdersTab(page);
  await toggle(page, 'r000780').click();
  await expect(
    (await contentsFor(toggle(page, 'r000780'))).getByText('Power board', { exact: true }),
  ).toBeVisible();
  await card(page).getByRole('tab', { name: 'Sales', exact: true }).click();
  await expect(historyRow(page, 's000540').getByText('Phone case x1')).toBeVisible();
  await expect(historyRow(page, 's000540').getByText('Cable x2')).toBeVisible();
});

test.describe('touch client card', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('mobile orders and sales attach details without overflow', async ({ page }) => {
    await boot(page);
    await openFromOrders(page);
    await openOrdersTab(page);
    const ordersToggle = toggle(page, 'r000780');
    await ordersToggle.tap();
    await expect(ordersToggle).toHaveAttribute('aria-expanded', 'true');
    expect((await rectOf(ordersToggle)).height).toBeGreaterThanOrEqual(40);
    await expectCenteredOnNumber(page, 'r000780');
    await expectAttached(page, 'r000780');
    const repairContents = await contentsFor(ordersToggle);
    await expectNoHorizontalOverflow(card(page).locator('.orders-table-wrap'));
    await expectNoHorizontalOverflow(repairContents);
    await expect(repairContents.getByText('BIOS flash', { exact: true })).toBeVisible();

    const repairRow = historyRow(page, 'r000780');
    await repairRow.getByText('Dell monitor', { exact: true }).tap();
    await expect(page).not.toHaveURL(/saleId=/);
    await copyValue(
      page,
      repairRow.locator('.clients-history-items > .copyable-value').first(),
      'Dell monitor',
    );
    await repairRow
      .getByRole('button', { name: 'S/N: SN-1', exact: true })
      .tap();
    await expect(
      page
        .getByRole('dialog', { name: 'Dell monitor', exact: true })
        .getByText('Purchase information is unavailable for this serial number.'),
    ).toBeVisible();
    await closeProductModel(page, 'Dell monitor');

    await card(page).getByRole('tab', { name: 'Sales', exact: true }).click();
    await expect(toggle(page, 'r000780')).toHaveCount(0);
    const salesToggle = toggle(page, 's000540');
    await salesToggle.tap();
    expect((await rectOf(salesToggle)).height).toBeGreaterThanOrEqual(40);
    await expectAttached(page, 's000540');
    const saleContents = await contentsFor(salesToggle);
    await expectNoHorizontalOverflow(saleContents);
    await expect(saleContents.getByText('Cable', { exact: true })).toBeVisible();
    const saleRow = historyRow(page, 's000540');
    await copyValue(page, saleRow.locator('.clients-history-sale-item').nth(1), 'Cable');
    await saleRow.getByText('Cable x2', { exact: true }).tap();
    await expect(page).not.toHaveURL(/saleId=/);
    const salePopupPromise = page.waitForEvent('popup');
    await saleRow.getByRole('link', { name: 's000540', exact: true }).tap();
    const salePopup = await salePopupPromise;
    await expect.poll(() => salePopup.url()).toMatch(/saleId=sale-bundle/);
    await expect(page).toHaveURL(/clientCard=client-1/);
    await expect(card(page)).toBeVisible();
  });
});

const numberLink = (page: Page, number: string) =>
  historyRow(page, number).getByRole('link', { name: number, exact: true });

const openNumberTab = async (page: Page, number: string) => {
  const popupPromise = page.waitForEvent('popup');
  await numberLink(page, number).click();
  return popupPromise;
};

test('client card numbers keep the modal and reuse one tab per order', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await boot(page);
  await openFromOrders(page);
  await openOrdersTab(page);

  const repairPopup = await openNumberTab(page, 'r000780');
  await expect.poll(() => repairPopup.url()).toMatch(/saleId=sale-repair/);
  await expect.poll(() => repairPopup.url()).toMatch(/ordersTab=orders/);
  await expect.poll(() => repairPopup.url()).not.toMatch(/clientCard/);
  await expect(page).toHaveURL(/clientCard=client-1/);
  await expect(card(page)).toBeVisible();

  const pagesAfterRepair = page.context().pages().length;
  await numberLink(page, 'r000780').click();
  await expect.poll(() => repairPopup.evaluate(() => document.hasFocus())).toBe(true);
  expect(page.context().pages()).toHaveLength(pagesAfterRepair);

  const otherPopup = await openNumberTab(page, 'r000781');
  await expect.poll(() => otherPopup.url()).toMatch(/saleId=sale-empty/);
  const pagesWithBoth = page.context().pages().length;
  expect(pagesWithBoth).toBeGreaterThan(pagesAfterRepair);

  await numberLink(page, 'r000780').click();
  await expect.poll(() => repairPopup.evaluate(() => document.hasFocus())).toBe(true);
  expect(page.context().pages()).toHaveLength(pagesWithBoth);

  await repairPopup.close();
  const reopened = await openNumberTab(page, 'r000780');
  await expect.poll(() => reopened.url()).toMatch(/saleId=sale-repair/);
  expect(reopened).not.toBe(repairPopup);

  const beforeModified = page.context().pages().length;
  await numberLink(page, 'r000781').click({ modifiers: ['Control'] });
  await expect.poll(() => page.context().pages().length).toBe(beforeModified + 1);
  await expect(page).toHaveURL(/clientCard=client-1/);
  await expect(card(page)).toBeVisible();

  await numberLink(page, 'r000781').click({ button: 'middle' });
  await expect.poll(() => page.context().pages().length).toBe(beforeModified + 2);
  await expect(card(page)).toBeVisible();

  await numberLink(page, 'r000781').click({ button: 'right' });
  expect(page.context().pages()).toHaveLength(beforeModified + 2);
  await expect(card(page)).toBeVisible();

  const plainPages = page.context().pages().length;
  await numberLink(page, 'r000781').click();
  await expect.poll(() => otherPopup.evaluate(() => document.hasFocus())).toBe(true);
  expect(page.context().pages()).toHaveLength(plainPages);

  let serialOpened = false;
  const onSerialPopup = () => {
    serialOpened = true;
  };
  page.on('popup', onSerialPopup);
  await historyRow(page, 'r000780')
    .getByRole('button', { name: 'S/N: SN-1', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Dell monitor', exact: true }),
  ).toBeVisible();
  expect(serialOpened).toBe(false);
  page.off('popup', onSerialPopup);
  await closeProductModel(page, 'Dell monitor');

  await card(page).getByRole('tab', { name: 'Sales', exact: true }).click();
  const salePopup = await openNumberTab(page, 's000540');
  await expect.poll(() => salePopup.url()).toMatch(/saleId=sale-bundle/);
  await expect.poll(() => salePopup.url()).toMatch(/ordersTab=sales/);
  await expect(card(page)).toBeVisible();
  await salePopup.close();

  await page.goto('/?page=clients');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  await page
    .locator('[data-client-id="client-1"]')
    .getByText('Ada Client', { exact: true })
    .click();
  await expect(card(page)).toBeVisible();
  await openOrdersTab(page);
  const clientsPopup = await openNumberTab(page, 'r000780');
  await expect.poll(() => clientsPopup.url()).toMatch(/saleId=sale-repair/);
  await expect(page).toHaveURL(/page=clients/);
  await expect(card(page)).toBeVisible();
  const clientsPages = page.context().pages().length;
  await numberLink(page, 'r000780').click();
  await expect.poll(() => clientsPopup.evaluate(() => document.hasFocus())).toBe(true);
  expect(page.context().pages()).toHaveLength(clientsPages);
});
