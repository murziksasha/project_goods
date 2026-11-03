import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Sale } from '../src/entities/sale';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-08-31T12:00:00.000Z';

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
    id: clientRecord.id,
    name: clientRecord.name,
    phone: clientRecord.phone,
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

const bootOrders = async (page: Page) => {
  await installE2eApiMocks(page);
  await page.route(
    (url) => url.pathname.startsWith('/api/clients'),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path.endsWith('/history')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            client: clientRecord,
            sales: [repair],
            stats: { totalSales: 1, totalRevenue: 0, totalItemsSold: 0 },
          }),
        });
        return;
      }
      if (request.method() === 'PUT') {
        const posted = (request.postDataJSON() ?? {}) as {
          name?: string;
        };
        clientRecord.name = posted.name ?? clientRecord.name;
        clientRecord.updatedAt = '2026-09-01T12:00:00.000Z';
        repair.client = {
          ...repair.client,
          name: clientRecord.name,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clientRecord),
        });
        return;
      }
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([clientRecord]),
        });
        return;
      }
      await route.fallback();
    },
  );
  await page.route(
    (url) =>
      url.pathname === '/api/sales' ||
      url.pathname.startsWith('/api/sales/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() !== 'GET') {
        await route.fallback();
        return;
      }
      const body =
        url.pathname === '/api/sales'
          ? url.searchParams.has('page')
            ? { items: [repair], total: 1, page: 1, pageSize: 30 }
            : [repair]
          : repair;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
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
  await page.goto('/?page=orders&ordersTab=orders');
  await expect(page.locator('.dashboard-shell')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('.orders-client-link')).toBeVisible();
};

test('orders list opens the client card without leaving Orders', async ({
  page,
}) => {
  await bootOrders(page);
  await page.locator('.orders-table .orders-client-link').click();

  await expect(page).toHaveURL(/page=orders/);
  await expect(page).toHaveURL(/ordersTab=orders/);
  await expect(page).toHaveURL(/clientCard=client-1/);
  await expect(page).not.toHaveURL(/page=clients/);
  await expect(
    page.locator('.sidebar-nav').getByRole('link', { name: 'Orders' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save client' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Client list' })).toBeVisible();

  const ordersLink = page
    .locator('.sidebar-nav')
    .getByRole('link', { name: 'Orders' });
  const linkBox = await ordersLink.boundingBox();
  expect(linkBox).toBeTruthy();
  const hit = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('.modal-backdrop, .app-sidebar')?.className ?? '',
    {
      x: linkBox!.x + linkBox!.width / 2,
      y: linkBox!.y + Math.min(24, linkBox!.height / 2),
    },
  );
  expect(hit).toContain('modal-backdrop');

  await page.goBack();
  await expect(page).not.toHaveURL(/clientCard/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/page=orders/);

  await page.goForward();
  await expect(page).toHaveURL(/clientCard=client-1/);
  await expect(page.getByRole('button', { name: 'Save client' })).toBeVisible();
});

test('Client list selects the row and Back returns to Orders', async ({
  page,
}) => {
  await bootOrders(page);
  await page.locator('.orders-table .orders-client-link').click();
  await page.getByRole('button', { name: 'Client list' }).click();

  await expect(page).toHaveURL(/page=clients/);
  await expect(page).not.toHaveURL(/clientCard/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-client-id="client-1"]')).toHaveClass(
    /clients-table-row-active/,
  );
  await expect(
    page.locator('.sidebar-nav').getByRole('link', { name: 'Clients & suppliers' }),
  ).toHaveAttribute('aria-current', 'page');

  await page.goBack();
  await expect(page).toHaveURL(/page=orders/);
  await expect(page).not.toHaveURL(/clientCard/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('order card keeps saleId when the client card opens', async ({
  page,
}) => {
  await bootOrders(page);
  await page.getByRole('link', { name: 'r001312' }).click();
  await expect(page).toHaveURL(/saleId=sale-repair/);

  await page.locator('.order-detail-list .orders-client-link').click();
  await expect(page).toHaveURL(/page=orders/);
  await expect(page).toHaveURL(/saleId=sale-repair/);
  await expect(page).toHaveURL(/clientCard=client-1/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Saturn TV').first()).toBeVisible();
});
