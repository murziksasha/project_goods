import { expect, test, type Page } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const installCostAuditMocks = async (
  page: Page,
  options: { lang: 'en' | 'uk'; manyItems?: boolean },
) => {
  const capturedPayloads: Array<Record<string, unknown>> = [];

  const repairItems = [
    {
      id: 'prod-audit-1',
      kind: 'product',
      name: 'Custom OLED Display',
      price: 2500,
      quantity: 1,
      warrantyPeriod: 3,
      serialNumbers: [],
      requiresCostAudit: true,
      costSnapshot: null,
      auditedCost: null,
      costAuditLog: [],
    },
    {
      id: 'prod-audit-2',
      kind: 'product',
      name: 'Unpriced Housing Frame',
      price: 900,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: [],
      requiresCostAudit: true,
      costSnapshot: null,
      auditedCost: null,
      costAuditLog: [],
    },
    {
      id: 'prod-stock-1',
      kind: 'product',
      productId: 'stock-1',
      name: 'Warehouse Battery',
      price: 800,
      quantity: 1,
      warrantyPeriod: 3,
      serialNumbers: ['SN-BAT-01'],
      requiresCostAudit: false,
      costSnapshot: { status: 'known', unitCost: 420, totalCost: 420, method: 'stock' },
      auditedCost: null,
      costAuditLog: [],
    },
    {
      id: 'svc-1',
      kind: 'service',
      name: 'Board Microsoldering',
      price: 1200,
      quantity: 1,
      warrantyPeriod: 1,
      requiresCostAudit: false,
      costMethod: 'fixed',
      costSnapshot: null,
      auditedCost: null,
      costAuditLog: [],
    },
    ...(options.manyItems
      ? Array.from({ length: 8 }, (_, idx) => ({
          id: `prod-extra-${idx + 1}`,
          kind: 'product',
          name: `Extra Unpriced Spare Part #${idx + 1} with VeryLongContinuousIdentifierForMobileWrapCheck`,
          price: 150,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: [],
          requiresCostAudit: true,
          costSnapshot: null,
          auditedCost: null,
          costAuditLog: [],
        }))
      : []),
  ];

  let repairRecord = {
    id: 'rep-audit-1',
    recordNumber: 'R000801',
    saleDate: '2026-11-11T10:00:00.000Z',
    quantity: 1,
    salePrice: 5400,
    kind: 'repair',
    status: 'inRepair',
    paidAmount: 0,
    isRapidSale: false,
    note: '',
    userNote: '',
    timeline: [],
    paymentHistory: [],
    lineItems: repairItems,
    product: { id: '', name: 'iPhone 15 Pro', article: 'REP', serialNumber: '' },
    client: { id: 'client-1', name: 'Ada Client', phone: '+380991112233', status: 'new' },
    manager: { id: e2eEmployee.id, name: e2eEmployee.name, role: e2eEmployee.role },
    master: null,
    issuedBy: null,
    discount: { mode: 'percent', value: 0 },
    createdAt: '2026-11-11T10:00:00.000Z',
    updatedAt: '2026-11-11T10:00:00.000Z',
  };

  let paidSaleRecord = {
    id: 'sale-audit-paid-1',
    recordNumber: 'S000802',
    saleDate: '2026-11-11T10:00:00.000Z',
    quantity: 1,
    salePrice: 1100,
    kind: 'sale',
    status: 'issued',
    paidAmount: 1100,
    isRapidSale: false,
    note: '',
    userNote: '',
    timeline: [],
    paymentHistory: [],
    lineItems: [
      {
        id: 'sale-prod-audit-1',
        kind: 'product',
        name: 'Unpriced Case',
        price: 1100,
        quantity: 1,
        warrantyPeriod: 0,
        serialNumbers: [],
        requiresCostAudit: true,
        costSnapshot: { status: 'unknown', unitCost: null, totalCost: null, method: 'unknown' },
        auditedCost: { status: 'known', unitCost: 300, totalCost: 300, method: 'manual' },
        costAuditLog: [
          {
            id: 'log-initial',
            previousStatus: 'unknown',
            previousUnitCost: null,
            previousTotalCost: null,
            newStatus: 'known',
            newUnitCost: 300,
            newTotalCost: 300,
            method: 'manual',
            reason: 'Completed missing cost',
            authorName: e2eEmployee.name,
            changedAt: '2026-11-11T11:00:00.000Z',
          },
        ],
      },
    ],
    product: { id: '', name: 'Unpriced Case', article: 'SALE', serialNumber: '' },
    client: { id: 'client-1', name: 'Ada Client', phone: '+380991112233', status: 'new' },
    manager: { id: e2eEmployee.id, name: e2eEmployee.name, role: e2eEmployee.role },
    master: null,
    issuedBy: null,
    discount: { mode: 'percent', value: 0 },
    createdAt: '2026-11-11T10:00:00.000Z',
    updatedAt: '2026-11-11T10:00:00.000Z',
  };

  await installE2eApiMocks(page);

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api/, '');
      const method = request.method();

      const fulfillJson = async (body: unknown, status = 200) => {
        await route.fulfill({
          status,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify(body),
        });
      };

      if (path === '/sales') {
        const list = [repairRecord, paidSaleRecord];
        await fulfillJson(
          url.searchParams.has('page')
            ? { items: list, total: list.length, page: 1, pageSize: 30 }
            : list,
        );
        return;
      }

      if (path === `/sales/${repairRecord.id}` && method === 'GET') {
        await fulfillJson(repairRecord);
        return;
      }

      if (path === `/sales/${paidSaleRecord.id}` && method === 'GET') {
        await fulfillJson(paidSaleRecord);
        return;
      }

      if (path === `/sales/${repairRecord.id}/costs` && method === 'PATCH') {
        const body = (request.postDataJSON() ?? {}) as {
          items?: Array<{ lineItemId: string; unitCost?: number; directExpenses?: number | null; reason?: string }>;
          reason?: string;
        };
        capturedPayloads.push(body as Record<string, unknown>);
        const updatesById = new Map((body.items ?? []).map((i) => [i.lineItemId, i]));
        repairRecord = {
          ...repairRecord,
          lineItems: repairRecord.lineItems.map((li) => {
            const upd = updatesById.get(li.id);
            if (!upd) return li;
            const unitCost = Number(upd.unitCost ?? 0);
            return {
              ...li,
              unitCostOverride: unitCost,
              requiresCostAudit: true,
              auditedCost: {
                status: 'known',
                unitCost,
                totalCost: unitCost * li.quantity,
                method: unitCost === 0 ? 'zero' : 'manual',
              } as never,
              costAuditLog: [
                ...(li.costAuditLog ?? []),
                {
                  id: `log-${Date.now()}`,
                  previousStatus: li.auditedCost ? 'known' : 'unknown',
                  previousUnitCost: li.auditedCost ? (li.auditedCost as { unitCost: number }).unitCost : null,
                  previousTotalCost: li.auditedCost ? (li.auditedCost as { totalCost: number }).totalCost : null,
                  newStatus: 'known',
                  newUnitCost: unitCost,
                  newTotalCost: unitCost * li.quantity,
                  method: unitCost === 0 ? 'zero' : 'manual',
                  reason: upd.reason || body.reason || 'Completed missing cost',
                  authorName: e2eEmployee.name,
                  changedAt: '2026-11-12T12:00:00.000Z',
                },
              ] as never,
            };
          }),
        };
        await fulfillJson(repairRecord);
        return;
      }

      if (path === `/sales/${paidSaleRecord.id}/costs` && method === 'PATCH') {
        const body = (request.postDataJSON() ?? {}) as {
          items?: Array<{ lineItemId: string; unitCost?: number; reason?: string }>;
          reason?: string;
        };
        capturedPayloads.push(body as Record<string, unknown>);
        const upd = body.items?.[0];
        if (upd) {
          const unitCost = Number(upd.unitCost ?? 0);
          paidSaleRecord = {
            ...paidSaleRecord,
            lineItems: paidSaleRecord.lineItems.map((li) => ({
              ...li,
              unitCostOverride: unitCost,
              requiresCostAudit: true,
              auditedCost: {
                status: 'known',
                unitCost,
                totalCost: unitCost,
                method: 'manual',
              },
            })),
          };
        }
        await fulfillJson(paidSaleRecord);
        return;
      }

      if (path === '/sales/occupied-serials') {
        await fulfillJson({ occupied: [] });
        return;
      }

      await route.fallback();
    },
  );

  await page.addInitScript(
    ({ emp, lang }) => {
      window.localStorage.setItem('project-goods.lang', lang);
      window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
      window.localStorage.setItem('project-goods.employee-snapshot', JSON.stringify(emp));
    },
    { emp: e2eEmployee, lang: options.lang },
  );

  return { capturedPayloads };
};

test.describe('Product purchase cost audit UI & responsive flow', () => {
  test('wide desktop EN: audits pre-payment repair product (only changed row) and post-payment issued sale with reason', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { capturedPayloads } = await installCostAuditMocks(page, { lang: 'en', manyItems: true });

    await page.goto('/?page=orders&ordersTab=orders&saleId=rep-audit-1');

    const auditButton = page.getByRole('button', { name: 'Audit', exact: true });
    await expect(auditButton).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Known Cost Total/i)).toHaveCount(0);
    await expect(page.getByText(/Draft Estimate/i)).toHaveCount(0);

    await auditButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Custom OLED Display')).toBeVisible();
    await expect(dialog.getByText('Warehouse Battery')).toHaveCount(0);
    await expect(dialog.getByText('Board Microsoldering')).toHaveCount(0);

    // Header and footer visible; items list scrolls internally; no horizontal overflow
    const geometry = await dialog.evaluate((el) => {
      const header = el.querySelector('.catalog-edit-header')!;
      const footer = el.querySelector('.catalog-edit-footer')!;
      const scrollList = el.querySelector('.cost-audit-items-list')!;
      return {
        modalOverflowX: el.scrollWidth > el.clientWidth,
        listScrolls: scrollList.scrollHeight > scrollList.clientHeight,
        headerRect: header.getBoundingClientRect().toJSON(),
        footerRect: footer.getBoundingClientRect().toJSON(),
        vh: window.innerHeight,
        vw: window.innerWidth,
        docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    expect(geometry.modalOverflowX).toBe(false);
    expect(geometry.docOverflowX).toBe(false);
    expect(geometry.listScrolls).toBe(true);
    expect(geometry.headerRect.top).toBeGreaterThanOrEqual(0);
    expect(geometry.footerRect.bottom).toBeLessThanOrEqual(geometry.vh + 1);

    // Fill only first item with 0 and save -> only 1 item in payload
    await dialog.getByPlaceholder('0.00').first().fill('0');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    expect(capturedPayloads).toHaveLength(1);
    expect(capturedPayloads[0]).toEqual({
      items: [
        {
          lineItemId: 'prod-audit-1',
          status: 'known',
          unitCost: 0,
          directExpenses: null,
        },
      ],
    });

    // Audit button stays visible for future correction
    await expect(auditButton).toBeVisible();

    // Navigate to issued/paid sale card and verify Audit works after payment & requires reason
    await page.goto('/?page=orders&ordersTab=sales&saleId=sale-audit-paid-1');
    const saleAuditBtn = page.getByRole('button', { name: 'Audit', exact: true });
    await expect(saleAuditBtn).toBeVisible({ timeout: 20_000 });
    await expect(saleAuditBtn).toBeEnabled();
    await saleAuditBtn.click();

    const saleDialog = page.getByRole('dialog');
    await expect(saleDialog).toBeVisible();
    await saleDialog.getByPlaceholder('0.00').first().fill('350');
    await saleDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(saleDialog.getByRole('alert')).toContainText(/reason/i);

    await saleDialog.getByLabel(/Audit reason/i).fill('Verified supplier invoice');
    await saleDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(saleDialog).toHaveCount(0);
  });

  test('narrow mobile UK: modal stays inside viewport with internal scroll and no clipping/horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await installCostAuditMocks(page, { lang: 'uk', manyItems: true });

    await page.goto('/?page=orders&ordersTab=orders&saleId=rep-audit-1');

    const auditButton = page.getByRole('button', { name: 'Аудит', exact: true });
    await expect(auditButton).toBeVisible({ timeout: 20_000 });
    await auditButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Аудит собівартості' })).toBeVisible();

    const mobileGeometry = await dialog.evaluate((el) => {
      const header = el.querySelector('.catalog-edit-header')!;
      const footer = el.querySelector('.catalog-edit-footer')!;
      const scrollList = el.querySelector('.cost-audit-items-list')!;
      const dialogRect = el.getBoundingClientRect();
      return {
        modalOverflowX: el.scrollWidth > el.clientWidth,
        listOverflowX: scrollList.scrollWidth > scrollList.clientWidth,
        listScrolls: scrollList.scrollHeight > scrollList.clientHeight,
        dialogRight: dialogRect.right,
        dialogLeft: dialogRect.left,
        headerRect: header.getBoundingClientRect().toJSON(),
        footerRect: footer.getBoundingClientRect().toJSON(),
        vw: window.innerWidth,
        vh: window.innerHeight,
        docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    expect(mobileGeometry.modalOverflowX).toBe(false);
    expect(mobileGeometry.listOverflowX).toBe(false);
    expect(mobileGeometry.docOverflowX).toBe(false);
    expect(mobileGeometry.listScrolls).toBe(true);
    expect(mobileGeometry.dialogLeft).toBeGreaterThanOrEqual(0);
    expect(mobileGeometry.dialogRight).toBeLessThanOrEqual(mobileGeometry.vw + 1);
    expect(mobileGeometry.headerRect.top).toBeGreaterThanOrEqual(0);
    expect(mobileGeometry.footerRect.bottom).toBeLessThanOrEqual(mobileGeometry.vh + 1);

    await dialog.getByRole('button', { name: 'Скасувати' }).click();
    await expect(dialog).toHaveCount(0);
  });
});
