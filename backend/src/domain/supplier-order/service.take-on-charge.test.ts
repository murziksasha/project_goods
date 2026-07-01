import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult, leanSelectResult } from '../../test/mongoose-mocks';
import { CatalogProduct } from '../catalog-product/model';
import { Product } from '../product/model';
import * as sequenceService from '../sequence/service';
import { Supplier } from '../supplier/model';
import { WarehouseSettings } from '../warehouse-settings/model';
import { SupplierOrder } from './model';
import { takeOnChargeSupplierOrder } from './service';

const state = {
  createdProducts: [] as Record<string, unknown>[],
  supplierOrder: undefined as Record<string, unknown> | undefined,
  warehouseSettings: {
    warehouses: [
      {
        id: 'w-1',
        name: 'Main',
        isActive: true,
        locations: [{ id: 'l-1', name: 'A' }],
      },
    ],
  } as Record<string, unknown>,
  serialValue: 18,
  articleValue: 0,
};

const buildSupplierOrder = () => {
  const items = [
    {
      lineId: 'line-3',
      itemIndex: 2,
      productName: 'Patchcord 1m',
      quantity: 2,
      price: 35,
      receiptStatus: 'approved',
    },
  ];
  return {
    _id: '507f1f77bcf86cd799439011',
    orderBaseId: 'SO-1',
    number: 'SO-1',
    supplier: '507f1f77bcf86cd799439012',
    deliveryDate: new Date('2026-01-05T00:00:00.000Z'),
    supplyType: 'Local',
    note: '',
    createdBy: 'Owner',
    status: 'approved',
    paymentStatus: 'pending',
    receiptStatus: 'approved',
    items,
    total: 70,
    paid: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    validate: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    toObject: vi.fn(function toObject(this: Record<string, unknown>) {
      return this;
    }),
  };
};

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(SupplierOrder, 'findById').mockImplementation(
    async () => state.supplierOrder as never,
  );
  vi.spyOn(Supplier, 'findById').mockReturnValue(
    leanResult({ _id: 'supplier-1', name: 'Cable Supplier' }) as never,
  );
  vi.spyOn(WarehouseSettings, 'findOne').mockImplementation(
    () => leanResult(state.warehouseSettings) as never,
  );
  vi.spyOn(CatalogProduct, 'findById').mockReturnValue(
    leanSelectResult(null) as never,
  );
  vi.spyOn(Product, 'exists').mockResolvedValue(null as never);
  vi.spyOn(Product, 'findOne').mockReturnValue(leanSelectResult(null) as never);
  vi.spyOn(sequenceService, 'getNextProductSerialNumberValue').mockImplementation(
    async () => {
      state.serialValue += 1;
      return state.serialValue;
    },
  );
  vi.spyOn(sequenceService, 'getNextProductArticleValue').mockImplementation(
    async () => {
      state.articleValue += 1;
      return state.articleValue;
    },
  );
  vi.spyOn(Product.prototype, 'validate').mockResolvedValue(undefined as never);
  vi.spyOn(Product.prototype, 'save').mockImplementation(async function saveProduct(
    this: any,
  ) {
    const record = {
      name: this.name,
      article: this.article,
      serialNumber: this.serialNumber,
      warehouseId: this.warehouseId,
      locationId: this.locationId,
      supplierOrderId: String(this.supplierOrderId ?? ''),
      supplierOrderItemIndex: this.supplierOrderItemIndex,
    };
    state.createdProducts.push(record);
    this._id = `product-${state.createdProducts.length}`;
    return this;
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  state.createdProducts = [];
  state.warehouseSettings = {
    warehouses: [
      {
        id: 'w-1',
        name: 'Main',
        isActive: true,
        locations: [{ id: 'l-1', name: 'A' }],
      },
    ],
  };
  state.serialValue = 18;
  state.articleValue = 0;
  state.supplierOrder = buildSupplierOrder();
  installSpies();
});

describe('takeOnChargeSupplierOrder', () => {
  it('stores supplier order provenance on each stocked product', async () => {
    await takeOnChargeSupplierOrder('507f1f77bcf86cd799439011', {
      itemIndex: 2,
      warehouseId: 'w-1',
      locationId: 'l-1',
    });

    expect(state.createdProducts).toHaveLength(2);
    expect(state.createdProducts).toEqual([
      expect.objectContaining({
        name: 'Patchcord 1m',
        supplierOrderId: '507f1f77bcf86cd799439011',
        supplierOrderItemIndex: 2,
      }),
      expect.objectContaining({
        name: 'Patchcord 1m',
        supplierOrderId: '507f1f77bcf86cd799439011',
        supplierOrderItemIndex: 2,
      }),
    ]);
  });

  it('rejects inactive warehouses', async () => {
    state.warehouseSettings = {
      warehouses: [
        {
          id: 'w-1',
          name: 'Main',
          isActive: false,
          locations: [{ id: 'l-1', name: 'A' }],
        },
        {
          id: 'w-2',
          name: 'Active',
          isActive: true,
          locations: [{ id: 'l-2', name: 'B' }],
        },
      ],
    };

    await expect(
      takeOnChargeSupplierOrder('507f1f77bcf86cd799439011', {
        itemIndex: 2,
        warehouseId: 'w-1',
        locationId: 'l-1',
      }),
    ).rejects.toThrow('Selected warehouse is inactive.');
    expect(state.createdProducts).toHaveLength(0);
  });

  it('uses the first active warehouse as default', async () => {
    state.warehouseSettings = {
      warehouses: [
        {
          id: 'w-inactive',
          name: 'Inactive',
          isActive: false,
          locations: [{ id: 'l-inactive', name: 'Old' }],
        },
        {
          id: 'w-active',
          name: 'Active',
          isActive: true,
          locations: [{ id: 'l-active', name: 'Main' }],
        },
      ],
    };

    await takeOnChargeSupplierOrder('507f1f77bcf86cd799439011', {
      itemIndex: 2,
    });

    expect(state.createdProducts).toEqual([
      expect.objectContaining({
        warehouseId: 'w-active',
        locationId: 'l-active',
      }),
      expect.objectContaining({
        warehouseId: 'w-active',
        locationId: 'l-active',
      }),
    ]);
  });
});