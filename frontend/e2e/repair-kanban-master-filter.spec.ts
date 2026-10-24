import { expect, test } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-08-31T12:00:00.000Z';

const kostia = {
  id: 'emp-kostia',
  name: 'Kostiantyn',
  role: 'master',
  permissions: ['orders.view', 'repairs.execute'],
  isActive: true,
  isRegistered: true,
  createdAt: iso,
  updatedAt: iso,
};

const petro = {
  id: 'emp-petro',
  name: 'Petro',
  role: 'master',
  permissions: ['orders.view', 'repairs.execute'],
  isActive: true,
  isRegistered: true,
  createdAt: iso,
  updatedAt: iso,
};

const vasyl = {
  id: 'emp-vasyl',
  name: 'Vasyl',
  role: 'master',
  permissions: ['orders.view', 'repairs.execute'],
  isActive: true,
  isRegistered: true,
  createdAt: iso,
  updatedAt: iso,
};

const makeRepairSale = (
  id: string,
  recordNumber: string,
  master: { id: string; name: string } | null,
) => ({
  id,
  recordNumber,
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
  lineItems: [
    {
      id: `${id}-line`,
      kind: 'service',
      name: 'Diagnostics',
      price: 100,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
  client: {
    id: 'client-1',
    name: 'Ada Client',
    phone: '+380991112233',
    status: 'new',
  },
  product: { name: 'Kettle' },
  manager: null,
  master: master ? { id: master.id, name: master.name } : null,
  issuedBy: null,
  createdAt: iso,
  updatedAt: iso,
  isFavorite: false,
  kanbanRank: null as number | null,
});

test('Kanban master filter: multi-selection, chips, clear to All, saved filter, and Orders/Sales single assignee', async ({
  page,
}) => {
  const sales = [
    makeRepairSale('sale-1', 'R000601', null),
    makeRepairSale('sale-2', 'R000602', kostia),
    makeRepairSale('sale-3', 'R000603', petro),
    makeRepairSale('sale-4', 'R000604', vasyl),
  ];

  const savedFilters: Array<{
    id: string;
    employeeId: string;
    scope: string;
    tab: string;
    name: string;
    icon: string;
    filters: Record<string, unknown>;
  }> = [];

  await installE2eApiMocks(page);

  await page.route(
    (url) =>
      url.pathname === '/api/employees' ||
      url.pathname.startsWith('/api/employees/'),
    async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([e2eEmployee, kostia, petro, vasyl]),
        });
        return;
      }
      await route.fallback();
    },
  );

  await page.route(
    (url) =>
      url.pathname === '/api/sales' || url.pathname.startsWith('/api/sales/'),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path === '/api/sales') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(sales),
        });
        return;
      }
      await route.fallback();
    },
  );

  await page.route(
    (url) =>
      url.pathname === '/api/saved-filters' ||
      url.pathname.startsWith('/api/saved-filters/'),
    async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(savedFilters),
        });
        return;
      }
      if (request.method() === 'POST') {
        const body = (request.postDataJSON() ?? {}) as {
          tab: string;
          name: string;
          icon?: string;
          filters: Record<string, unknown>;
        };
        const created = {
          id: `saved-${Date.now()}`,
          employeeId: e2eEmployee.id,
          scope: 'orders',
          tab: body.tab,
          name: body.name,
          icon: body.icon ?? '⚙️',
          filters: body.filters,
        };
        savedFilters.push(created);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(created),
        });
        return;
      }
      await route.fallback();
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

  await page.goto('/?page=orders&ordersTab=kanban');
  await expect(page.getByTestId('repair-kanban-board')).toBeVisible({
    timeout: 20_000,
  });

  // 1. All shows every visible card (R000601, R000602, R000603, R000604)
  await expect(page.locator('.repair-kanban-card')).toHaveCount(4);
  await expect(page.getByText('R000601')).toBeVisible();
  await expect(page.getByText('R000602')).toBeVisible();
  await expect(page.getByText('R000603')).toBeVisible();
  await expect(page.getByText('R000604')).toBeVisible();
  await expect(page.locator('.orders-kanban-count')).toHaveText('Orders: 4');

  // Open Filter panel
  const filterButton = page.locator('.toolbar-filter-toggle-button');
  await filterButton.click();

  const masterToggle = page.locator('.orders-filter-status-toggle');
  await expect(masterToggle).toHaveText('All');

  // 2. Without master shows only unassigned cards
  await masterToggle.click();
  await expect(page.locator('.orders-filter-status-menu')).toBeVisible();
  await page.getByLabel('Without master').check();
  await expect(masterToggle).toHaveText('Without master');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.locator('.repair-kanban-card')).toHaveCount(1);
  await expect(page.getByText('R000601')).toBeVisible();
  await expect(page.getByText('R000602')).toBeHidden();
  await expect(page.locator('.orders-kanban-count')).toHaveText('Orders: 1');
  const withoutMasterChip = page.locator('.orders-filter-chip', {
    hasText: 'Master: Without master',
  });
  await expect(withoutMasterChip).toBeVisible();

  // 3. One coworker shows only that coworker's cards
  await filterButton.click();
  await masterToggle.click();
  await page.getByLabel('Without master').uncheck();
  await page.getByLabel('Kostiantyn').check();
  await expect(masterToggle).toHaveText('Kostiantyn');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.locator('.repair-kanban-card')).toHaveCount(1);
  await expect(page.getByText('R000602')).toBeVisible();
  await expect(page.getByText('R000601')).toBeHidden();
  await expect(
    page.locator('.orders-filter-chip', { hasText: 'Master: Kostiantyn' }),
  ).toBeVisible();

  // 4. Without master plus two coworkers shows the union & closed field shows "3 selected"
  await filterButton.click();
  await masterToggle.click();
  await page.getByLabel('Without master').check();
  await page.getByLabel('Petro').check();
  await expect(masterToggle).toHaveText('3 selected');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.locator('.repair-kanban-card')).toHaveCount(3);
  await expect(page.getByText('R000601')).toBeVisible();
  await expect(page.getByText('R000602')).toBeVisible();
  await expect(page.getByText('R000603')).toBeVisible();
  await expect(page.getByText('R000604')).toBeHidden();
  await expect(page.locator('.orders-kanban-count')).toHaveText('Orders: 3');

  // 5. Apply creates three chips
  await expect(
    page.locator('.orders-filter-chip', { hasText: 'Master: Without master' }),
  ).toBeVisible();
  await expect(
    page.locator('.orders-filter-chip', { hasText: 'Master: Kostiantyn' }),
  ).toBeVisible();
  await expect(
    page.locator('.orders-filter-chip', { hasText: 'Master: Petro' }),
  ).toBeVisible();

  // 6. x on one chip leaves the other two
  await page
    .locator('.orders-filter-chip', { hasText: 'Master: Without master' })
    .click();
  await expect(
    page.locator('.orders-filter-chip', { hasText: 'Master: Without master' }),
  ).toBeHidden();
  await expect(
    page.locator('.orders-filter-chip', { hasText: 'Master: Kostiantyn' }),
  ).toBeVisible();
  await expect(
    page.locator('.orders-filter-chip', { hasText: 'Master: Petro' }),
  ).toBeVisible();
  await expect(page.locator('.repair-kanban-card')).toHaveCount(2);
  await expect(page.getByText('R000601')).toBeHidden();
  await expect(page.getByText('R000602')).toBeVisible();
  await expect(page.getByText('R000603')).toBeVisible();

  // 7. Clear returns to All
  await filterButton.click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(masterToggle).toHaveText('All');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.locator('.orders-filter-chip')).toHaveCount(0);
  await expect(page.locator('.repair-kanban-card')).toHaveCount(4);
  await expect(page.locator('.orders-kanban-count')).toHaveText('Orders: 4');

  // 8. Saved filter restores the checks
  await filterButton.click();
  await masterToggle.click();
  await page.getByLabel('Without master').check();
  await page.getByLabel('Vasyl').check();
  await expect(masterToggle).toHaveText('2 selected');

  // Open Save Filter drawer
  await page.getByRole('button', { name: 'Save filter' }).click();
  const filterNameInput = page.locator('.orders-filter-drawer input').first();
  await filterNameInput.fill('Unassigned + Vasyl');
  await page
    .locator('.orders-filter-drawer')
    .getByRole('button', { name: 'Save', exact: true })
    .click();

  // Clear to All first
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(masterToggle).toHaveText('All');

  // Click the saved filter pill
  await page
    .locator('.orders-filter-saved-button', { hasText: 'Unassigned + Vasyl' })
    .click();
  await expect(masterToggle).toHaveText('2 selected');
  await masterToggle.click();
  const masterMenu = page.locator('.orders-filter-status-menu');
  await expect(masterMenu.getByRole('checkbox', { name: 'Without master' })).toBeChecked();
  await expect(masterMenu.getByRole('checkbox', { name: 'Vasyl' })).toBeChecked();
  await expect(masterMenu.getByRole('checkbox', { name: 'Kostiantyn' })).not.toBeChecked();

  // 9. Orders and Sales tabs still use single assignee select
  await page.getByRole('tab', { name: 'Orders' }).click();
  await expect(page.locator('.orders-table')).toBeVisible();
  const ordersFilterButton = page.locator('.toolbar-filter-toggle-button');
  await ordersFilterButton.click();
  const assigneeSelect = page.locator('label.orders-filter-field select').first();
  await expect(assigneeSelect).toBeVisible();
  await expect(assigneeSelect.locator('option')).toContainText(['All', 'Kostiantyn', 'Petro', 'Vasyl']);

  // Go to Sales tab
  await page.getByRole('tab', { name: 'Sales' }).click();
  await expect(page.locator('.orders-table')).toBeVisible();
  const salesFilterButton = page.locator('.toolbar-filter-toggle-button');
  await salesFilterButton.click();
  const managerSelect = page.locator('label.orders-filter-field select').first();
  await expect(managerSelect).toBeVisible();
  await expect(managerSelect.locator('option')).toContainText(['All', 'E2E Admin']);
});
