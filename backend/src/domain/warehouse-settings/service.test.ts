import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Product } from '../product/model';
import { WarehouseSettings } from './model';
import { updateWarehouseSettings } from './service';

const defaultDate = new Date('2026-01-01T00:00:00.000Z');

const baseSettings = {
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
  createdAt: defaultDate,
  updatedAt: defaultDate,
};

let currentSettings = baseSettings;
let hasReferencedProduct = false;

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(WarehouseSettings, 'findOne').mockImplementation(
    () => leanResult(currentSettings) as never,
  );
  vi.spyOn(WarehouseSettings, 'findOneAndUpdate').mockImplementation(
    (_query: unknown, payload: Record<string, unknown>) =>
      leanResult({
        ...currentSettings,
        ...payload,
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      }) as never,
  );
  vi.spyOn(Product, 'exists').mockImplementation(async () =>
    hasReferencedProduct ? ({ _id: 'product-1' } as never) : (null as never),
  );
};

const payload = {
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
      locations: [] as { id: string; name: string }[],
    },
  ],
  administrators: [],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  currentSettings = { ...baseSettings };
  hasReferencedProduct = false;
  installSpies();
});

describe('warehouse settings service', () => {
  it('rejects deleting a location referenced by products', async () => {
    hasReferencedProduct = true;

    await expect(updateWarehouseSettings(payload)).rejects.toThrow(
      'Location "Shelf A" cannot be deleted while products reference it.',
    );
  });

  it('allows deleting an empty location', async () => {
    await expect(updateWarehouseSettings(payload)).resolves.toMatchObject({
      warehouses: [
        {
          id: 'w-1',
          locations: [],
        },
      ],
    });
  });
});