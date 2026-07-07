import { describe, expect, it } from 'vitest';
import type { Employee } from '../../../entities/employee/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { buildEmployeeInformationReport } from './employee-information';

const baseEmployee = (patch: Partial<Employee> = {}): Employee => ({
  id: 'employee-1',
  name: 'Manager One',
  phone: '',
  email: '',
  username: 'manager',
  role: 'manager',
  permissions: ['orders.manage'],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const baseSale = (patch: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  recordNumber: 'R000001',
  saleDate: '2026-05-12T10:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'issued',
  paidAmount: 100,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'ok',
  },
  product: null,
  manager: {
    id: 'employee-1',
    name: 'Manager One',
    role: 'manager',
  },
  master: null,
  issuedBy: null,
  createdAt: '2026-05-12T10:00:00.000Z',
  updatedAt: '2026-05-12T10:00:00.000Z',
  ...patch,
});

const defaultFilters = {
  search: '',
  role: 'all' as const,
  sort: 'count' as const,
  sortDirection: 'desc' as const,
  dateFrom: '',
  dateTo: '',
};

describe('employee information', () => {
  it('aggregates order creation metrics by manager', () => {
    const employees = [
      baseEmployee(),
      baseEmployee({ id: 'employee-2', name: 'Manager Two', username: 'manager2' }),
    ];
    const sales = [
      baseSale(),
      baseSale({
        id: 'sale-2',
        manager: { id: 'employee-1', name: 'Manager One', role: 'manager' },
      }),
      baseSale({
        id: 'sale-3',
        kind: 'repair',
        manager: { id: 'employee-2', name: 'Manager Two', role: 'manager' },
      }),
    ];

    const report = buildEmployeeInformationReport({
      employees,
      sales,
      view: 'orders',
      filters: defaultFilters,
    });

    const managerOne = report.rows.find((row) => row.id === 'employee-1');
    const managerTwo = report.rows.find((row) => row.id === 'employee-2');

    expect(managerOne?.count).toBe(2);
    expect(managerTwo?.count).toBe(1);
    expect(report.summary.ordersInPeriod).toBe(3);
  });

  it('aggregates repair metrics by master and completed count', () => {
    const employees = [
      baseEmployee({ id: 'master-1', name: 'Master One', role: 'master' }),
    ];
    const sales = [
      baseSale({
        id: 'repair-1',
        kind: 'repair',
        status: 'issued',
        master: { id: 'master-1', name: 'Master One', role: 'master' },
      }),
      baseSale({
        id: 'repair-2',
        kind: 'repair',
        status: 'new',
        master: { id: 'master-1', name: 'Master One', role: 'master' },
      }),
    ];

    const report = buildEmployeeInformationReport({
      employees,
      sales,
      view: 'repairs',
      filters: defaultFilters,
    });

    expect(report.rows[0]?.count).toBe(2);
    expect(report.rows[0]?.completedCount).toBe(1);
    expect(report.summary.repairsInPeriod).toBe(2);
  });

  it('includes only active employees and builds per-employee achievements', () => {
    const employees = [
      baseEmployee(),
      baseEmployee({
        id: 'employee-2',
        name: 'Inactive Manager',
        username: 'inactive',
        isActive: false,
      }),
      baseEmployee({
        id: 'master-1',
        name: 'Active Master',
        username: 'master',
        role: 'master',
      }),
    ];
    const sales = [
      baseSale(),
      baseSale({
        id: 'sale-2',
        kind: 'repair',
        salePrice: 200,
        manager: { id: 'employee-1', name: 'Manager One', role: 'manager' },
        master: { id: 'master-1', name: 'Active Master', role: 'master' },
      }),
      baseSale({
        id: 'sale-3',
        manager: {
          id: 'employee-2',
          name: 'Inactive Manager',
          role: 'manager',
        },
      }),
    ];

    const report = buildEmployeeInformationReport({
      employees,
      sales,
      view: 'achievements',
      filters: {
        ...defaultFilters,
        sort: 'orders',
      },
    });

    expect(report.rows).toHaveLength(2);
    expect(report.rows.some((row) => row.id === 'employee-2')).toBe(false);

    const managerOne = report.rows.find((row) => row.id === 'employee-1');
    const masterOne = report.rows.find((row) => row.id === 'master-1');

    expect(managerOne?.achievements.ordersCreated).toBe(2);
    expect(managerOne?.achievements.salesAsManager).toBe(1);
    expect(masterOne?.achievements.repairsAsMaster).toBe(1);
    expect(masterOne?.username).toBe('master');
  });

  it('filters by today date range', () => {
    const employees = [baseEmployee()];
    const sales = [
      baseSale({ createdAt: '2026-07-07T10:00:00.000Z' }),
      baseSale({
        id: 'sale-2',
        createdAt: '2026-07-06T10:00:00.000Z',
        manager: { id: 'employee-1', name: 'Manager One', role: 'manager' },
      }),
    ];

    const todayOnly = buildEmployeeInformationReport({
      employees,
      sales,
      view: 'orders',
      filters: {
        ...defaultFilters,
        dateFrom: '2026-07-07',
        dateTo: '2026-07-07',
      },
    });

    expect(todayOnly.summary.ordersInPeriod).toBe(1);
    expect(todayOnly.rows.find((row) => row.id === 'employee-1')?.count).toBe(1);
  });

  it('filters by date range', () => {
    const employees = [baseEmployee()];
    const sales = [
      baseSale({ createdAt: '2026-05-01T10:00:00.000Z' }),
      baseSale({
        id: 'sale-2',
        createdAt: '2026-06-01T10:00:00.000Z',
        manager: { id: 'employee-1', name: 'Manager One', role: 'manager' },
      }),
    ];

    const mayOnly = buildEmployeeInformationReport({
      employees,
      sales,
      view: 'orders',
      filters: {
        ...defaultFilters,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
      },
    });
    expect(mayOnly.summary.ordersInPeriod).toBe(1);
    expect(mayOnly.rows.find((row) => row.id === 'employee-1')?.count).toBe(1);
  });

  it('ignores sales attributed to employees that no longer exist', () => {
    const employees = [baseEmployee()];
    const sales = [
      baseSale(),
      baseSale({
        id: 'sale-orphan',
        manager: {
          id: 'deleted-employee',
          name: 'Deleted Worker',
          role: 'manager',
        },
      }),
    ];

    const report = buildEmployeeInformationReport({
      employees,
      sales,
      view: 'achievements',
      filters: {
        ...defaultFilters,
        sort: 'orders',
      },
    });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.achievements.ordersCreated).toBe(1);
  });

  it('sorts rows by revenue descending', () => {
    const employees = [
      baseEmployee({ id: 'employee-1', name: 'Low' }),
      baseEmployee({ id: 'employee-2', name: 'High' }),
    ];
    const sales = [
      baseSale({
        id: 'sale-1',
        salePrice: 50,
        manager: { id: 'employee-1', name: 'Low', role: 'manager' },
      }),
      baseSale({
        id: 'sale-2',
        salePrice: 500,
        manager: { id: 'employee-2', name: 'High', role: 'manager' },
      }),
    ];

    const report = buildEmployeeInformationReport({
      employees,
      sales,
      view: 'sales',
      filters: {
        ...defaultFilters,
        sort: 'revenue',
        sortDirection: 'desc',
      },
    });

    expect(report.rows[0]?.id).toBe('employee-2');
    expect(report.rows[1]?.id).toBe('employee-1');
  });
});