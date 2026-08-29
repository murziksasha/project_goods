import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sale } from './model';
import { leanSelectResult } from './test-helpers';
import {
  assertSerialNumbersNotBoundToOtherSales,
  findOccupiedSerialNumbers,
} from './validators';

const otherSale = {
  lineItems: [
    { kind: 'product', serialNumbers: ['S000031', ' s000032 '] },
    { kind: 'service', serialNumbers: ['S999999'] },
    { kind: 'product', serialNumbers: ['S000099'] },
  ],
};

describe('findOccupiedSerialNumbers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns only requested serials bound on other product lines', async () => {
    vi.spyOn(Sale, 'find').mockReturnValue(leanSelectResult([otherSale]) as never);

    await expect(
      findOccupiedSerialNumbers({
        excludeSaleId: '507f1f77bcf86cd799439011',
        serials: ['s000031', 'S000033', 'S000032'],
      }),
    ).resolves.toEqual(['S000031', 'S000032']);

    expect(Sale.find).toHaveBeenCalledWith({
      lineItems: {
        $elemMatch: {
          kind: 'product',
          serialNumbers: { $in: ['S000031', 'S000033', 'S000032'] },
        },
      },
      _id: { $ne: '507f1f77bcf86cd799439011' },
    });
  });

  it('omits excludeSaleId when empty and returns nothing for empty serials', async () => {
    const find = vi.spyOn(Sale, 'find');

    await expect(
      findOccupiedSerialNumbers({ serials: ['  ', ''] }),
    ).resolves.toEqual([]);
    expect(find).not.toHaveBeenCalled();

    vi.spyOn(Sale, 'find').mockReturnValue(leanSelectResult([]) as never);
    await expect(
      findOccupiedSerialNumbers({ serials: ['S000031'] }),
    ).resolves.toEqual([]);
    expect(Sale.find).toHaveBeenCalledWith({
      lineItems: {
        $elemMatch: {
          kind: 'product',
          serialNumbers: { $in: ['S000031'] },
        },
      },
    });
  });
});

describe('assertSerialNumbersNotBoundToOtherSales', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects serials already bound to another sale', async () => {
    vi.spyOn(Sale, 'find').mockReturnValue(leanSelectResult([otherSale]) as never);

    await expect(
      assertSerialNumbersNotBoundToOtherSales('507f1f77bcf86cd799439011', [
        {
          id: 'line-1',
          kind: 'product',
          name: 'Battery',
          price: 10,
          quantity: 1,
          serialNumbers: ['S000031'],
        },
      ]),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Serial numbers are already bound to another order: S000031',
    });
  });

  it('allows serials that are only on the current sale', async () => {
    vi.spyOn(Sale, 'find').mockReturnValue(leanSelectResult([]) as never);

    await expect(
      assertSerialNumbersNotBoundToOtherSales('507f1f77bcf86cd799439011', [
        {
          id: 'line-1',
          kind: 'product',
          name: 'Battery',
          price: 10,
          quantity: 1,
          serialNumbers: ['S000031'],
        },
      ]),
    ).resolves.toBeUndefined();
  });
});
