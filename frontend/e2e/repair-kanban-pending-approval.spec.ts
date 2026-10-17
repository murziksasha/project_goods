import { expect, test, type Page } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-08-31T12:00:00.000Z';

const pipeline = [
  'new',
  'diagnostics',
  'pendingApproval',
  'clientApproved',
  'waitingParts',
  'inRepair',
  'refinement',
  'ready',
  'paid',
  'away',
];

const makeSale = (id: string, status: string, recordNumber: string) => ({
  id,
  recordNumber,
  saleDate: iso,
  quantity: 1,
  salePrice: 100,
  kind: 'repair',
  status,
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
  master: null,
  issuedBy: null,
  createdAt: iso,
  updatedAt: iso,
  isFavorite: false,
  kanbanRank: null as number | null,
});

const bootKanban = async (page: Page) => {
  const sales = [
    makeSale('sale-diag', 'diagnostics', 'R000501'),
    makeSale('sale-approved', 'clientApproved', 'R000502'),
  ];

  await installE2eApiMocks(page);
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
      if (request.method() === 'PATCH' && path.endsWith('/workspace')) {
        const id = path.split('/')[3];
        const body = (request.postDataJSON() ?? {}) as {
          status?: string;
          kanbanRank?: number;
        };
        const sale = sales.find((item) => item.id === id);
        if (sale && body.status) sale.status = body.status;
        if (sale && typeof body.kanbanRank === 'number') {
          sale.kanbanRank = body.kanbanRank;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(sale ?? {}),
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
  await expect(page.locator('.dashboard-shell')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId('repair-kanban-board')).toBeVisible();
};

const columnStatuses = (page: Page) =>
  page.locator('.repair-kanban-column').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-status')),
  );

const expectColumnTrack = async (
  page: Page,
  width: number,
  mode: 'desktop' | 'tablet' | 'phone',
) => {
  await page.setViewportSize({ width, height: 800 });
  const board = page.getByTestId('repair-kanban-board');
  const pending = page.locator(
    '.repair-kanban-column[data-status="pendingApproval"]',
  );
  await pending.scrollIntoViewIfNeeded();
  const boardBox = await board.boundingBox();
  const columnBox = await pending.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(columnBox).not.toBeNull();
  if (!boardBox || !columnBox) return;

  if (mode === 'desktop') {
    expect(columnBox.width).toBeGreaterThan(250);
    expect(columnBox.width).toBeLessThan(280);
  } else if (mode === 'tablet') {
    expect(columnBox.width).toBeGreaterThan(boardBox.width * 0.4);
    expect(columnBox.width).toBeLessThan(boardBox.width * 0.6);
  } else {
    expect(columnBox.width).toBeGreaterThan(boardBox.width * 0.9);
  }

  const overflow = await pending.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
};

test('pending approval sits after diagnostics and keeps the adaptive tracks', async ({
  page,
}) => {
  await bootKanban(page);

  const pendingHeading = page.locator(
    '.repair-kanban-column[data-status="pendingApproval"] h3',
  );
  await expect(pendingHeading).toHaveText('Pending approval');
  await expect(pendingHeading).toBeVisible();
  expect(await columnStatuses(page)).toEqual(pipeline);

  const diagnostics = page.locator(
    '.repair-kanban-column[data-status="diagnostics"]',
  );
  const pending = page.locator(
    '.repair-kanban-column[data-status="pendingApproval"]',
  );
  await expect(diagnostics.getByText('#R000501')).toBeVisible();
  await expect(pending.getByText('#R000502')).toHaveCount(0);
  await expect(
    page.locator('.repair-kanban-column[data-status="clientApproved"]').getByText(
      '#R000502',
    ),
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  const newColumn = page.locator('.repair-kanban-column[data-status="new"]');
  await newColumn.getByRole('button', { name: 'Collapse empty column' }).click();
  const collapsed = await newColumn.boundingBox();
  expect(collapsed?.width ?? 0).toBeGreaterThan(68);
  expect(collapsed?.width ?? 0).toBeLessThan(80);
  await expect(newColumn.locator('h3')).toBeVisible();
  await expect(newColumn.locator('h3')).toHaveText('New repair');

  await diagnostics.getByRole('button', { name: 'Move', exact: true }).click();
  const sheet = page.locator('.repair-kanban-move-sheet');
  await expect(sheet.getByRole('button', { name: 'Pending approval' })).toBeVisible();
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox).not.toBeNull();
  expect((sheetBox?.y ?? 0) + (sheetBox?.height ?? 0)).toBeLessThanOrEqual(800);
  await sheet.getByRole('button', { name: 'Pending approval' }).click();
  await expect(pending.getByText('#R000501')).toBeVisible();
  await expect(diagnostics.getByText('#R000501')).toHaveCount(0);

  await expectColumnTrack(page, 1280, 'desktop');
  await expectColumnTrack(page, 768, 'tablet');
  await expectColumnTrack(page, 390, 'phone');

  await page.setViewportSize({ width: 390, height: 800 });
  const navigator = page.getByRole('navigation', { name: 'Kanban columns' });
  await expect(navigator).toBeVisible();
  const chipStatuses = await navigator.locator('.repair-kanban-nav-chip').evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute('data-status')),
  );
  expect(chipStatuses).toEqual(pipeline);
  const chipOverflow = await navigator.evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  expect(chipOverflow).toBe(true);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('tab', { name: 'Orders', exact: true }).click();
  const badge = page.locator('.order-status-pendingApproval');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('Pending approval');
  const badgeOverflow = await badge.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(badgeOverflow).toBeLessThanOrEqual(1);
  await badge.click();
  const statusMenu = page.locator('.order-status-options');
  await expect(
    statusMenu.getByRole('button', { name: 'Pending approval', exact: true }),
  ).toBeVisible();
  const menuKeys = await statusMenu.locator('button').allTextContents();
  expect(menuKeys.indexOf('Pending approval')).toBe(
    menuKeys.indexOf('Diagnostics') + 1,
  );
  expect(menuKeys.indexOf('Client approved')).toBeGreaterThan(
    menuKeys.indexOf('Waiting parts'),
  );
});
