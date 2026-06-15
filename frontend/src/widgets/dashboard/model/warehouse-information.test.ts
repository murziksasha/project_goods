import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  buildLocationUsageByWarehouse,
  buildWarehouseInformationReport,
  type WarehouseInformationFilters,
} from './warehouse-information';
import type { WarehouseItem } from './warehouse-panel';

const product = (overrides: Partial<Product>): Product => ({
  id: 'p-1',
  name: 'Patchcord 1m',
  article: 'PC-1',
  serialNumber: 'S-1',
  price: 100,
  salePriceOptions: [],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  purchaseDate: '2026-01-01T00:00:00.000Z',
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const supplierOrder = (): SupplierOrder => ({
  id: 'so-1',
  orderBaseId: 'SO-1',
  supplierId: 'supplier-1',
  supplierName: 'Cable Supplier',
  deliveryDate: '2026-01-01T00:00:00.000Z',
  supplyType: 'Local',
  number: 'SO-1',
  note: '',
  createdBy: 'Owner',
  status: 'stocked',
  paymentStatus: 'pending',
  receiptStatus: 'received',
  total: 100,
  paid: 0,
  isFavorite: false,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      productName: 'Patchcord 1m',
      quantity: 1,
      price: 100,
      receiptStatus: 'received',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const warehouses: WarehouseItem[] = [
  {
    id: 'w-1',
    name: 'Main',
    isActive: true,
    serviceCenterId: 'sc-1',
    receiptAddress: '',
    receiptPhone: '',
    locations: [{ id: 'l-1', name: 'A1' }],
  },
  {
    id: 'w-2',
    name: 'Old',
    isActive: false,
    serviceCenterId: 'sc-1',
    receiptAddress: '',
    receiptPhone: '',
    locations: [{ id: 'l-2', name: 'Archive' }],
  },
];

const filters = (
  overrides: Partial<WarehouseInformationFilters> = {},
): WarehouseInformationFilters => ({
  search: '',
  warehouseId: '',
  locationId: '',
  supplier: '',
  status: 'all',
  sort: 'quantity',
  sortDirection: 'desc',
  dateFrom: '',
  dateTo: '',
  ...overrides,
});

describe('warehouse information', () => {
  it('counts location usage from all product records', () => {
    expect(
      buildLocationUsageByWarehouse([
        product({ id: 'p-1', warehouseId: 'w-1', locationId: 'l-1' }),
        product({
          id: 'p-2',
          isActive: false,
          warehouseId: 'w-1',
          locationId: 'l-1',
        }),
      ]),
    ).toEqual({ 'w-1': { 'l-1': 2 } });
  });

  it('groups products, locations and suppliers including inactive warehouses', () => {
    const report = buildWarehouseInformationReport({
      products: [
        product({
          id: 'p-1',
          warehouseId: 'w-1',
          locationId: 'l-1',
          supplierOrderId: 'so-1',
          supplierOrderItemIndex: 0,
        }),
        product({
          id: 'p-2',
          name: 'Router',
          article: 'RT-1',
          quantity: 2,
          price: 300,
          warehouseId: 'w-2',
          locationId: 'l-2',
          purchasePlace: 'Legacy Supplier',
        }),
      ],
      sales: [],
      warehouses,
      supplierOrders: [supplierOrder()],
      filters: filters(),
    });

    expect(report.summary).toMatchObject({
      totalUnits: 3,
      uniquePositions: 2,
      purchaseValue: 700,
      activeWarehouses: 1,
      inactiveWarehousesWithStock: 1,
      locationsWithStock: 2,
    });
    expect(report.products.map((row) => row.name)).toEqual([
      'Router',
      'Patchcord 1m',
    ]);
    expect(report.locations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          warehouseName: 'Old',
          locationName: 'Archive',
          isWarehouseActive: false,
          units: 2,
        }),
      ]),
    );
    expect(report.suppliers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          supplierName: 'Cable Supplier',
          units: 1,
        }),
        expect.objectContaining({
          supplierName: 'Legacy Supplier',
          units: 2,
        }),
      ]),
    );
  });

  it('filters stock rows by purchase date and updates summaries', () => {
    const report = buildWarehouseInformationReport({
      products: [
        product({
          id: 'p-1',
          warehouseId: 'w-1',
          locationId: 'l-1',
          supplierOrderId: 'so-1',
          supplierOrderItemIndex: 0,
          purchaseDate: '2026-01-10T00:00:00.000Z',
        }),
        product({
          id: 'p-2',
          name: 'Router',
          article: 'RT-1',
          quantity: 2,
          price: 300,
          warehouseId: 'w-2',
          locationId: 'l-2',
          purchasePlace: 'Legacy Supplier',
          purchaseDate: '2026-02-10T00:00:00.000Z',
        }),
        product({
          id: 'p-3',
          name: 'Switch',
          article: 'SW-1',
          quantity: 3,
          price: 200,
          warehouseId: 'w-1',
          locationId: 'l-1',
          purchasePlace: 'Network Supplier',
          purchaseDate: '2026-03-10T00:00:00.000Z',
        }),
      ],
      sales: [],
      warehouses,
      supplierOrders: [supplierOrder()],
      filters: filters({
        dateFrom: '2026-02-01',
        dateTo: '2026-02-28',
      }),
    });

    expect(report.products.map((row) => row.name)).toEqual(['Router']);
    expect(report.summary).toMatchObject({
      totalUnits: 2,
      uniquePositions: 1,
      purchaseValue: 600,
      activeWarehouses: 0,
      inactiveWarehousesWithStock: 1,
      locationsWithStock: 1,
    });
    expect(report.locations).toEqual([
      expect.objectContaining({
        warehouseName: 'Old',
        locationName: 'Archive',
        units: 2,
      }),
    ]);
    expect(report.suppliers).toEqual([
      expect.objectContaining({
        supplierName: 'Legacy Supplier',
        units: 2,
      }),
    ]);
  });

  it('sorts latest purchase date ascending and descending', () => {
    const products = [
      product({
        id: 'p-1',
        name: 'Patchcord 1m',
        article: 'PC-1',
        warehouseId: 'w-1',
        locationId: 'l-1',
        purchaseDate: '2026-01-10T00:00:00.000Z',
      }),
      product({
        id: 'p-2',
        name: 'Router',
        article: 'RT-1',
        warehouseId: 'w-1',
        locationId: 'l-1',
        purchasePlace: 'Legacy Supplier',
        purchaseDate: '2026-03-10T00:00:00.000Z',
      }),
    ];

    const descending = buildWarehouseInformationReport({
      products,
      sales: [],
      warehouses,
      supplierOrders: [supplierOrder()],
      filters: filters({ sort: 'latest', sortDirection: 'desc' }),
    });
    const ascending = buildWarehouseInformationReport({
      products,
      sales: [],
      warehouses,
      supplierOrders: [supplierOrder()],
      filters: filters({ sort: 'latest', sortDirection: 'asc' }),
    });

    expect(descending.products.map((row) => row.name)).toEqual([
      'Router',
      'Patchcord 1m',
    ]);
    expect(ascending.products.map((row) => row.name)).toEqual([
      'Patchcord 1m',
      'Router',
    ]);
  });

  it('matches supplier filters by partial supplier text', () => {
    const report = buildWarehouseInformationReport({
      products: [
        product({
          id: 'p-1',
          warehouseId: 'w-1',
          locationId: 'l-1',
          supplierOrderId: 'so-1',
          supplierOrderItemIndex: 0,
        }),
        product({
          id: 'p-2',
          name: 'Router',
          article: 'RT-1',
          warehouseId: 'w-1',
          locationId: 'l-1',
          purchasePlace: 'Legacy Supplier',
        }),
      ],
      sales: [],
      warehouses,
      supplierOrders: [supplierOrder()],
      filters: filters({ supplier: 'cable' }),
    });

    expect(report.products.map((row) => row.name)).toEqual(['Patchcord 1m']);
    expect(report.suppliers).toEqual([
      expect.objectContaining({
        supplierName: 'Cable Supplier',
      }),
    ]);
  });
});
