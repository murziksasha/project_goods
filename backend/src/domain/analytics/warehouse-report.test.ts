import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogProduct } from '../catalog-product/model';
import { Product } from '../product/model';
import { Sale } from '../sale/model';
import { SupplierOrder } from '../supplier-order/model';
import { WarehouseSettings } from '../warehouse-settings/model';
import * as yearlyDump from '../archive/yearly-dump';
import { getWarehouseReport, getWarehouseReportDetails } from './warehouse-report';

const mockSelectLean = (rows: unknown) => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }),
});

describe('warehouse report & forecasting engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(yearlyDump, 'coldSalesPurgedExist').mockResolvedValue(false);
    vi.spyOn(WarehouseSettings, 'findOne').mockReturnValue(
      mockSelectLean({
        warehouses: [
          {
            id: 'wh-1',
            name: 'Main Store',
            locations: [{ id: 'loc-1', name: 'Shelf A1' }],
          },
        ],
      }) as never,
    );
    vi.spyOn(CatalogProduct, 'find').mockReturnValue(mockSelectLean([]) as never);
  });

  it('computes reservations, missing purchase date unknown aging, incoming supplier orders, sparse & zero demand, and deterministic reorder suggestions', async () => {
    const now = new Date('2026-11-11T10:00:00.000Z');
    vi.setSystemTime(now);

    vi.spyOn(Product, 'find').mockReturnValue(
      mockSelectLean([
        {
          _id: { toString: () => 'p-ssd' },
          name: 'Samsung SSD 1TB',
          article: 'SSD-1',
          serialNumber: '',
          price: 2000,
          quantity: 10,
          reservedQuantity: 2,
          purchasePlace: 'Vendor One',
          warehouseId: 'wh-1',
          locationId: 'loc-1',
          supplierOrderId: '',
          purchaseDate: new Date('2026-10-20T09:00:00.000Z'), // 22 days -> 0-30
        },
        {
          _id: { toString: () => 'p-cable' },
          name: 'USB-C Cable',
          article: 'CBL-1',
          serialNumber: '',
          price: 100,
          quantity: 5,
          reservedQuantity: 0,
          purchasePlace: 'Vendor Two',
          warehouseId: 'wh-1',
          locationId: '',
          supplierOrderId: '',
          purchaseDate: null, // missing -> unknown
        },
        {
          _id: { toString: () => 'p-slow' },
          name: 'Vintage Case',
          article: 'CASE-1',
          serialNumber: 'SN-OLD',
          price: 300,
          quantity: 1,
          reservedQuantity: 0,
          purchasePlace: 'Vendor Two',
          warehouseId: 'wh-1',
          locationId: '',
          supplierOrderId: '',
          purchaseDate: new Date('2026-07-01T09:00:00.000Z'), // > 90 days -> 90+
        },
      ]) as never,
    );

    vi.spyOn(Sale, 'find').mockReturnValue(
      mockSelectLean([
        // Open repair binding 1 unit of p-ssd and 1 serial SN-OLD
        {
          kind: 'repair',
          status: 'inRepair',
          saleDate: new Date('2026-11-05T10:00:00.000Z'),
          lineItems: [
            { kind: 'product', productId: 'p-ssd', name: 'Samsung SSD 1TB', quantity: 1 },
            { kind: 'product', serialNumbers: ['SN-OLD'], name: 'Vintage Case', quantity: 1 },
          ],
        },
        // Committed sales in trailing 90 days: 90 units SSD -> 1.0/day; 3 units Cable on 1 day -> sparse 0.0333/day; 0 units Vintage Case
        {
          kind: 'sale',
          status: 'issued',
          saleDate: new Date('2026-10-15T10:00:00.000Z'),
          firstStockCommittedAt: new Date('2026-10-15T10:00:00.000Z'),
          lineItems: [
            { kind: 'product', productId: 'p-ssd', name: 'Samsung SSD 1TB', quantity: 90 },
            { kind: 'product', productId: 'p-cable', name: 'USB-C Cable', quantity: 3 },
          ],
        },
      ]) as never,
    );

    vi.spyOn(SupplierOrder, 'find').mockReturnValue(
      mockSelectLean([
        {
          _id: { toString: () => 'so-1' },
          status: 'ordered',
          deliveryDate: new Date('2026-11-20T00:00:00.000Z'),
          items: [
            { productName: 'Samsung SSD 1TB', quantity: 4, receiptStatus: 'new' },
          ],
        },
      ]) as never,
    );

    vi.spyOn(Sale, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ saleDate: new Date('2026-09-01T00:00:00.000Z') }),
        }),
      }),
    } as never);

    const report = await getWarehouseReport(
      {
        leadTimeDays: 14,
        safetyStockDays: 7,
        horizonDays: 30,
      },
      now,
    );

    expect(report.summary.totalQuantity).toBe(16);
    // p-ssd: manual 2 + open order 1 = 3; p-slow: serial bound = 1 -> total reserved 4
    expect(report.summary.reservedQuantity).toBe(4);
    expect(report.summary.availableQuantity).toBe(12);
    expect(report.summary.purchaseValuation).toBe(10 * 2000 + 5 * 100 + 300);
    expect(report.summary.unknownAgeOnHandCount).toBe(1);
    expect(report.summary.unknownAgeUnits).toBe(5);

    expect(report.agingBuckets.find((b) => b.bucket === '0-30')?.quantity).toBe(10);
    expect(report.agingBuckets.find((b) => b.bucket === '90+')?.quantity).toBe(1);
    expect(report.agingBuckets.find((b) => b.bucket === 'unknown')?.quantity).toBe(5);

    const ssd = report.demandAndSuggestions.find((r) => r.name === 'Samsung SSD 1TB')!;
    // available = 7, pending = 4 => netSupply = 11; targetBuffer = 1.0 * 21 = 21 => reorder = 10
    expect(ssd.availableQuantity).toBe(7);
    expect(ssd.pendingSupplierQuantity).toBe(4);
    expect(ssd.observedDailyDemand).toBe(1);
    expect(ssd.estimatedCoverageDays).toBe(7);
    expect(ssd.estimatedCoverageWithPendingDays).toBe(11);
    expect(ssd.reorderSuggestedQty).toBe(10);
    expect(ssd.horizonProjectedDemand).toBe(30);
    expect(ssd.horizonProjectedShortfall).toBe(19);

    const cable = report.demandAndSuggestions.find((r) => r.name === 'USB-C Cable')!;
    expect(cable.demandPattern).toBe('sparse');

    const vintage = report.demandAndSuggestions.find((r) => r.name === 'Vintage Case')!;
    expect(vintage.demandPattern).toBe('zero');
    expect(vintage.estimatedCoverageDays).toBeNull();
    expect(vintage.reorderSuggestedQty).toBe(0);

    // Pagination & full totals on details endpoint
    const page1 = await getWarehouseReportDetails({ page: 1, pageSize: 1 }, now);
    expect(page1.items).toHaveLength(1);
    expect(page1.total).toBe(3);
    expect(page1.totals.totalQuantity).toBe(16);
    expect(page1.totals.availableQuantity).toBe(12);
  });
});
