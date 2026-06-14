import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  currentSettings: {
    _id: { toString: () => 'settings-1' },
    serviceCenters: [],
    warehouses: [
      {
        id: 'w-1',
        name: 'Main',
        isActive: true,
        serviceCenterId: 'sc-1',
        receiptAddress: '',
        receiptPhone: '',
        locations: [{ id: 'l-1', name: 'Shelf A' }],
      },
    ],
    administrators: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  hasReferencedProduct: false,
}));

vi.mock('../product/model', () => ({
  Product: {
    exists: vi.fn(async () =>
      state.hasReferencedProduct ? { _id: 'product-1' } : null,
    ),
  },
}));

vi.mock('./model', () => ({
  WarehouseSettings: {
    findOne: vi.fn(() => ({
      lean: async () => state.currentSettings,
    })),
    findOneAndUpdate: vi.fn((_query, payload) => ({
      lean: async () => ({
        ...state.currentSettings,
        ...payload,
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    })),
  },
}));

import { updateWarehouseSettings } from './service';

describe('warehouse settings service', () => {
  beforeEach(() => {
    state.hasReferencedProduct = false;
  });

  it('rejects deleting a location referenced by products', async () => {
    state.hasReferencedProduct = true;

    await expect(
      updateWarehouseSettings({
        serviceCenters: [
          {
            id: 'sc-1',
            name: 'RS main',
            color: '#000000',
            address: '',
            phone: '',
          },
        ],
        warehouses: [
          {
            id: 'w-1',
            name: 'Main',
            isActive: true,
            serviceCenterId: 'sc-1',
            receiptAddress: '',
            receiptPhone: '',
            locations: [],
          },
        ],
        administrators: [],
      }),
    ).rejects.toThrow(
      'Location "Shelf A" cannot be deleted while products reference it.',
    );
  });

  it('allows deleting an empty location', async () => {
    await expect(
      updateWarehouseSettings({
        serviceCenters: [
          {
            id: 'sc-1',
            name: 'RS main',
            color: '#000000',
            address: '',
            phone: '',
          },
        ],
        warehouses: [
          {
            id: 'w-1',
            name: 'Main',
            isActive: true,
            serviceCenterId: 'sc-1',
            receiptAddress: '',
            receiptPhone: '',
            locations: [],
          },
        ],
        administrators: [],
      }),
    ).resolves.toMatchObject({
      warehouses: [
        {
          id: 'w-1',
          locations: [],
        },
      ],
    });
  });
});
