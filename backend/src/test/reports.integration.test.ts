import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app';
import { hashAuthToken } from '../shared/lib/auth';

const TOKEN = 'report-integration-token';
const TOKEN_HASH = hashAuthToken(TOKEN);

let activeEmployeeRecord: { _id?: string; role: string; permissions: string[] } = {
  _id: '507f1f77bcf86cd799439011',
  role: 'manager',
  permissions: ['orders.view'],
};

let EmployeeModel: typeof import('../domain/employee/model').Employee;

const makeEmployeeDoc = () => {
  const now = new Date('2026-11-01T10:00:00.000Z');
  const idStr = activeEmployeeRecord._id ?? '507f1f77bcf86cd799439011';
  return {
    _id: { toString: () => idStr },
    name: 'Test Employee',
    phone: '+380501112233',
    email: 'emp@example.com',
    username: 'emp',
    role: activeEmployeeRecord.role,
    permissions: activeEmployeeRecord.permissions,
    isActive: true,
    note: '',
    createdAt: now,
    updatedAt: now,
    authToken: TOKEN_HASH,
    authTokens: [TOKEN_HASH],
    authSessions: [{ token: TOKEN_HASH, createdAt: now, lastUsedAt: now }],
    save: vi.fn().mockResolvedValue(undefined),
    toObject() {
      return this;
    },
  };
};

const chain = (rows: unknown = []) => ({
  sort: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(rows),
});

describe('Reports, Scenarios & Cost Permissions API', () => {
  beforeAll(async () => {
    ({ Employee: EmployeeModel } = await import('../domain/employee/model'));
    const { Product } = await import('../domain/product/model');
    const { Sale } = await import('../domain/sale/model');
    const { SupplierOrder } = await import('../domain/supplier-order/model');
    const { Supplier } = await import('../domain/supplier/model');
    const { CatalogProduct } = await import('../domain/catalog-product/model');
    const { WarehouseSettings } = await import('../domain/warehouse-settings/model');
    const { Cashbox, FinanceCategory, FinanceCurrencyConfig, FinanceTransaction } =
      await import('../domain/finance/model');
    const periodSnapshot = await import('../domain/finance/period-snapshot');
    const { Scenario } = await import('../domain/scenario/model');
    const yearlyDump = await import('../domain/archive/yearly-dump');

    vi.spyOn(yearlyDump, 'coldSalesPurgedExist').mockResolvedValue(false);

    vi.spyOn(Product, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(Sale, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(Sale, 'findOne').mockReturnValue(chain(null) as never);
    vi.spyOn(SupplierOrder, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(Supplier, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(CatalogProduct, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(WarehouseSettings, 'findOne').mockReturnValue(chain(null) as never);
    vi.spyOn(Cashbox, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(FinanceTransaction, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(FinanceCategory, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(FinanceCurrencyConfig, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(FinanceCurrencyConfig, 'findOneAndUpdate').mockReturnValue(chain(null) as never);
    vi.spyOn(periodSnapshot, 'getActiveFinancePeriodSnapshot').mockResolvedValue(null);
    vi.spyOn(Scenario, 'find').mockReturnValue(chain([]) as never);
    vi.spyOn(Scenario, 'countDocuments').mockResolvedValue(0 as never);
  });

  beforeEach(() => {
    vi.spyOn(EmployeeModel, 'findOne').mockReturnValue({
      select: vi.fn().mockImplementation(async () => makeEmployeeDoc()),
    } as never);
  });

  it('requires authentication for report and scenario endpoints', async () => {
    await request(app).get('/api/reports/warehouse').expect(401);
    await request(app).get('/api/reports/orders/repairs').expect(401);
    await request(app).get('/api/finance/cashboxes-report').expect(401);
    await request(app).get('/api/scenarios').expect(401);
  });

  it('enforces endpoint permissions across Orders subviews, Warehouse, Finance, and Cost updates', async () => {
    // Master has orders.view + repairs.execute + kanban.use ONLY (no supplierOrders.view, no inventory.manage, no finance.view)
    activeEmployeeRecord = {
      role: 'master',
      permissions: ['orders.view', 'repairs.execute', 'kanban.use'],
    };

    await request(app)
      .get('/api/reports/orders/repairs')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(200);
    await request(app)
      .get('/api/reports/orders/procurement')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(403);
    await request(app)
      .get('/api/reports/warehouse')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(403);
    await request(app)
      .get('/api/finance/cashboxes-report')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(403);
    await request(app)
      .get('/api/finance/profit-report/details')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(403);

    // Warehouse role has inventory.manage + supplierOrders.view + orders.view, no finance.view
    activeEmployeeRecord = {
      role: 'warehouse',
      permissions: ['inventory.manage', 'supplierOrders.view', 'orders.view'],
    };
    await request(app)
      .get('/api/reports/warehouse')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(200);
    await request(app)
      .get('/api/reports/orders/procurement')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(200);
    await request(app)
      .get('/api/scenarios?domain=cashflow')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(403);

    // Finance user gets 200 on cashboxes-report & profit-report/details
    activeEmployeeRecord = {
      role: 'accountant',
      permissions: ['finance.view', 'orders.manage'],
    };
    await request(app)
      .get('/api/finance/cashboxes-report')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(200);
    await request(app)
      .get('/api/finance/profit-report/details')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(200);
  });

  it('redacts line item cost fields from GET /sales/:id without finance.view and rejects PATCH /sales/:id/costs without manage + finance.view', async () => {
    const { Sale } = await import('../domain/sale/model');
    const saleId = '507f1f77bcf86cd799439401';
    const docDate = new Date('2026-10-10T10:00:00.000Z');
    vi.spyOn(Sale, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => saleId },
        recordNumber: 'R000777',
        saleDate: docDate,
        quantity: 1,
        salePrice: 500,
        kind: 'repair',
        status: 'issued',
        paidAmount: 500,
        note: '',
        timeline: [],
        paymentHistory: [],
        lineItems: [
          {
            id: 'li-1',
            kind: 'service',
            name: 'Repair',
            price: 500,
            quantity: 1,
            costMethod: 'fixed',
            fixedCost: 180,
            directExpenses: 20,
            costSnapshot: { status: 'known', unitCost: 200, totalCost: 200, method: 'fixed', capturedAt: docDate },
          },
        ],
        discount: { mode: 'percent', value: 0 },
        client: { toString: () => 'c1' },
        clientSnapshot: { name: 'Client', phone: '+380501234567', status: 'new' },
        product: null,
        productSnapshot: { article: 'REP', name: 'Phone', serialNumber: '' },
        manager: null,
        master: null,
        issuedBy: null,
        createdAt: docDate,
        updatedAt: docDate,
      }),
    } as never);

    // orders.manage WITHOUT finance.view -> GET strips costs, PATCH /costs rejected 403
    activeEmployeeRecord = {
      role: 'manager',
      permissions: ['orders.view', 'orders.manage'],
    };
    const resWithoutFin = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(200);
    expect(resWithoutFin.body.lineItems[0].fixedCost).toBeUndefined();
    expect(resWithoutFin.body.lineItems[0].costSnapshot).toBeUndefined();

    await request(app)
      .patch(`/api/sales/${saleId}/costs`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ items: [{ lineItemId: 'li-1', unitCost: 150 }], reason: 'Unauthorized' })
      .expect(403);

    // orders.view + finance.view WITHOUT orders.manage -> PATCH /costs rejected 403, GET includes costs
    activeEmployeeRecord = {
      role: 'support',
      permissions: ['orders.view', 'finance.view'],
    };
    const resWithFin = await request(app)
      .get(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(200);
    expect(resWithFin.body.lineItems[0].fixedCost).toBe(180);
    expect(resWithFin.body.lineItems[0].costSnapshot.totalCost).toBe(200);

    await request(app)
      .patch(`/api/sales/${saleId}/costs`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ items: [{ lineItemId: 'li-1', unitCost: 150 }], reason: 'Unauthorized' })
      .expect(403);
  });
});
