import { expect, test } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const iso = '2026-08-31T12:00:00.000Z';

const mockProducts = Array.from({ length: 8 }, (_, i) => ({
  id: `prod-${i + 1}`,
  name: `Warehouse Part ${i + 1} with a long name`,
  article: `ART-${i + 1}`,
  serialNumber: `S00000${i + 1}`,
  warehouseId: 'wh-1',
  locationId: 'loc-1',
  costPrice: 50,
  retailPrice: 100,
  wholesalePrice: 80,
  quantity: 1,
  createdAt: iso,
  updatedAt: iso,
}));

const measureWraps = () => {
  const wraps = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.catalog-table-wrap, .orders-table-wrap, .finance-table-wrap',
    ),
  ).map((el) => {
    const style = getComputedStyle(el);
    const borderY =
      Number.parseFloat(style.borderTopWidth) +
      Number.parseFloat(style.borderBottomWidth);
    return {
      className: el.className,
      optOut: el.dataset.globalScrollbar ?? '',
      overflowX: style.overflowX,
      scrollbarWidth: style.scrollbarWidth,
      overflows: el.scrollWidth > el.clientWidth + 1,
      nativeBarPx: Math.max(0, el.offsetHeight - el.clientHeight - borderY),
    };
  });
  const bar = document.querySelector<HTMLElement>('.global-fixed-h-scrollbar');
  return {
    wraps,
    barDisplay: bar ? getComputedStyle(bar).display : 'missing',
  };
};

test('desktop hides the native table bar and keeps the fixed bar in sync', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await installE2eApiMocks(page);
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
  await page.addInitScript((employee) => {
    window.localStorage.setItem('project-goods.lang', 'en');
    window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
    window.localStorage.setItem(
      'project-goods.employee-snapshot',
      JSON.stringify(employee),
    );
  }, e2eEmployee);

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?page=warehouse&warehouseTab=stock');
  await expect(page.locator('.catalog-table-wrap').first()).toBeVisible({
    timeout: 20_000,
  });

  const desktop = await page.evaluate(measureWraps);
  const stock = desktop.wraps.find(
    (wrap) =>
      wrap.className.includes('catalog-table-wrap') && wrap.optOut !== 'off',
  );
  expect(stock?.overflows).toBe(true);
  expect(stock?.scrollbarWidth).toBe('none');
  expect(stock?.nativeBarPx).toBeLessThan(2);
  expect(desktop.barDisplay).toBe('block');

  const wrap = page.locator('.catalog-table-wrap').first();
  const bar = page.locator('.global-fixed-h-scrollbar');
  await bar.evaluate((el) => {
    el.scrollLeft = 120;
  });
  await expect
    .poll(async () => wrap.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(50);

  await wrap.evaluate((el) => {
    el.scrollLeft = 40;
  });
  await expect
    .poll(async () => bar.evaluate((el) => el.scrollLeft))
    .toBeLessThan(80);

  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForTimeout(100);
  const narrow = await page.evaluate(measureWraps);
  expect(narrow.barDisplay).toBe('none');
  const narrowStock = narrow.wraps.find((wrapItem) =>
    wrapItem.className.includes('catalog-table-wrap'),
  );
  expect(narrowStock?.scrollbarWidth).not.toBe('none');

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.evaluate((employeeId) => {
    window.localStorage.setItem(
      `project-goods.warehouse-filters.${employeeId}`,
      JSON.stringify({ activeTab: 'transfers' }),
    );
  }, e2eEmployee.id);
  await page.goto('/?page=warehouse');
  const transferOptOut = page.locator('[data-global-scrollbar="off"]');
  await expect(transferOptOut.first()).toBeVisible({ timeout: 20_000 });
  const transfers = await page.evaluate(measureWraps);
  const optedOut = transfers.wraps.filter((wrapItem) => wrapItem.optOut === 'off');
  expect(optedOut.length).toBeGreaterThan(0);
  for (const wrapItem of optedOut) {
    expect(wrapItem.scrollbarWidth).not.toBe('none');
  }

  for (const path of [
    '/?page=orders&ordersTab=orders',
    '/?page=orders&ordersTab=sales',
    '/?page=orders&ordersTab=supplierOrders',
    '/?page=clients',
    '/?page=accounting&accountingTab=transactions',
    '/?page=accounting&accountingTab=orders',
  ]) {
    await page.goto(path);
    await expect(page.getByText('Loading session...')).toHaveCount(0);
    await expect(
      page.locator(
        '.catalog-table-wrap, .orders-table-wrap, .finance-table-wrap',
      ).first(),
    ).toBeVisible({ timeout: 20_000 });
    const view = await page.evaluate(measureWraps);
    const synced = view.wraps.filter((wrapItem) => wrapItem.optOut !== 'off');
    expect(synced.length, path).toBeGreaterThan(0);
    for (const wrapItem of synced) {
      expect(wrapItem.scrollbarWidth, path).toBe('none');
    }
  }

  await page.goto('/?page=orders&ordersTab=kanban');
  await expect(page.locator('.dashboard-shell')).toBeVisible();
  const kanban = page.locator('.repair-kanban-board');
  if ((await kanban.count()) > 0) {
    const kanbanBar = await kanban.evaluate(
      (el) => getComputedStyle(el).scrollbarWidth,
    );
    expect(kanbanBar).not.toBe('none');
  }
});
