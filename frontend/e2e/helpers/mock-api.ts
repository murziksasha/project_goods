import type { Page } from '@playwright/test';

const iso = '2026-08-31T12:00:00.000Z';

export const e2eEmployee = {
  id: 'emp-e2e',
  name: 'E2E Admin',
  phone: '',
  email: 'e2e@local.test',
  username: 'admin',
  role: 'owner',
  permissions: [],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: iso,
  updatedAt: iso,
};

export const e2eCashboxes = [
  {
    id: 'cashbox-main',
    name: 'Основна',
    balances: { UAH: 980, USD: 0 },
    enabledCurrencies: { UAH: true, USD: false },
    isDefault: true,
    isArchived: false,
    createdAt: iso,
    updatedAt: iso,
  },
  {
    id: 'cashbox-bank',
    name: 'Банк Ремонт Сервис',
    balances: { UAH: 120050, USD: 0 },
    enabledCurrencies: { UAH: true, USD: false },
    isDefault: false,
    isArchived: false,
    createdAt: iso,
    updatedAt: iso,
  },
];

const e2eCurrencies = [
  { id: 'cur-uah', code: 'UAH', isSystem: true, isArchived: false, createdAt: iso, updatedAt: iso },
  { id: 'cur-usd', code: 'USD', isSystem: true, isArchived: false, createdAt: iso, updatedAt: iso },
];

const e2eCategories = [
  { id: 'cat-rent', slug: 'rent', name: 'Rent', isSystem: true, kind: 'system_opex', isActive: true, sortOrder: 110, usageCount: 0, createdAt: iso, updatedAt: iso },
  { id: 'cat-salary', slug: 'salary', name: 'Salary', isSystem: true, kind: 'system_opex', isActive: true, sortOrder: 120, usageCount: 0, createdAt: iso, updatedAt: iso },
  { id: 'cat-utilities', slug: 'utilities', name: 'Utilities', isSystem: true, kind: 'system_opex', isActive: true, sortOrder: 130, usageCount: 0, createdAt: iso, updatedAt: iso },
  { id: 'cat-tax', slug: 'tax', name: 'Tax', isSystem: true, kind: 'system_opex', isActive: true, sortOrder: 140, usageCount: 0, createdAt: iso, updatedAt: iso },
  { id: 'cat-owner', slug: 'owner_draw', name: 'Owner draw', isSystem: true, kind: 'system_opex', isActive: true, sortOrder: 150, usageCount: 0, createdAt: iso, updatedAt: iso },
  { id: 'cat-other', slug: 'other', name: 'Other', isSystem: true, kind: 'system_opex', isActive: true, sortOrder: 9999, usageCount: 0, createdAt: iso, updatedAt: iso },
  { id: 'cat-pay', slug: 'client_payment', name: 'Client payment', isSystem: true, kind: 'system_auto', isActive: true, sortOrder: 10, usageCount: 0, createdAt: iso, updatedAt: iso },
  { id: 'cat-refund', slug: 'client_refund', name: 'Client refund', isSystem: true, kind: 'system_auto', isActive: true, sortOrder: 20, usageCount: 0, createdAt: iso, updatedAt: iso },
  { id: 'cat-supplier', slug: 'supplier_payment', name: 'Supplier payment', isSystem: true, kind: 'system_auto', isActive: true, sortOrder: 30, usageCount: 0, createdAt: iso, updatedAt: iso },
  { id: 'cat-ads', slug: 'c_aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Ads', isSystem: false, kind: 'custom_opex', isActive: true, sortOrder: 200, usageCount: 2, createdAt: iso, updatedAt: iso },
];

const e2eSettings = {
  id: 'settings-e2e',
  serviceName: 'E2E CRM',
  company: '',
  companyAddress: '',
  companyId: '',
  companyIban: '',
  companyEmail: '',
  companySite: '',
  printForms: [],
  orderDefaults: {},
  numbering: {},
  financeDefaults: {},
  notificationSettings: {},
  dashboardPreferences: {},
  createdAt: iso,
  updatedAt: iso,
};

export const installE2eApiMocks = async (page: Page) => {
  const categories = e2eCategories.map((category) => ({ ...category }));
  await page.route(
    (url) => {
      const pathname = url.pathname;
      return pathname === '/api' || pathname.startsWith('/api/');
    },
    async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '') || '/';
    const method = request.method();

    const fulfillJson = async (body: unknown, status = 200) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(body),
      });
    };

    try {
      if (method === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
            'access-control-allow-methods': '*',
          },
        });
        return;
      }
      if (path === '/auth/login' && method === 'POST') {
        await fulfillJson({ token: 'e2e-token', employee: e2eEmployee });
        return;
      }
      if (path === '/auth/me' || path.endsWith('/auth/me')) {
        await fulfillJson(e2eEmployee);
        return;
      }
      if (path === '/auth/logout') {
        await fulfillJson({ ok: true });
        return;
      }
      if (path.startsWith('/finance/cashboxes')) {
        await fulfillJson(e2eCashboxes);
        return;
      }
      if (path.startsWith('/finance/currencies')) {
        await fulfillJson(e2eCurrencies);
        return;
      }
      if (path.startsWith('/finance/categories')) {
        if (method === 'POST') {
          let posted: { name?: string } = {};
          try {
            posted = (request.postDataJSON() ?? {}) as typeof posted;
          } catch {
            posted = {};
          }
          await fulfillJson(
            {
              id: `cat-${Date.now()}`,
              slug: `c_${'a'.repeat(24)}`,
              name: posted.name ?? 'Custom',
              isSystem: false,
              kind: 'custom_opex',
              isActive: true,
              sortOrder: 200,
              usageCount: 0,
              createdAt: iso,
              updatedAt: iso,
            },
            201,
          );
          return;
        }
        if (method === 'DELETE') {
          const slug = path.split('/').pop();
          const index = categories.findIndex((category) => category.slug === slug);
          if (index >= 0) categories.splice(index, 1);
          await fulfillJson({ ok: true });
          return;
        }
        if (method === 'PATCH') {
          const slug = path.split('/').pop();
          const existing = categories.find((category) => category.slug === slug);
          let posted: { name?: string; isActive?: boolean } = {};
          try {
            posted = (request.postDataJSON() ?? {}) as typeof posted;
          } catch {
            posted = {};
          }
          const updated = {
            ...(existing ?? {
              id: `cat-${slug}`,
              slug,
              name: slug,
              isSystem: true,
              kind: 'system_opex',
              isActive: true,
              sortOrder: 0,
              usageCount: 0,
              createdAt: iso,
            }),
            ...posted,
            updatedAt: iso,
          };
          if (existing) Object.assign(existing, updated);
          await fulfillJson(updated);
          return;
        }
        await fulfillJson(categories);
        return;
      }
      if (path.startsWith('/finance/transactions')) {
        if (method === 'POST') {
          let posted: { type?: string; amount?: string; currency?: string } = {};
          try {
            posted = (request.postDataJSON() ?? {}) as typeof posted;
          } catch {
            posted = {};
          }
          await fulfillJson({
            id: `tx-${Date.now()}`,
            type: posted.type ?? 'deposit',
            amount: Number(posted.amount ?? 0),
            currency: posted.currency ?? 'UAH',
            fromCashbox: null,
            toCashbox: { id: 'cashbox-main', name: 'Основна' },
            note: '',
            transactionDate: iso,
            status: 'active',
            isCancellation: false,
            createdAt: iso,
            updatedAt: iso,
          });
          return;
        }
        await fulfillJson({ items: [], total: 0, page: 1, pageSize: 6 });
        return;
      }
      if (path.startsWith('/finance/profit-report')) {
        await fulfillJson({
          period: { key: 'whole', dateFrom: null, dateTo: null, timeZone: 'Europe/Kiev' },
          source: 'all',
          currency: 'UAH',
          otherCurrencies: [],
          margin: {
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            grossMarginPct: null,
            unknownCostCount: 0,
          },
          cash: {
            collected: 0,
            inventoryPurchases: 0,
            opex: 0,
            refunds: 0,
            net: 0,
            opexByCategory: [],
            operations: [],
          },
          rows: [],
          dataScope: 'live_sales_only',
          coldSalesPurgedExist: false,
          saleCount: 0,
        });
        return;
      }
      if (path.startsWith('/finance/report')) {
        await fulfillJson({
          totals: { UAH: 121030, USD: 0 },
          cashboxCount: 2,
          transactionCount: 0,
          todayTransactionCount: 0,
          todayTurnover: { UAH: 0 },
        });
        return;
      }
      if (path === '/settings' || path.startsWith('/settings/')) {
        await fulfillJson(e2eSettings);
        return;
      }
      if (path.includes('/events/stream')) {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body: ':\n\n',
        });
        return;
      }
      if (method === 'GET') {
        await fulfillJson([]);
        return;
      }
      await fulfillJson({});
    } catch {
      await fulfillJson({});
    }
  });
};
