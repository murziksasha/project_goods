import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  buildLocationUsageByWarehouse,
  buildWarehouseInformationReport,
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
      filters: {
        search: '',
        warehouseId: '',
        locationId: '',
        supplier: '',
        status: 'all',
        sort: 'quantity',
      },
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
});
