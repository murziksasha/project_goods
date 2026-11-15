import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Product } from '../src/entities/product';
import type { Sale } from '../src/entities/sale';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-11-10T12:00:00.000Z';
const longName = `Capacitor-${'high-voltage-'.repeat(12)}`;
const longSerial = `S-${'0123456789'.repeat(14)}`;
const client = {
  id: 'history-client', name: 'Ada History', phone: '+380991112233',
  phones: ['+380991112233'], status: 'ok', email: '', address: '',
  registrationId: '', iban: '', note: '', createdAt: iso, updatedAt: iso,
};
const otherClient = {
  ...client, id: 'other-client', name: 'Other History',
  phone: '+380997778899', phones: ['+380997778899'],
};
const soldProduct: Product = {
  id: 'sold-capacitor', name: longName, article: 'CAP-1', serialNumber: longSerial,
  price: 150, salePriceOptions: [250, 200], quantity: 0, reservedQuantity: 0,
  freeQuantity: 0, isInStock: false, isActive: true, note: '', purchasePlace: '',
  purchaseDate: '2026-06-12T09:00:00.000Z', warrantyPeriod: 1,
  supplierOrderId: 'history-supplier-order', supplierOrderItemIndex: 0,
  createdAt: iso, updatedAt: iso,
};
const repair: Sale = {
  id: 'history-repair', recordNumber: 'r001405', saleDate: iso,
  quantity: 1, salePrice: 850, kind: 'repair', status: 'issued', paidAmount: 850,
  note: '', timeline: [], paymentHistory: [],
  lineItems: [
    { id: 'part', kind: 'product', name: longName, productId: soldProduct.id,
      price: 250, quantity: 2, warrantyPeriod: 1, serialNumbers: [longSerial, 'MISSING-SERIAL'] },
    { id: 'service', kind: 'service', name: 'Capacitor replacement', price: 350,
      quantity: 1, warrantyPeriod: 1, serialNumbers: [] },
  ],
  product: { id: '', name: 'LG microwave', article: 'REPAIR', serialNumber: 'DEVICE-SERIAL' },
  client, manager: null, master: null, issuedBy: null, createdAt: iso, updatedAt: iso,
};
const secondRepair: Sale = {
  ...repair, id: 'history-repair-2', recordNumber: 'r001406', lineItems: [],
  product: { id: '', name: '', article: 'REPAIR', serialNumber: '' },
};
const sale: Sale = {
  ...repair, id: 'history-sale', recordNumber: 's001407', kind: 'sale',
  product: { id: '', name: 'Old sale snapshot', article: '', serialNumber: '' },
};
const history = [repair, secondRepair, sale];

interface BootOptions {
  kind?: 'repair' | 'sale';
  dark?: boolean;
  supplierPermission?: boolean;
}

const bootHistory = async (page: Page, options: BootOptions = {}) => {
  const employee = options.supplierPermission === false
    ? { ...e2eEmployee, role: 'support', permissions: ['orders.view', 'orders.manage', 'sales.manage'] }
    : e2eEmployee;
  let supplierRequests = 0;
  await installE2eApiMocks(page);
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    let body: unknown;
    if (path === '/auth/me') body = employee;
    else if (path === '/clients') body = [client, otherClient];
    else if (path.endsWith('/history')) {
      const current = path.includes(otherClient.id) ? otherClient : client;
      body = {
        client: current,
        sales: history.map((entry) => ({ ...entry, client: current })),
        stats: { totalSales: history.length, totalRevenue: 2550, totalItemsSold: 3 },
      };
    } else if (path === '/products') body = [soldProduct];
    else if (path === '/warehouse-settings') {
      body = { id: 'wh-settings', warehouses: [], serviceCenters: [], administrators: [], createdAt: iso, updatedAt: iso };
    } else if (path === '/supplier-orders') {
      supplierRequests += 1;
      body = [{
        id: 'history-supplier-order', orderBaseId: 'SO-77', number: 'SO-77',
        supplierId: 'supplier-1', supplierName: 'Capacitor supplier',
        status: 'stocked', paymentStatus: 'paid', receiptStatus: 'received',
        deliveryDate: iso, supplyType: 'Local', note: '', createdBy: 'Owner',
        total: 150, paid: 150, isFavorite: false, createdAt: iso, updatedAt: iso,
        items: [{ lineId: 'received-part', itemIndex: 0, productName: longName, quantity: 1, price: 150, receiptStatus: 'received' }],
      }];
    } else if (path === '/sales/occupied-serials') body = { occupied: [] };
    else if (path === '/sales') {
      body = url.searchParams.has('page')
        ? { items: history, total: history.length, page: 1, pageSize: 30 }
        : history;
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.addInitScript(({ employee, dark }) => {
    localStorage.setItem('project-goods.lang', 'en');
    localStorage.setItem('project-goods.auth-token', 'e2e-token');
    localStorage.setItem('project-goods.employee-snapshot', JSON.stringify(employee));
    localStorage.setItem('project-goods.ui-theme', dark ? 'dark' : 'light');
  }, { employee, dark: options.dark });
  await page.goto(`/?page=orders&ordersTab=${options.kind === 'sale' ? 'sales' : 'orders'}&createOrder=${options.kind ?? 'repair'}`);
  await expect(page.locator('.create-order-phone-input')).toBeVisible({ timeout: 20_000 });
  await page.locator('.create-order-phone-input').fill(client.phone);
  await expect(page.getByPlaceholder('Full name')).toHaveValue(client.name);
  await expect(page.locator('.create-side-list-link').first()).toBeVisible();
  return { supplierRequests: () => supplierRequests };
};

const sidebar = (page: Page) => page.locator('.create-order-right');
const toggle = (page: Page, number: string) => sidebar(page).getByRole('button', { name: `Toggle contents of ${number}`, exact: true });
const contents = async (button: Locator) => {
  const id = await button.getAttribute('aria-controls');
  return button.page().locator(`[id=${JSON.stringify(id)}]`);
};

for (const kind of ['repair', 'sale'] as const) {
  test(`create ${kind}: history expands independently, resets, and preserves the draft after serial inspection`, async ({ page }) => {
    await bootHistory(page, { kind });
    const requests = sidebar(page);
    if (kind === 'sale') await requests.getByRole('button', { name: 'Orders', exact: true }).click();
    const firstToggle = toggle(page, 'r001405');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(requests.getByText('LG microwave', { exact: true })).toBeVisible();
    await expect(requests.getByText('Device not specified', { exact: true })).toBeVisible();
    await expect(requests.getByText('Capacitor replacement', { exact: true })).toBeHidden();
    const link = requests.getByRole('link', { name: 'r001405', exact: true });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('href', /saleId=history-repair/);
    const linkBox = await link.boundingBox();
    const toggleBox = await firstToggle.boundingBox();
    expect(linkBox).not.toBeNull();
    expect(toggleBox).not.toBeNull();
    expect(Math.abs(
      (linkBox!.y + linkBox!.height / 2) - (toggleBox!.y + toggleBox!.height / 2),
    )).toBeLessThan(2);

    await firstToggle.focus();
    await page.keyboard.press('Enter');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    const firstContents = await contents(firstToggle);
    await expect(firstContents.getByText('Capacitor replacement', { exact: true })).toBeVisible();
    await expect(firstContents.getByText('500,00', { exact: false })).toBeVisible();
    const secondToggle = toggle(page, 'r001406');
    await secondToggle.click();
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    await expect((await contents(secondToggle)).getByText('No products or services in this order.')).toBeVisible();

    if (kind === 'repair') await page.getByPlaceholder('Enter device name').fill('Draft device must survive');
    await firstContents.getByRole('button', { name: longSerial, exact: true }).click();
    const selected = page.getByRole('region', { name: 'Selected serial purchase' });
    await expect(selected).toBeVisible();
    await expect(selected.getByText('150,00', { exact: false })).toBeVisible();
    await expect(selected.getByText('12.06.2026', { exact: true })).toBeVisible();
    await expect(selected.getByText('SO-77', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Save model', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByPlaceholder('Full name')).toHaveValue(client.name);
    if (kind === 'repair') await expect(page.getByPlaceholder('Enter device name')).toHaveValue('Draft device must survive');

    await requests.getByRole('button', { name: 'Sales', exact: true }).click();
    const saleToggle = toggle(page, 's001407');
    await expect(saleToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(requests.locator('.create-side-list-item > span').filter({ hasText: longName })).toBeVisible();
    await saleToggle.click();
    await expect((await contents(saleToggle)).getByText('Capacitor replacement', { exact: true })).toBeVisible();
    await requests.getByRole('button', { name: 'Orders', exact: true }).click();
    await expect(toggle(page, 'r001405')).toHaveAttribute('aria-expanded', 'false');
    await toggle(page, 'r001405').click();
    await page.locator('.create-order-phone-input').fill(otherClient.phone);
    await expect(page.getByPlaceholder('Full name')).toHaveValue(otherClient.name);
    await expect(toggle(page, 'r001405')).toHaveAttribute('aria-expanded', 'false');
  });
}

test.describe('touch history', () => {
  test.use({ hasTouch: true });

  test('dark history contains long names and serials and explains missing purchase data', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootHistory(page, { dark: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await toggle(page, 'r001405').tap();
    const firstContents = await contents(toggle(page, 'r001405'));
    const serial = firstContents.getByRole('button', { name: longSerial, exact: true });
    await serial.scrollIntoViewIfNeeded();
    const containment = await serial.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const container = element.closest('.create-order-right')!.getBoundingClientRect();
      return { width: bounds.width, left: bounds.left, right: bounds.right, containerLeft: container.left, containerRight: container.right, height: bounds.height };
    });
    expect(containment.left).toBeGreaterThanOrEqual(containment.containerLeft - 1);
    expect(containment.right).toBeLessThanOrEqual(containment.containerRight + 1);
    expect(containment.height).toBeGreaterThanOrEqual(40);
    await expect(firstContents).toBeVisible();
    await page.screenshot({ path: 'test-results/create-order-history-mobile-dark.png', fullPage: true });
    await firstContents.getByRole('button', { name: 'MISSING-SERIAL', exact: true }).tap();
    const selected = page.getByRole('region', { name: 'Selected serial purchase' });
    await expect(selected.getByText('MISSING-SERIAL', { exact: true })).toBeVisible();
    await expect(selected.getByText('Purchase information is unavailable for this serial number.')).toBeVisible();
    expect(await selected.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const header = await page.locator('.product-model-modal > .catalog-edit-header').boundingBox();
    expect(header).not.toBeNull();
    expect(header!.height).toBeLessThan(250);
    const unavailable = selected.getByText('Purchase information is unavailable for this serial number.');
    await unavailable.scrollIntoViewIfNeeded();
    await expect(unavailable).toBeInViewport();
    await page.screenshot({ path: 'test-results/create-order-history-missing-serial-mobile.png', fullPage: true });
    await page.keyboard.press('Escape');
    await expect(toggle(page, 'r001405')).toHaveAttribute('aria-expanded', 'true');
  });
});

test('serial inspection respects supplier access and can retry failed purchase loading', async ({ page }) => {
  const state = await bootHistory(page, { supplierPermission: false });
  await page.route('**/api/products*', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary product failure' }) });
  });
  // Wait for the initial products cache to become stale without changing the app clock.
  await page.clock.install();
  await page.clock.fastForward(31_000);
  await toggle(page, 'r001405').click();
  const firstContents = await contents(toggle(page, 'r001405'));
  await firstContents.getByRole('button', { name: longSerial, exact: true }).click();
  const error = page.getByRole('alert').filter({ hasText: 'Could not load purchase information for this serial number.' });
  await expect(error).toBeVisible();
  await page.unroute('**/api/products*');
  await error.getByRole('button', { name: 'Retry', exact: true }).click();
  const selected = page.getByRole('region', { name: 'Selected serial purchase' });
  await expect(selected).toBeVisible();
  await expect(selected.getByText('150,00', { exact: false })).toBeVisible();
  expect(state.supplierRequests()).toBe(0);
  await expect(selected.getByText('SO-77', { exact: true })).toHaveCount(0);
});
