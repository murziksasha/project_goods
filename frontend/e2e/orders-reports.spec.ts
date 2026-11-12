import { expect, test, type Page } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const tablePayload = (kind: string, extras: Record<string, unknown> = {}) => ({
  generatedAt: '2026-11-11T10:00:00.000Z',
  timeZone: 'Europe/Kiev',
  period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
  mode: 'register',
  groupBy: [],
  items: [
    {
      id: 'r1',
      recordNumber: 'R000010',
      displayNumber: 'PO-1',
      clientId: 'c1',
      clientName: 'Ada Client',
      clientPhone: '+380991112233',
      deviceName: 'iPhone',
      serialNumber: 'SN1',
      masterId: 'm1',
      masterName: 'Alex',
      managerId: 'emp-e2e',
      managerName: 'E2E Admin',
      status: kind === 'sales' ? 'paid' : 'inRepair',
      intakeDate: '2026-11-01T10:00:00.000Z',
      completedAt: null,
      issuedAt: null,
      turnaroundHours: 24,
      saleDate: '2026-11-01T10:00:00.000Z',
      createdAt: '2026-11-01T10:00:00.000Z',
      deliveryDate: '2026-11-10',
      units: 2,
      gross: 2000,
      discount: 0,
      net: 2000,
      total: 1500,
      paid: 500,
      debt: 1000,
      paidCash: 500,
      paidNonCash: 0,
      returnCount: 0,
      returnAmount: 0,
      servicesCount: 1,
      productsCount: 1,
      supplierId: 'sup-1',
      supplierName: 'TechDist',
      paymentStatus: 'partial',
      receiptStatus: 'pending',
      isOverdue: false,
      orderedUnits: 4,
      receivedUnits: 0,
      outstanding: 1500,
      stockedAt: null,
      itemNames: ['Board'],
    },
  ],
  groups: [
    {
      key: 'inRepair',
      label: 'In repair group',
      field: 'status',
      level: 1,
      filters: { status: 'inRepair' },
      count: 1,
      total: 1500,
      paid: 500,
      debt: 1000,
      avgTurnaroundHours: 24,
      children: [],
    },
  ],
  grandTotal: {
    key: 'grand',
    label: 'Total',
    field: 'status',
    level: 1,
    filters: {},
    count: 1,
    total: 1500,
    paid: 500,
    debt: 1000,
    avgTurnaroundHours: 24,
  },
  total: 1,
  page: 1,
  pageSize: 25,
  nextCursor: null,
  coverage: { warnings: [], warningItems: [] },
  supplierOptions: [{ id: 'sup-1', name: 'TechDist' }],
  ...extras,
});

const installOrdersReportsMocks = async (page: Page) => {
  let exportCalls = 0;
  await page.route(
    (url) => {
      const path = url.pathname.replace(/^\/api/, '');
      return (
        path.startsWith('/reports/orders/table/') ||
        path === '/scenarios' ||
        path.startsWith('/scenarios/')
      );
    },
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api/, '');
      const fulfillJson = async (body: unknown, status = 200) => {
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      };

      if (path === '/scenarios' && request.method() === 'GET') {
        await fulfillJson([]);
        return;
      }
      if (path === '/scenarios' && request.method() === 'POST') {
        const payload = request.postDataJSON() as Record<string, unknown>;
        await fulfillJson(
          {
            id: 'sc-e2e',
            employeeId: 'emp-e2e',
            domain: 'ordersReport',
            name: payload.name ?? 'Preset',
            horizonDays: 30,
            assumptions: payload.assumptions ?? {},
            filters: {},
            createdAt: '2026-11-11T10:00:00.000Z',
            updatedAt: '2026-11-11T10:00:00.000Z',
          },
          201,
        );
        return;
      }
      if (path.endsWith('/export')) {
        exportCalls += 1;
        const kind = path.includes('sales')
          ? 'sales'
          : path.includes('procurement')
            ? 'procurement'
            : 'repairs';
        const items = Array.from({ length: exportCalls === 1 ? 1000 : 205 }, (_, i) => ({
          id: `r${exportCalls === 1 ? i : 1000 + i}`,
          recordNumber: `R${String(exportCalls === 1 ? i : 1000 + i).padStart(6, '0')}`,
          clientName: 'Ada Client',
          deviceName: 'iPhone',
          masterName: 'Alex',
          status: 'inRepair',
          intakeDate: '2026-11-01T10:00:00.000Z',
          total: 100,
          paid: 50,
          debt: 50,
        }));
        await fulfillJson(
          tablePayload(kind, {
            items,
            total: 1205,
            page: exportCalls,
            pageSize: 1000,
            nextCursor: exportCalls === 1 ? 'c2' : null,
          }),
        );
        return;
      }
      if (path.startsWith('/reports/orders/table/')) {
        const kind = path.endsWith('sales')
          ? 'sales'
          : path.endsWith('procurement')
            ? 'procurement'
            : 'repairs';
        await fulfillJson(tablePayload(kind));
        return;
      }
      await route.fallback();
    },
  );
  return () => exportCalls;
};

test('Orders Reports tab renders register, kind/mode switchers, and column picker', async ({
  page,
}) => {
  await installE2eApiMocks(page);
  await installOrdersReportsMocks(page);
  await page.addInitScript((employee) => {
    window.localStorage.setItem('project-goods.lang', 'en');
    window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
    window.localStorage.setItem(
      'project-goods.employee-snapshot',
      JSON.stringify(employee),
    );
  }, e2eEmployee);
  await page.goto('/?page=orders&ordersTab=ordersReports');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  const kinds = page.getByLabel('Report kind');
  await expect(kinds.getByRole('tab', { name: 'Repairs' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(kinds.getByRole('tab', { name: 'Sales' })).toBeVisible();
  await expect(kinds.getByRole('tab', { name: 'Supplier orders' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'R000010' })).toBeVisible();
  await expect(page.getByText(/Grand total/)).toBeVisible();

  await kinds.getByRole('tab', { name: 'Sales' }).click();
  const modes = page.getByLabel('Report mode');
  await modes.getByRole('tab', { name: 'Summary' }).click();
  await expect(modes.getByRole('tab', { name: 'Summary' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: 'In repair group' })).toBeVisible();

  await page.getByRole('button', { name: 'Columns' }).click();
  await expect(page.getByLabel('Visible columns')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Known cost' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Known cost' })).not.toBeChecked();

  await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
});
