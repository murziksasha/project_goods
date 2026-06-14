import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
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
}));

vi.mock('../product/model', () => {
  class ProductMock {
    static exists = vi.fn(async () => false);
    static findOne = vi.fn(() => ({
      select: () => ({
        lean: async () => null,
      }),
    }));

    _id: { toString: () => string };

    constructor(payload: Record<string, unknown>) {
      Object.assign(this, payload);
      state.createdProducts.push(payload);
      this._id = {
        toString: () => `product-${state.createdProducts.length}`,
      };
    }

    validate = vi.fn(async () => undefined);
    save = vi.fn(async () => undefined);
  }

  return { Product: ProductMock };
});

vi.mock('../supplier/model', () => ({
  Supplier: {
    findById: vi.fn(() => ({
      lean: async () => ({ _id: 'supplier-1', name: 'Cable Supplier' }),
    })),
  },
}));

vi.mock('../finance/service', () => ({
  createFinanceTransaction: vi.fn(),
}));

vi.mock('../catalog-product/model', () => ({
  CatalogProduct: {
    findById: vi.fn(() => ({
      select: () => ({
        lean: async () => null,
      }),
    })),
  },
}));

vi.mock('../warehouse-settings/model', () => ({
  WarehouseSettings: {
    findOne: vi.fn(() => ({
      lean: async () => state.warehouseSettings,
    })),
  },
}));

vi.mock('../sequence/service', () => ({
  formatProductSerialNumber: (value: number) =>
    `S${String(value).padStart(6, '0')}`,
  formatProductArticle: (value: number) =>
    `A${String(value).padStart(6, '0')}`,
  getNextProductSerialNumberValue: vi.fn(async () => {
    state.serialValue += 1;
    return state.serialValue;
  }),
  getNextProductArticleValue: vi.fn(async () => {
    state.articleValue += 1;
    return state.articleValue;
  }),
}));

vi.mock('./model', () => ({
  receiptStatuses: ['new', 'approved', 'received'],
  supplierOrderStatuses: [
    'request',
    'ordered',
    'approved',
    'stocked',
    'overdue',
    'cancelled',
    'unavailable',
  ],
  supplierPaymentStatuses: [
    'pending',
    'paid',
    'without_payment',
    'cancelled',
  ],
  SupplierOrder: {
    findById: vi.fn(async () => state.supplierOrder),
    find: vi.fn(),
    updateMany: vi.fn(),
  },
}));

import { takeOnChargeSupplierOrder } from './service';

describe('takeOnChargeSupplierOrder', () => {
  beforeEach(() => {
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
    state.supplierOrder = {
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
      toObject: vi.fn(() => state.supplierOrder),
    };
  });

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
