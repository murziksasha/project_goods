import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Client } from '../src/entities/client';
import type { Sale } from '../src/entities/sale';
import type { Supplier } from '../src/entities/supplier';
import {
  isPhoneLikeQuery,
  phonesMatchQuery,
} from '../src/shared/lib/phone-search';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-11-03T12:00:00.000Z';

const salePhones = (sale: Sale) =>
  sale.client.phones?.length
    ? sale.client.phones
    : sale.client.phone
      ? [sale.client.phone]
      : [];

const textIncludes = (
  values: Array<string | null | undefined>,
  needle: string,
) => values.some((value) => (value ?? '').toLowerCase().includes(needle));

const matchesList = (sale: Sale, query: string, tab: 'orders' | 'sales') => {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const needle = trimmed.toLowerCase();
  if ((sale.recordNumber ?? '').toLowerCase().includes(needle)) return true;
  const phones = salePhones(sale);
  if (phonesMatchQuery(phones, trimmed)) return true;
  const values: Array<string | null | undefined> = [
    sale.client.name,
    sale.note,
    sale.userNote,
  ];
  if (tab === 'sales') {
    values.push(sale.manager?.name, sale.issuedBy?.name);
    const snapshotId = sale.product?.id;
    if (
      snapshotId &&
      (sale.lineItems ?? []).some(
        (item) => item.kind === 'product' && item.productId === snapshotId,
      )
    ) {
      values.push(sale.product?.article);
    }
  } else {
    values.push(
      sale.product?.name,
      sale.product?.serialNumber,
      sale.product?.article,
    );
  }
  for (const item of sale.lineItems ?? []) {
    values.push(item.name);
    for (const serial of item.serialNumbers ?? []) values.push(serial);
  }
  if (!isPhoneLikeQuery(trimmed)) values.push(...phones);
  return textIncludes(values, needle);
};

const matchesClient = (sale: Sale, query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const needle = trimmed.toLowerCase();
  if ((sale.recordNumber ?? '').toLowerCase().includes(needle)) return true;
  if (sale.client.name.toLowerCase().includes(needle)) return true;
  const phones = salePhones(sale);
  if (phonesMatchQuery(phones, trimmed)) return true;
  if (isPhoneLikeQuery(trimmed)) return false;
  return phones.some((phone) => phone.toLowerCase().includes(needle));
};

const repair = (patch: Partial<Sale> & Pick<Sale, 'id' | 'recordNumber'>): Sale => ({
  saleDate: iso,
  quantity: 1,
  salePrice: 100,
  kind: 'repair',
  status: 'new',
  paidAmount: 0,
  note: '',
  userNote: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'client-ivan',
    name: 'Ivan',
    phone: '+380671112233',
    phones: ['+380671112233', '+380 (63) 111-22-33'],
    status: 'new',
  },
  product: {
    id: 'product-tv',
    name: 'Nokia TV',
    serialNumber: 'SN-40',
    article: 'ART-9',
  },
  manager: { id: 'manager-1', name: 'Olena', role: 'manager' },
  master: null,
  issuedBy: null,
  createdAt: iso,
  updatedAt: iso,
  ...patch,
});

const ivanRepair = repair({ id: 'order-ivan', recordNumber: 'r000101' });
const annaRepair = repair({
  id: 'order-anna',
  recordNumber: 'r000102',
  status: 'diagnostics',
  note: 'callback tomorrow',
  client: {
    id: 'client-anna',
    name: 'Anna',
    phone: '+380501111111',
    phones: ['+380501111111'],
    status: 'ok',
  },
  product: {
    id: 'product-cable',
    name: 'Cable',
    serialNumber: 'S000123',
    article: 'ART-1',
  },
  lineItems: [
    {
      id: 'line-cable',
      kind: 'product',
      name: 'Cable',
      price: 80,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: ['S000123'],
    },
  ],
});
const foreignRepair = repair({
  id: 'order-foreign',
  recordNumber: 'r000103',
  client: {
    id: 'client-petra',
    name: 'Petra',
    phone: '+48 111 222 333',
    phones: ['+48 111 222 333'],
    status: 'new',
  },
  product: {
    id: 'product-radio',
    name: 'Radio',
    serialNumber: '',
    article: '',
  },
});

const ivanSale: Sale = {
  ...ivanRepair,
  id: 'sale-ivan',
  recordNumber: 'r000201',
  kind: 'sale',
  note: 'left a voicemail',
  product: {
    id: 'product-1',
    name: 'Old Nokia',
    serialNumber: 'SNAP-1',
    article: 'ART-1',
  },
  lineItems: [
    {
      id: 'line-sale',
      kind: 'product',
      productId: 'product-1',
      name: 'Cable',
      price: 80,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: ['S000123'],
    },
  ],
  manager: { id: 'manager-1', name: 'Olena', role: 'manager' },
  issuedBy: { id: 'issuer-1', name: 'Petro', role: 'manager' },
};
const martaSale: Sale = {
  ...ivanSale,
  id: 'sale-marta',
  recordNumber: 'r000202',
  status: 'issued',
  note: '',
  userNote: '',
  client: {
    id: 'client-marta',
    name: 'Marta',
    phone: '+380991112233',
    phones: ['+380991112233'],
    status: 'new',
  },
  manager: { id: 'manager-2', name: 'Petro', role: 'manager' },
  lineItems: [
    {
      id: 'line-adapter',
      kind: 'product',
      productId: 'other',
      name: 'Adapter',
      price: 10,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
};

const sales = [ivanRepair, annaRepair, foreignRepair, ivanSale, martaSale];

const clients: Client[] = [
  {
    id: 'client-ivan',
    name: 'Ivan',
    phone: '+380671112233',
    phones: ['+380671112233', '+380 (63) 111-22-33'],
    email: '',
    address: '',
    registrationId: '',
    iban: '',
    note: 'prefers morning',
    status: 'new',
    createdAt: iso,
    updatedAt: iso,
  },
  {
    id: 'client-anna',
    name: 'Anna',
    phone: '+380501111111',
    phones: ['+380501111111'],
    email: '',
    address: '',
    registrationId: '',
    iban: '',
    note: '',
    status: 'blacklist',
    createdAt: iso,
    updatedAt: iso,
  },
];

const suppliers: Supplier[] = [
  {
    id: 'supplier-main',
    name: 'Main Parts',
    phone: '+380671112233',
    phones: ['+380671112233', '+380 (63) 111-22-33'],
    supplierOrder: 'SO-1',
    note: 'call before noon',
    isActive: true,
    createdAt: iso,
    updatedAt: iso,
  },
  {
    id: 'supplier-other',
    name: 'Other Supply',
    phone: '+380501111111',
    phones: ['+380501111111'],
    supplierOrder: 'SO-2',
    note: '',
    isActive: true,
    createdAt: iso,
    updatedAt: iso,
  },
];

const boot = async (page: Page) => {
  await installE2eApiMocks(page);
  await page.route(
    (url) => url.pathname === '/api/sales' || url.pathname.startsWith('/api/sales/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() !== 'GET') {
        await route.fallback();
        return;
      }
      if (url.pathname !== '/api/sales') {
        const sale = sales.find((item) => url.pathname === `/api/sales/${item.id}`);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(sale ?? { occupied: [] }),
        });
        return;
      }

      const kind = url.searchParams.get('kind');
      const query = url.searchParams.get('q') ?? '';
      const client = url.searchParams.get('client') ?? '';
      const statuses = url.searchParams.get('statuses');
      const tab = kind === 'sale' ? 'sales' : 'orders';
      let items = sales.filter((sale) => (kind ? sale.kind === kind : true));
      if (query) {
        items = items.filter((sale) => matchesList(sale, query, tab));
      }
      if (client) {
        items = items.filter((sale) => matchesClient(sale, client));
      }
      if (statuses) {
        const allowed = new Set(statuses.split(',').filter(Boolean));
        items = items.filter((sale) => allowed.has(sale.status));
      }
      const body = url.searchParams.has('page')
        ? { items, total: items.length, page: 1, pageSize: 30 }
        : items;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    },
  );
  await page.route(
    (url) => url.pathname === '/api/clients' || url.pathname.startsWith('/api/clients/'),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/clients') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clients),
        });
        return;
      }
      await route.fallback();
    },
  );
  await page.route(
    (url) => url.pathname === '/api/suppliers',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(suppliers),
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
    window.localStorage.removeItem('project-goods.clients-suppliers-tab');
    window.localStorage.removeItem('project-goods.clients-active-filters');
  }, e2eEmployee);
  await page.goto('/?page=orders&ordersTab=orders');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
};

const searchOrders = async (page: Page, value: string) => {
  const input = page.getByRole('textbox', { name: 'Search orders' });
  await input.fill(value);
};

test('phone search finds orders, sales, clients, and suppliers', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  await expect(page.getByRole('link', { name: /r000101/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /r000102/i })).toBeVisible();

  await searchOrders(page, '+38063');
  await expect(page.getByRole('link', { name: /r000101/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /r000102/i })).toHaveCount(0);
  await expect(page.getByTitle('+380671112233')).toBeVisible();
  await expect(page.getByTitle('+380 (63) 111-22-33')).toBeVisible();
  const singleOrder = page.getByRole('button', { name: 'Orders: 1' });
  await expect(singleOrder).toBeVisible();
  await singleOrder.click();
  await expect(page.locator('.order-detail-card')).toBeVisible();
  await page.locator('.order-detail-close-button').click();
  await expect(page.locator('.order-detail-card')).toHaveCount(0);

  await searchOrders(page, '+380');
  await expect(page.getByText('Orders not found.')).toBeVisible();

  await searchOrders(page, 'S000123');
  await expect(page.getByRole('link', { name: /r000102/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /r000101/i })).toHaveCount(0);

  await searchOrders(page, 'callback');
  await expect(page.getByRole('link', { name: /r000102/i })).toBeVisible();

  await searchOrders(page, '+48 111');
  await expect(page.getByRole('link', { name: /r000103/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /r000101/i })).toHaveCount(0);

  await searchOrders(page, '');
  await page.getByRole('button', { name: /Filter/i }).click();
  await page.getByPlaceholder('Client name or phone (+38063, 063)').fill('(063) 111-22-33');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('link', { name: /r000101/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /r000102/i })).toHaveCount(0);
  await expect(page.getByTitle('+380 (63) 111-22-33')).toBeVisible();

  await page.getByRole('tab', { name: 'Sales' }).click();
  await expect(page).toHaveURL(/ordersTab=sales/);
  await searchOrders(page, 'Olena');
  await expect(page.getByRole('link', { name: /r000201/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /r000202/i })).toHaveCount(0);

  await searchOrders(page, 'Old Nokia');
  await expect(page.getByText('Sales not found.')).toBeVisible();

  await searchOrders(page, 'voicemail');
  await expect(page.getByRole('link', { name: /r000201/i })).toBeVisible();
  await expect(page.getByTitle('+380 (63) 111-22-33')).toHaveCount(0);

  await searchOrders(page, '+38063');
  await expect(page.getByRole('button', { name: 'Sales: 1' })).toBeVisible();
  await expect(page.getByTitle('+380 (63) 111-22-33')).toBeVisible();

  await page.goto('/?page=clients');
  await expect(page.getByRole('textbox', { name: 'Search client' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search client' }).fill('+38063');
  await expect(page.getByText('Ivan')).toBeVisible();
  await expect(page.getByText('Anna')).toHaveCount(0);
  await expect(page.getByTitle('+380 (63) 111-22-33')).toBeVisible();

  await page.getByRole('textbox', { name: 'Search client' }).fill('+380');
  await expect(page.getByText('Ivan')).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Search client' }).fill('morning');
  await expect(page.getByText('Ivan')).toBeVisible();

  await page.getByRole('textbox', { name: 'Search client' }).fill('S000123');
  await expect(page.getByText('Ivan')).toHaveCount(0);
  await expect(page.getByText('Anna')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Suppliers' }).click();
  await page.getByRole('textbox', { name: 'Search supplier' }).fill('+38063');
  await expect(page.getByText('Main Parts')).toBeVisible();
  await expect(page.getByText('Other Supply')).toHaveCount(0);
  await expect(page.getByTitle('+380 (63) 111-22-33')).toBeVisible();

  await page.getByRole('textbox', { name: 'Search supplier' }).fill('+380');
  await expect(page.getByText('Main Parts')).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Search supplier' }).fill('SO-1');
  await expect(page.getByText('Main Parts')).toBeVisible();

  await page.getByRole('textbox', { name: 'Search supplier' }).fill('before noon');
  await expect(page.getByText('Main Parts')).toBeVisible();
  await expect(page.getByTitle('+380 (63) 111-22-33')).toHaveCount(0);
});
