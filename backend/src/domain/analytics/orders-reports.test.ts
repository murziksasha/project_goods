import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sale } from '../sale/model';
import { Product } from '../product/model';
import { Supplier } from '../supplier/model';
import { SupplierOrder } from '../supplier-order/model';
import * as yearlyDump from '../archive/yearly-dump';
import * as financePolicy from '../finance/policy';
import {
  getOrdersProcurementTable,
  getOrdersRepairsTable,
  getOrdersSalesTable,
} from './orders-reports';
import { getOrdersSalesDetails } from './orders-report';
import { formatKievDateKey } from './period-utils';

const mockSelectLean = (rows: unknown) => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }),
});

const oid = (id: string) => ({ toString: () => id });

const now = new Date('2026-10-20T12:00:00.000Z');

const repairBase = (overrides: Record<string, unknown> = {}) => ({
  _id: oid('r1'),
  recordNumber: 'r000001',
  kind: 'repair',
  saleDate: new Date('2026-10-15T10:00:00.000Z'),
  status: 'issued',
  salePrice: 1000,
  quantity: 1,
  paidAmount: 400,
  master: oid('m1'),
  masterSnapshot: { name: 'Oleh' },
  manager: oid('mgr1'),
  managerSnapshot: { name: 'Ira' },
  client: oid('c1'),
  clientSnapshot: { name: 'Ada', phone: '+380991112233' },
  productSnapshot: { name: 'Pixel 8', serialNumber: 'SN-1', article: 'PX8' },
  discount: { mode: 'amount', value: 50 },
  lineItems: [
    {
      id: 'svc-1',
      kind: 'service',
      name: 'Screen',
      price: 800,
      quantity: 1,
      costSnapshot: { status: 'known', unitCost: 200, totalCost: 200, method: 'fixed' },
    },
    {
      id: 'prd-1',
      kind: 'product',
      name: 'Glass',
      price: 250,
      quantity: 1,
      costSnapshot: { status: 'known', unitCost: 80, totalCost: 80, method: 'stock' },
    },
  ],
  completedAt: new Date('2026-10-16T10:00:00.000Z'),
  statusTransitions: [
    {
      id: 't1',
      fromStatus: 'completed',
      toStatus: 'issued',
      changedAt: new Date('2026-10-17T10:00:00.000Z'),
    },
  ],
  ...overrides,
});

describe('Orders Reports table endpoints', () => {
  let capturedFilter: unknown;

  beforeEach(() => {
    vi.restoreAllMocks();
    capturedFilter = undefined;
    vi.spyOn(yearlyDump, 'coldSalesPurgedExist').mockResolvedValue(false);
    vi.spyOn(financePolicy, 'getFinancePolicy').mockResolvedValue({
      serviceProfitMode: 'full',
      serviceAuditEnabled: false,
    } as never);
    vi.spyOn(Product, 'find').mockReturnValue(mockSelectLean([]) as never);
    vi.spyOn(Supplier, 'find').mockReturnValue(mockSelectLean([]) as never);
    vi.spyOn(SupplierOrder, 'find').mockImplementation((filter: unknown) => {
      capturedFilter = filter;
      return mockSelectLean([]) as never;
    });
  });

  it('bounds repairs at Mongo on saleDate for a last30 period and returns wide rows', async () => {
    vi.spyOn(Sale, 'find').mockImplementation((filter: unknown) => {
      capturedFilter = filter;
      return mockSelectLean([repairBase()]) as never;
    });

    const result = await getOrdersRepairsTable(
      { period: 'last30' },
      { now, includeCosts: true },
    );

    expect(capturedFilter).toEqual(
      expect.objectContaining({
        kind: 'repair',
        saleDate: expect.objectContaining({
          $gte: expect.any(Date),
          $lte: expect.any(Date),
        }),
      }),
    );
    const gte = (capturedFilter as { saleDate: { $gte: Date; $lte: Date } }).saleDate.$gte;
    const lte = (capturedFilter as { saleDate: { $gte: Date; $lte: Date } }).saleDate.$lte;
    expect(formatKievDateKey(gte)).toBe('2026-09-21');
    expect(formatKievDateKey(lte)).toBe('2026-10-20');
    expect(result.items).toHaveLength(1);
    const row = result.items[0]!;
    expect(row.recordNumber).toBe('r000001');
    expect(row.clientName).toBe('Ada');
    expect(row.clientPhone).toBe('+380991112233');
    expect(row.deviceName).toBe('Pixel 8');
    expect(row.serialNumber).toBe('SN-1');
    expect(row.masterName).toBe('Oleh');
    expect(row.managerName).toBe('Ira');
    expect(row.issuedAt).toBe(new Date('2026-10-17T10:00:00.000Z').toISOString());
    expect(row.completedAt).toBe(new Date('2026-10-16T10:00:00.000Z').toISOString());
    expect(row.turnaroundHours).toBe(24);
    expect(row.servicesCount).toBe(1);
    expect(row.productsCount).toBe(1);
    expect(row.paid).toBe(400);
    expect(row.debt).toBe(row.total - 400);
    expect(row.knownCost).toBe(280);
    expect(row.isIncomplete).toBe(false);
    expect(result.grandTotal.count).toBe(1);
  });

  it('omits finance fields entirely when includeCosts is false', async () => {
    vi.spyOn(Sale, 'find').mockReturnValue(mockSelectLean([repairBase()]) as never);
    const result = await getOrdersRepairsTable({ period: 'last30' }, { now, includeCosts: false });
    const row = result.items[0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('knownCost');
    expect(row).not.toHaveProperty('knownProfit');
    expect(row).not.toHaveProperty('marginPct');
    expect(row).not.toHaveProperty('isIncomplete');
    expect(row).not.toHaveProperty('missingCostCount');
    expect(result.grandTotal).not.toHaveProperty('knownCost');
    const json = JSON.stringify(result);
    expect(json).not.toContain('knownCost');
    expect(json).not.toContain('knownProfit');
  });

  it('filters unassigned technicians and computes summary groupBy aggregates', async () => {
    vi.spyOn(Sale, 'find').mockReturnValue(
      mockSelectLean([
        repairBase({
          _id: oid('r-assigned'),
          recordNumber: 'r000010',
          paidAmount: 1000,
        }),
        repairBase({
          _id: oid('r-free'),
          recordNumber: 'r000011',
          master: null,
          masterSnapshot: {},
          paidAmount: 0,
          status: 'inRepair',
          completedAt: null,
          statusTransitions: [],
        }),
      ]) as never,
    );

    const unassigned = await getOrdersRepairsTable(
      { period: 'last30', masterId: 'unassigned' },
      { now, includeCosts: false },
    );
    expect((unassigned as { items: Array<{ recordNumber: string }> }).items.map((r) => r.recordNumber)).toEqual([
      'r000011',
    ]);

    const summary = await getOrdersRepairsTable(
      { period: 'last30', mode: 'summary', groupBy: 'master,status' },
      { now, includeCosts: true },
    );
    expect(summary.mode).toBe('summary');
    expect(summary.groupBy).toEqual(['master', 'status']);
    expect(summary.groups.length).toBeGreaterThanOrEqual(2);
    const oleh = summary.groups.find((g) => g.label === 'Oleh');
    const free = summary.groups.find((g) => g.key === 'unassigned' || g.label === 'Unassigned');
    expect(oleh?.count).toBe(1);
    expect(oleh?.children?.length).toBeGreaterThanOrEqual(1);
    expect(free?.count).toBe(1);
    expect(summary.grandTotal.count).toBe(2);
    expect(oleh?.filters).toEqual(expect.objectContaining({ masterId: 'm1' }));
  });

  it('exports repairs in batches of 1000 with no page cap and a nextCursor', async () => {
    const rows = Array.from({ length: 1205 }, (_, i) =>
      repairBase({
        _id: oid(`r-${i}`),
        recordNumber: `r${String(i).padStart(6, '0')}`,
        saleDate: new Date('2026-10-15T10:00:00.000Z'),
      }),
    );
    vi.spyOn(Sale, 'find').mockReturnValue(mockSelectLean(rows) as never);

    const page1 = await getOrdersRepairsTable(
      { period: 'last30', cursor: '1' },
      { now, includeCosts: false, exportMode: true },
    );
    expect(page1.items).toHaveLength(1000);
    expect(page1.pageSize).toBe(1000);
    expect(page1.total).toBe(1205);
    expect(page1.nextCursor).toBe('2');

    const page2 = await getOrdersRepairsTable(
      { period: 'last30', cursor: '2' },
      { now, includeCosts: false, exportMode: true },
    );
    expect(page2.items).toHaveLength(205);
    expect(page2.nextCursor).toBeNull();
  });

  it('returns sales payment breakdown and applies paymentMethod / lineKind filters', async () => {
    vi.spyOn(Sale, 'find').mockReturnValue(
      mockSelectLean([
        {
          _id: oid('s1'),
          recordNumber: 's000001',
          kind: 'sale',
          saleDate: new Date('2026-10-18T10:00:00.000Z'),
          status: 'paid',
          salePrice: 500,
          quantity: 1,
          paidAmount: 500,
          client: oid('c1'),
          clientSnapshot: { name: 'Bob' },
          manager: oid('mgr1'),
          managerSnapshot: { name: 'Ira' },
          discount: { mode: 'percent', value: 0 },
          lineItems: [
            { id: 'p1', kind: 'product', name: 'SSD', price: 400, quantity: 1 },
            { id: 'sv1', kind: 'service', name: 'Setup', price: 100, quantity: 1 },
          ],
          paymentHistory: [
            { id: 'pay1', type: 'deposit', paymentMethod: 'cash', amount: 300 },
            { id: 'pay2', type: 'deposit', paymentMethod: 'non-cash', amount: 200 },
          ],
          returnEvents: [{ id: 'ret1', name: 'SSD', quantity: 1, grossAmount: 50, refundAmount: 40, returnedAt: now }],
        },
        {
          _id: oid('s2'),
          recordNumber: 's000002',
          kind: 'sale',
          saleDate: new Date('2026-10-18T11:00:00.000Z'),
          status: 'paid',
          salePrice: 80,
          quantity: 1,
          paidAmount: 80,
          clientSnapshot: { name: 'Cara' },
          lineItems: [{ id: 'sv2', kind: 'service', name: 'Clean', price: 80, quantity: 1 }],
          paymentHistory: [{ id: 'pay3', type: 'deposit', paymentMethod: 'cash', amount: 80 }],
          returnEvents: [],
        },
      ]) as never,
    );

    const all = await getOrdersSalesTable({ period: 'last30' }, { now, includeCosts: false });
    expect(all.items).toHaveLength(2);
    const s1 = all.items.find((r) => r.recordNumber === 's000001')!;
    expect(s1.paidCash).toBe(300);
    expect(s1.paidNonCash).toBe(200);
    expect(s1.returnCount).toBe(1);
    expect(s1.returnAmount).toBe(40);
    expect(s1).not.toHaveProperty('knownCost');

    const products = await getOrdersSalesTable(
      { period: 'last30', lineKind: 'product' },
      { now },
    );
    expect(products.items.map((r) => r.recordNumber)).toEqual(['s000001']);

    const nonCash = await getOrdersSalesTable(
      { period: 'last30', paymentMethod: 'non-cash' },
      { now },
    );
    expect(nonCash.items.map((r) => r.recordNumber)).toEqual(['s000001']);
  });

  it('filters procurement by overdueOnly and groups by supplier', async () => {
    vi.spyOn(Supplier, 'find').mockReturnValue(
      mockSelectLean([{ _id: oid('sup1'), name: 'Acme' }]) as never,
    );
    vi.spyOn(SupplierOrder, 'find').mockImplementation((filter: unknown) => {
      capturedFilter = filter;
      return mockSelectLean([
        {
          _id: oid('po1'),
          orderBaseId: 'PO-1',
          number: '12',
          supplier: oid('sup1'),
          deliveryDate: new Date('2026-10-01T00:00:00.000Z'),
          status: 'ordered',
          paymentStatus: 'unpaid',
          receiptStatus: 'pending',
          total: 1000,
          paid: 200,
          items: [
            { productName: 'Board', quantity: 4, receiptStatus: 'pending' },
          ],
          createdAt: new Date('2026-10-10T00:00:00.000Z'),
        },
        {
          _id: oid('po2'),
          orderBaseId: 'PO-2',
          number: '13',
          supplier: oid('sup1'),
          deliveryDate: new Date('2026-11-01T00:00:00.000Z'),
          status: 'stocked',
          paymentStatus: 'paid',
          receiptStatus: 'received',
          total: 500,
          paid: 500,
          items: [
            { productName: 'Cable', quantity: 2, receiptStatus: 'received' },
          ],
          stockedAt: new Date('2026-10-19T00:00:00.000Z'),
          createdAt: new Date('2026-10-11T00:00:00.000Z'),
        },
      ]) as never;
    });

    const overdue = await getOrdersProcurementTable(
      { period: 'last30', overdueOnly: true },
      { now },
    );
    expect(capturedFilter).toEqual(
      expect.objectContaining({
        createdAt: expect.objectContaining({ $gte: expect.any(Date), $lte: expect.any(Date) }),
      }),
    );
    expect(overdue.items).toHaveLength(1);
    expect(overdue.items[0]?.displayNumber).toBe('12');
    expect(overdue.items[0]?.isOverdue).toBe(true);
    expect(overdue.items[0]?.outstanding).toBe(800);

    const summary = await getOrdersProcurementTable(
      { period: 'last30', mode: 'summary', groupBy: 'supplier' },
      { now },
    );
    expect(summary.groups[0]?.label).toBe('Acme');
    expect(summary.groups[0]?.count).toBe(2);
    expect(summary.grandTotal.total).toBe(1500);
  });
});

describe('Information sales details filter parity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('applies lineKind and paymentMethod filters on sales details', async () => {
    vi.spyOn(Sale, 'find').mockReturnValue(
      mockSelectLean([
        {
          _id: oid('s1'),
          recordNumber: 's000001',
          saleDate: new Date('2026-10-18T10:00:00.000Z'),
          status: 'paid',
          salePrice: 500,
          quantity: 1,
          paidAmount: 500,
          clientSnapshot: { name: 'Bob' },
          discount: { mode: 'percent', value: 0 },
          lineItems: [
            { id: 'p1', kind: 'product', name: 'SSD', price: 500, quantity: 1 },
          ],
          paymentHistory: [{ paymentMethod: 'non-cash' }],
          returnEvents: [],
          isRapidSale: false,
        },
        {
          _id: oid('s2'),
          recordNumber: 's000002',
          saleDate: new Date('2026-10-18T11:00:00.000Z'),
          status: 'paid',
          salePrice: 80,
          quantity: 1,
          paidAmount: 80,
          clientSnapshot: { name: 'Cara' },
          lineItems: [{ id: 'sv2', kind: 'service', name: 'Clean', price: 80, quantity: 1 }],
          paymentHistory: [{ paymentMethod: 'cash' }],
          returnEvents: [],
          isRapidSale: false,
        },
      ]) as never,
    );

    const products = await getOrdersSalesDetails(
      { period: 'last30', lineKind: 'product' },
      { now },
    );
    expect(products.items.map((r) => r.recordNumber)).toEqual(['s000001']);

    const cash = await getOrdersSalesDetails(
      { period: 'last30', paymentMethod: 'cash' },
      { now },
    );
    expect(cash.items.map((r) => r.recordNumber)).toEqual(['s000002']);
  });
});
