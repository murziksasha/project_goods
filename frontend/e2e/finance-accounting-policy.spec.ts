import { expect, test, type Page } from '@playwright/test';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const installFinancePolicyE2eMocks = async (
  page: Page,
  options: { lang: 'en' | 'uk' },
) => {
  let policy = {
    serviceAuditEnabled: false,
    serviceProfitMode: 'full' as 'full' | 'revenue_only' | 'exclude',
    reportDefaults: {
      period: 'last30' as const,
      source: 'all' as const,
      showCharts: true,
      showTable: true,
    },
    version: 1,
    updatedById: null as string | null,
    updatedByName: null as string | null,
    updatedAt: null as string | null,
  };

  const historyItems: Array<Record<string, unknown>> = [];

  let repairRecord = {
    id: 'rep-policy-1',
    recordNumber: 'R000901',
    saleDate: '2026-11-11T10:00:00.000Z',
    quantity: 1,
    salePrice: 1700,
    kind: 'repair',
    status: 'inRepair',
    paidAmount: 0,
    isRapidSale: false,
    note: '',
    userNote: '',
    timeline: [],
    paymentHistory: [],
    lineItems: [
      {
        id: 'prod-1',
        kind: 'product',
        name: 'Custom Glass',
        price: 500,
        quantity: 1,
        warrantyPeriod: 0,
        serialNumbers: [],
        requiresCostAudit: true,
        costSnapshot: null,
        auditedCost: null,
        costAuditLog: [],
      },
      {
        id: 'svc-1',
        kind: 'service',
        name: 'Custom Board Repair',
        price: 1200,
        quantity: 1,
        warrantyPeriod: 1,
        requiresCostAudit: true,
        costMethod: 'fixed',
        costSnapshot: null,
        auditedCost: null,
        costAuditLog: [],
      },
    ],
    product: { id: '', name: 'iPhone 15', article: 'REP', serialNumber: '' },
    client: { id: 'c1', name: 'Client One', phone: '+380991112233', status: 'new' },
    manager: { id: e2eEmployee.id, name: e2eEmployee.name, role: e2eEmployee.role },
    master: null,
    issuedBy: null,
    discount: { mode: 'percent', value: 0 },
    createdAt: '2026-11-11T10:00:00.000Z',
    updatedAt: '2026-11-11T10:00:00.000Z',
  };

  await installE2eApiMocks(page);

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = req.method();

    if (path === '/finance/policy' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(policy),
      });
      return;
    }

    if (path === '/finance/policy' && method === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      const prev = {
        serviceAuditEnabled: policy.serviceAuditEnabled,
        serviceProfitMode: policy.serviceProfitMode,
        reportDefaults: { ...policy.reportDefaults },
      };
      const next = {
        serviceAuditEnabled:
          typeof body.serviceAuditEnabled === 'boolean'
            ? body.serviceAuditEnabled
            : policy.serviceAuditEnabled,
        serviceProfitMode:
          (body.serviceProfitMode as typeof policy.serviceProfitMode) ??
          policy.serviceProfitMode,
        reportDefaults: {
          ...policy.reportDefaults,
          ...((body.reportDefaults as Record<string, unknown>) ?? {}),
        },
      };
      const changedFields: string[] = [];
      if (prev.serviceAuditEnabled !== next.serviceAuditEnabled) {
        changedFields.push('serviceAuditEnabled');
      }
      if (prev.serviceProfitMode !== next.serviceProfitMode) {
        changedFields.push('serviceProfitMode');
      }
      if (prev.reportDefaults.period !== next.reportDefaults.period) {
        changedFields.push('reportDefaults.period');
      }
      const nextVersion = policy.version + 1;
      historyItems.unshift({
        id: `hist-${nextVersion}`,
        previousVersion: policy.version,
        version: nextVersion,
        changedFields,
        previous: prev,
        next,
        reason: String(body.reason ?? ''),
        authorId: e2eEmployee.id,
        authorName: e2eEmployee.name,
        changedAt: '2026-11-12T12:00:00.000Z',
      });
      policy = {
        ...policy,
        ...next,
        version: nextVersion,
        updatedById: e2eEmployee.id,
        updatedByName: e2eEmployee.name,
        updatedAt: '2026-11-12T12:00:00.000Z',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(policy),
      });
      return;
    }

    if (path === '/finance/policy/preview' && method === 'POST') {
      const body = req.postDataJSON() as { serviceProfitMode?: string };
      const proposedMode = body.serviceProfitMode ?? 'full';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: { key: 'last30', dateFrom: '2026-10-14', dateTo: '2026-11-12', timeZone: 'Europe/Kiev' },
          requestedSource: 'all',
          current: {
            serviceProfitMode: policy.serviceProfitMode,
            version: policy.version,
            source: 'all',
            margin: {
              revenue: 1700,
              cogs: 700,
              grossProfit: 1000,
              grossMarginPct: 58.82,
              unknownCostCount: 0,
              isIncomplete: false,
              knownCostRevenue: 1700,
              knownCostCogs: 700,
              knownCostGrossProfit: 1000,
              knownCostGrossMarginPct: 58.82,
              costCoveragePct: 100,
            },
            cash: { collected: 1700, inventoryPurchases: 0, opex: 200, refunds: 0, net: 1500 },
            saleCount: 1,
            rowCount: 2,
          },
          proposed: {
            serviceProfitMode: proposedMode,
            source: 'all',
            margin:
              proposedMode === 'revenue_only'
                ? {
                    revenue: 1700,
                    cogs: 300,
                    grossProfit: null,
                    grossMarginPct: null,
                    unknownCostCount: 1,
                    isIncomplete: true,
                    knownCostRevenue: 500,
                    knownCostCogs: 300,
                    knownCostGrossProfit: 200,
                    knownCostGrossMarginPct: 40,
                    costCoveragePct: 29.41,
                  }
                : proposedMode === 'exclude'
                  ? {
                      revenue: 500,
                      cogs: 300,
                      grossProfit: 200,
                      grossMarginPct: 40,
                      unknownCostCount: 0,
                      isIncomplete: false,
                      knownCostRevenue: 500,
                      knownCostCogs: 300,
                      knownCostGrossProfit: 200,
                      knownCostGrossMarginPct: 40,
                      costCoveragePct: 100,
                    }
                  : {
                      revenue: 1700,
                      cogs: 700,
                      grossProfit: 1000,
                      grossMarginPct: 58.82,
                      unknownCostCount: 0,
                      isIncomplete: false,
                      knownCostRevenue: 1700,
                      knownCostCogs: 700,
                      knownCostGrossProfit: 1000,
                      knownCostGrossMarginPct: 58.82,
                      costCoveragePct: 100,
                    },
            cash: { collected: 1700, inventoryPurchases: 0, opex: 200, refunds: 0, net: 1500 },
            saleCount: 1,
            rowCount: proposedMode === 'exclude' ? 1 : 2,
          },
          delta: {
            revenue: proposedMode === 'exclude' ? -1200 : 0,
            cogs: proposedMode === 'full' ? 0 : -400,
            grossProfit: proposedMode === 'exclude' ? -800 : null,
            knownCostGrossProfit: proposedMode === 'full' ? 0 : -800,
            saleCount: 0,
          },
        }),
      });
      return;
    }

    if (path === '/finance/policy/history' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: historyItems,
          total: historyItems.length,
          page: 1,
          pageSize: 10,
        }),
      });
      return;
    }

    if (path.startsWith('/finance/profit-report/details')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          pageSize: 25,
          policy: {
            serviceProfitMode: policy.serviceProfitMode,
            serviceAuditEnabled: policy.serviceAuditEnabled,
            version: policy.version,
          },
          totals: {
            revenue: 0,
            knownCost: 0,
            knownProfit: 0,
            missingCostRecordsCount: 0,
            lossRecordsCount: 0,
          },
        }),
      });
      return;
    }

    if (path.startsWith('/finance/profit-report')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: { key: url.searchParams.get('period') ?? 'last30', dateFrom: null, dateTo: null, timeZone: 'Europe/Kiev' },
          source: url.searchParams.get('source') ?? 'all',
          policy: {
            serviceProfitMode: policy.serviceProfitMode,
            serviceAuditEnabled: policy.serviceAuditEnabled,
            version: policy.version,
          },
          currency: 'UAH',
          otherCurrencies: [],
          margin: {
            revenue: policy.serviceProfitMode === 'exclude' ? 500 : 1700,
            cogs: 300,
            grossProfit: policy.serviceProfitMode === 'revenue_only' ? null : 200,
            grossMarginPct: policy.serviceProfitMode === 'revenue_only' ? null : 40,
            unknownCostCount: policy.serviceProfitMode === 'revenue_only' ? 1 : 0,
            isIncomplete: policy.serviceProfitMode === 'revenue_only',
            knownCostRevenue: 500,
            knownCostCogs: 300,
            knownCostGrossProfit: 200,
            knownCostGrossMarginPct: 40,
            costCoveragePct: policy.serviceProfitMode === 'exclude' ? 100 : 29.41,
          },
          cash: {
            collected: 1700,
            inventoryPurchases: 0,
            opex: 200,
            refunds: 0,
            net: 1500,
            opexByCategory: [],
            operations: [],
          },
          rows: [],
          trendSeries: [],
          dataScope: 'live_sales_only',
          coldSalesPurgedExist: false,
          saleCount: 1,
          coverage: {
            coldSalesPurgedExist: false,
            isProfitIncomplete: policy.serviceProfitMode === 'revenue_only',
            warnings: [],
          },
        }),
      });
      return;
    }

    if (path === '/sales' && method === 'GET') {
      const list = [repairRecord];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          url.searchParams.has('page')
            ? { items: list, total: list.length, page: 1, pageSize: 30 }
            : list,
        ),
      });
      return;
    }

    if (path === `/sales/${repairRecord.id}` && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(repairRecord),
      });
      return;
    }

    if (path === `/sales/${repairRecord.id}/costs` && method === 'PATCH') {
      const body = req.postDataJSON() as {
        items?: Array<{ lineItemId: string; fixedCost?: number }>;
        reason?: string;
      };
      const items = [...repairRecord.lineItems];
      for (const u of body.items ?? []) {
        const idx = items.findIndex((li) => li.id === u.lineItemId);
        if (idx >= 0 && u.fixedCost !== undefined) {
          items[idx] = {
            ...items[idx],
            auditedCost: {
              status: 'known',
              unitCost: u.fixedCost,
              totalCost: u.fixedCost,
              method: 'fixed',
              capturedAt: '2026-11-12T12:05:00.000Z',
            },
          } as typeof items[number];
        }
      }
      repairRecord = { ...repairRecord, lineItems: items };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(repairRecord),
      });
      return;
    }

    await route.fallback();
  });

  await page.addInitScript((lang) => {
    window.localStorage.setItem('project-goods.lang', lang);
    window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
    window.localStorage.removeItem('project-goods.accounting-profit-filters');
    window.localStorage.removeItem('project-goods.accounting-profit-visual');
    window.localStorage.removeItem('project-goods.accounting-finance-settings-tab');
  }, options.lang);
};

test.describe('Finance Accounting & Audit Policy Tab', () => {
  test('EN desktop: configures policy, previews impact, saves history, applies report defaults & service audit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installFinancePolicyE2eMocks(page, { lang: 'en' });

    await page.goto('/?page=accounting&accountingSettings=1');

    const tabs = page.locator('.warehouse-settings-tab');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(2)).toHaveText('Categories');
    await expect(tabs.nth(3)).toHaveText('Accounting & Audit');

    await tabs.nth(3).click();
    await expect(page.getByText('Version v1')).toBeVisible();

    // Check zero horizontal overflow on desktop
    const overflowDesktop = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowDesktop).toBe(false);

    // Toggle service audit & select Exclude mode -> verifies preview & disables Services default source
    await page.getByLabel(/Allow manual service cost audit/i).check();
    await page.getByRole('radio', { name: /Exclude/i }).click();
    const defaultSourceSelect = page.getByLabel('Default source');
    await expect(
      defaultSourceSelect.locator('option[value="services"]'),
    ).toHaveAttribute('disabled', '');
    await page.getByLabel('Default period').selectOption('month');
    await page.getByLabel(/Change reason/i).fill('Enable audit & exclude services');
    await page.getByRole('button', { name: 'Save rules' }).click();

    await expect(page.getByText('Version v2')).toBeVisible();
    await expect(page.getByText('v1 → v2')).toBeVisible();

    // Switch to Reports tab -> verify company default Month applied & Services button disabled
    await page.getByRole('tab', { name: 'Reports' }).click();
    await expect(page.getByRole('button', { name: 'Month' })).toHaveClass(
      /period-button-active/,
    );
    await expect(page.getByRole('button', { name: 'Services' })).toBeDisabled();
    await expect(
      page.getByText(/Services filter is unavailable/i),
    ).toBeVisible();

    // Personal override -> Year, then Reset to company defaults -> Month
    await page.getByRole('button', { name: 'Year' }).click();
    await expect(page.getByRole('button', { name: 'Year' })).toHaveClass(
      /period-button-active/,
    );
    await page
      .getByRole('button', { name: 'Reset to company defaults' })
      .click();
    await expect(page.getByRole('button', { name: 'Month' })).toHaveClass(
      /period-button-active/,
    );

    // Navigate to Orders -> open order -> Audit opens Products & Services groups
    await page.goto('/?page=orders&ordersTab=orders&saleId=rep-policy-1');
    await page.getByRole('button', { name: 'Audit' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Products' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Services' }),
    ).toBeVisible();
  });

  test('UK mobile: renders Accounting & Audit tab and Audit modal cleanly without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installFinancePolicyE2eMocks(page, { lang: 'uk' });

    await page.goto('/?page=accounting&accountingSettings=1');

    const policyTab = page.locator('.warehouse-settings-tab', {
      hasText: 'Облік і аудит',
    });
    await expect(policyTab).toBeVisible();
    await policyTab.click();

    await expect(page.getByText('Версія v1')).toBeVisible();

    const overflowMobile = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowMobile).toBe(false);

    await page.getByLabel(/Дозволити ручний аудит собівартості послуг/i).check();
    await page.getByRole('button', { name: 'Зберегти правила' }).click();
    await expect(page.getByText('Версія v2')).toBeVisible();

    await page.goto('/?page=orders&ordersTab=orders&saleId=rep-policy-1');
    await page.getByRole('button', { name: 'Аудит' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Товари' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Послуги' }),
    ).toBeVisible();

    const modalOverflow = await dialog.evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1,
    );
    expect(modalOverflow).toBe(false);
  });
});
