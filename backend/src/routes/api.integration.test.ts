import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app';

const TEST_AUTH_TOKEN = 'integration-test-token';

type MockEmployeeRecord = {
  role: string;
  permissions: string[];
  username?: string;
};

let activeEmployee: MockEmployeeRecord = {
  role: 'manager',
  permissions: ['orders.view'],
};

let EmployeeModel: typeof import('../domain/employee/model').Employee;

const authHeader = (token = TEST_AUTH_TOKEN) => ({
  Authorization: `Bearer ${token}`,
});

const buildEmployeeDocument = (record: MockEmployeeRecord) => ({
  _id: { toString: () => 'employee-id' },
  name: 'Integration Tester',
  phone: '+380000000000',
  email: 'tester@example.com',
  username: record.username ?? 'tester',
  role: record.role,
  permissions: record.permissions,
  isActive: true,
  note: '',
  createdAt: new Date('2026-06-09T12:00:00.000Z'),
  updatedAt: new Date('2026-06-09T12:00:00.000Z'),
  authToken: TEST_AUTH_TOKEN,
  authTokens: [TEST_AUTH_TOKEN],
  toObject() {
    return this;
  },
});

const mockFindChain = <T>(rows: T[]) => ({
  sort: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(rows),
});

beforeAll(async () => {
  ({ Employee: EmployeeModel } = await import('../domain/employee/model'));
  const { Product } = await import('../domain/product/model');
  const { Client } = await import('../domain/client/model');
  const { Sale } = await import('../domain/sale/model');
  const { Settings } = await import('../domain/settings/model');

  vi.spyOn(Product, 'find').mockReturnValue(mockFindChain([]) as never);
  vi.spyOn(Client, 'find').mockReturnValue(mockFindChain([]) as never);
  vi.spyOn(Sale, 'find').mockReturnValue(mockFindChain([]) as never);
  const settingsDocument = {
    _id: { toString: () => 'settings-id' },
    serviceName: 'Test Co',
    createdAt: new Date('2026-06-09T12:00:00.000Z'),
    updatedAt: new Date('2026-06-09T12:00:00.000Z'),
    printForms: [],
    dashboardPreferences: {
      marketWeatherEnabled: true,
      exchangeRatesEnabled: true,
      weatherEnabled: true,
      weatherAnimationEnabled: true,
      defaultWeatherLocation: 'chornomorsk',
      weatherProvider: 'open-meteo',
      openWeatherApiKey: '',
      currencies: ['USD', 'EUR'],
      rateProviders: ['nbu'],
      defaultForecastView: 'today',
    },
  };

  vi.spyOn(Settings, 'findOne').mockReturnValue({
    lean: vi.fn().mockResolvedValue(settingsDocument),
  } as never);
  vi.spyOn(Settings, 'findOneAndUpdate').mockReturnValue({
    lean: vi.fn().mockResolvedValue(settingsDocument),
  } as never);

  const demoService = await import('../domain/demo/service');
  vi.spyOn(demoService, 'seedDemoData').mockResolvedValue({
    seeded: true,
  } as never);
});

const mockEmployeeLookup = () => {
  vi.spyOn(EmployeeModel, 'findOne').mockImplementation((query: unknown) => {
    const tokenQuery = query as {
      $or?: Array<{ authTokens?: string; authToken?: string }>;
    };
    const token =
      tokenQuery.$or?.[0]?.authTokens ??
      tokenQuery.$or?.[1]?.authToken ??
      '';

    const select = vi.fn(async () => {
      if (!token || token !== TEST_AUTH_TOKEN) {
        return null;
      }

      return buildEmployeeDocument(activeEmployee);
    });

    return { select } as never;
  });
};

describe('API auth matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeEmployee = {
      role: 'manager',
      permissions: ['orders.view'],
    };
    mockEmployeeLookup();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns health without auth', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('buildSha');
  });

  it('returns 401 for protected routes without token', async () => {
    const response = await request(app).get('/api/products');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/token|authorization/i);
  });

  it('returns 401 for invalid bearer token', async () => {
    const response = await request(app)
      .get('/api/products')
      .set(authHeader('invalid-token'));

    expect(response.status).toBe(401);
  });

  it('returns 403 when employee lacks write permission', async () => {
    activeEmployee = { role: 'support', permissions: [] };

    const response = await request(app)
      .post('/api/products')
      .set(authHeader())
      .send({ name: 'Test product' });

    expect(response.status).toBe(403);
  });

  it('returns 403 when non-owner updates settings', async () => {
    activeEmployee = { role: 'support', permissions: [] };

    const response = await request(app)
      .put('/api/settings')
      .set(authHeader())
      .send({ companyName: 'Changed' });

    expect(response.status).toBe(403);
  });

  it('returns 403 for finance cashbox write without finance.cashboxes.manage', async () => {
    activeEmployee = { role: 'support', permissions: ['finance.view'] };

    const response = await request(app)
      .post('/api/finance/cashboxes')
      .set(authHeader())
      .send({ name: 'Till' });

    expect(response.status).toBe(403);
  });

  it('returns 403 for supplier-order write without supplierOrders.manage', async () => {
    activeEmployee = { role: 'support', permissions: ['supplierOrders.view'] };

    const response = await request(app)
      .post('/api/supplier-orders')
      .set(authHeader())
      .send({ supplierId: '507f1f77bcf86cd799439012' });

    expect(response.status).toBe(403);
  });

  it('returns 403 for warehouse-settings write without inventory.manage', async () => {
    activeEmployee = { role: 'support', permissions: ['orders.view'] };

    const response = await request(app)
      .put('/api/warehouse-settings')
      .set(authHeader())
      .send({ warehouses: [] });

    expect(response.status).toBe(403);
  });

  it('returns 403 for backups without system.backups.manage', async () => {
    activeEmployee = { role: 'manager', permissions: ['inventory.manage'] };

    const response = await request(app).get('/api/backups').set(authHeader());

    expect(response.status).toBe(403);
  });

  it('returns 404 for missing sale update target', async () => {
    activeEmployee = { role: 'manager', permissions: ['orders.manage'] };
    const { Sale } = await import('../domain/sale/model');
    vi.spyOn(Sale, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as never);

    const response = await request(app)
      .put('/api/sales/507f1f77bcf86cd799439099')
      .set(authHeader())
      .send({ kind: 'repair', clientId: '507f1f77bcf86cd799439011' });

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/not found/i);
  });
});

describe('API smoke reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeEmployee = {
      role: 'manager',
      permissions: ['orders.view', 'clients.manage', 'inventory.manage'],
    };
    mockEmployeeLookup();
  });

  it('lists products for read permission', async () => {
    const response = await request(app)
      .get('/api/products')
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('lists clients for read permission', async () => {
    const response = await request(app)
      .get('/api/clients')
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('lists sales for read permission', async () => {
    const response = await request(app)
      .get('/api/sales')
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns settings for authenticated employees', async () => {
    const response = await request(app)
      .get('/api/settings')
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.serviceName).toBe('Test Co');
  });
});

describe('demo routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeEmployee = { role: 'owner', permissions: [], username: 'owner' };
    mockEmployeeLookup();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks demo seed in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = await request(app)
      .post('/api/demo/seed')
      .set(authHeader());

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('disabled in production');
  });

  it('allows demo seed for owner in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const response = await request(app)
      .post('/api/demo/seed')
      .set(authHeader());

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ seeded: true });
  });
});