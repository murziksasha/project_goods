import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Sale } from '../sale/model';
import { ServiceCatalog } from './model';
import { mergeServices } from './service';

const targetServiceId = '507f1f77bcf86cd799439077';
const sourceServiceId = '507f1f77bcf86cd799439088';

const createMockService = (
  id: string,
  name: string,
  price = 300,
  note = '',
) => {
  const doc: any = {
    _id: new mongoose.Types.ObjectId(id),
    name,
    nameKey: name.toLowerCase(),
    price,
    salePriceOptions: [250],
    note,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    validate: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    toObject() {
      return this;
    },
  };
  return doc;
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  vi.spyOn(Sale, 'find').mockReturnValue({
    lean: vi.fn().mockResolvedValue([]),
  } as never);
});

describe('mergeServices', () => {
  it('rejects invalid or missing IDs', async () => {
    await expect(mergeServices('', sourceServiceId)).rejects.toThrow(
      'Both targetServiceId and sourceServiceId are required.',
    );
    await expect(
      mergeServices(targetServiceId, targetServiceId),
    ).rejects.toThrow('Select two different services.');
    await expect(
      mergeServices('bad', sourceServiceId),
    ).rejects.toThrow('Valid targetServiceId is required.');
  });

  it('rejects when target or source does not exist', async () => {
    vi.spyOn(ServiceCatalog, 'findById').mockResolvedValue(null);
    await expect(
      mergeServices(targetServiceId, sourceServiceId),
    ).rejects.toThrow('Target service not found.');
  });

  it('consolidates notes, relinks sale line items while preserving prices and quantities, and deletes source', async () => {
    const target = createMockService(
      targetServiceId,
      'Screen Replacement',
      1200,
      'Target note',
    );
    const source = createMockService(
      sourceServiceId,
      'screen replacement',
      800,
      'Source note',
    );

    vi.spyOn(ServiceCatalog, 'findById').mockImplementation(((
      id: string,
    ) => {
      if (id === targetServiceId) return Promise.resolve(target);
      if (id === sourceServiceId) return Promise.resolve(source);
      return Promise.resolve(null);
    }) as never);

    const linkedSale = {
      _id: 'sale-1',
      status: 'completed',
      paidAmount: 1600,
      lineItems: [
        {
          id: 'line-1',
          kind: 'service',
          serviceId: new mongoose.Types.ObjectId(sourceServiceId),
          name: 'screen replacement',
          price: 800,
          quantity: 2,
        },
      ],
    };

    vi.spyOn(Sale, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([linkedSale]),
    } as never);

    const saleFindByIdAndUpdate = vi
      .spyOn(Sale, 'findByIdAndUpdate')
      .mockResolvedValue({} as never);
    const serviceFindByIdAndDelete = vi
      .spyOn(ServiceCatalog, 'findByIdAndDelete')
      .mockReturnValue(leanResult(source) as never);

    const result = await mergeServices(
      targetServiceId,
      sourceServiceId,
      'Draft note',
    );

    expect(saleFindByIdAndUpdate).toHaveBeenCalledWith(
      'sale-1',
      {
        lineItems: [
          {
            id: 'line-1',
            kind: 'service',
            serviceId: target._id,
            name: 'Screen Replacement',
            price: 800,
            quantity: 2,
          },
        ],
      },
      expect.anything(),
    );

    expect(target.note).toBe('Target note\nSource note\nDraft note');
    expect(target.save).toHaveBeenCalled();
    expect(serviceFindByIdAndDelete).toHaveBeenCalledWith(
      sourceServiceId,
      expect.anything(),
    );

    expect(result.removedServiceId).toBe(sourceServiceId);
    expect(result.relinkedSalesCount).toBe(1);
    expect(result.service.name).toBe('Screen Replacement');
    expect(result.service.price).toBe(1200);
  });
});
