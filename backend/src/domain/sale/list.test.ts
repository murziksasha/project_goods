import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sale } from './model';
import { getSaleById, listOccupiedSerialNumbers, listSales } from './list';

vi.mock('../../shared/lib/formatters', () => ({
  formatSale: (sale: { _id: { toString: () => string }; kind: string }) => ({
    id: sale._id.toString(),
    kind: sale.kind,
  }),
}));

describe('listSales', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads full list without filters', async () => {
    const lean = vi.fn().mockResolvedValue([
      { _id: { toString: () => '1' }, kind: 'sale' },
    ]);
    const sort = vi.fn().mockReturnValue({ lean });
    const find = vi.spyOn(Sale, 'find').mockReturnValue({ sort } as never);

    await expect(listSales({})).resolves.toEqual([{ id: '1', kind: 'sale' }]);
    expect(find).toHaveBeenCalledWith({});
    expect(sort).toHaveBeenCalledWith({ saleDate: -1 });
  });

  it('applies filter and limit', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ lean });
    const sort = vi.fn().mockReturnValue({ limit });
    vi.spyOn(Sale, 'find').mockReturnValue({ sort } as never);

    await listSales({
      kind: 'repair',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      limit: '10',
    });

    expect(Sale.find).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'repair',
        saleDate: {
          $gte: new Date('2026-01-01T00:00:00.000Z'),
          $lte: new Date('2026-01-31T23:59:59.999Z'),
        },
      }),
    );
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('applies compact projection when compact=1', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const select = vi.fn().mockReturnValue({ lean });
    const sort = vi.fn().mockReturnValue({ select });
    vi.spyOn(Sale, 'find').mockReturnValue({ sort } as never);

    await listSales({ compact: '1' });

    expect(select).toHaveBeenCalledWith('-timeline -paymentHistory');
  });

  it('returns a paginated envelope when page is set', async () => {
    const lean = vi.fn().mockResolvedValue([
      { _id: { toString: () => '1' }, kind: 'repair' },
    ]);
    const limit = vi.fn().mockReturnValue({ lean });
    const skip = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ skip });
    const sort = vi.fn().mockReturnValue({ select });
    vi.spyOn(Sale, 'find').mockReturnValue({ sort } as never);
    vi.spyOn(Sale, 'countDocuments').mockResolvedValue(41);

    await expect(
      listSales({ kind: 'repair', page: '2', pageSize: '20', compact: '1' }),
    ).resolves.toEqual({
      items: [{ id: '1', kind: 'repair' }],
      total: 41,
      page: 2,
      pageSize: 20,
    });
    expect(skip).toHaveBeenCalledWith(20);
    expect(limit).toHaveBeenCalledWith(20);
    expect(select).toHaveBeenCalledWith('-timeline -paymentHistory');
  });

  it('loads a full sale by id', async () => {
    const lean = vi.fn().mockResolvedValue({
      _id: { toString: () => 'sale-1' },
      kind: 'repair',
    });
    vi.spyOn(Sale, 'findById').mockReturnValue({ lean } as never);

    await expect(getSaleById('507f1f77bcf86cd799439011')).resolves.toEqual({
      id: 'sale-1',
      kind: 'repair',
    });
  });
});

describe('listOccupiedSerialNumbers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty occupied list when serials are missing', async () => {
    const find = vi.spyOn(Sale, 'find');
    await expect(listOccupiedSerialNumbers({})).resolves.toEqual({
      occupied: [],
    });
    expect(find).not.toHaveBeenCalled();
  });

  it('queries occupancy and skips invalid excludeSaleId', async () => {
    const lean = vi.fn().mockResolvedValue([
      {
        lineItems: [{ kind: 'product', serialNumbers: ['S000031'] }],
      },
    ]);
    const select = vi.fn().mockReturnValue({ lean });
    vi.spyOn(Sale, 'find').mockReturnValue({ select } as never);

    await expect(
      listOccupiedSerialNumbers({
        serials: 's000031,S000032',
        excludeSaleId: 'not-an-id',
      }),
    ).resolves.toEqual({ occupied: ['S000031'] });

    expect(Sale.find).toHaveBeenCalledWith({
      lineItems: {
        $elemMatch: {
          kind: 'product',
          serialNumbers: { $in: ['S000031', 'S000032'] },
        },
      },
    });
  });

  it('passes a valid excludeSaleId through to the occupancy query', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const select = vi.fn().mockReturnValue({ lean });
    vi.spyOn(Sale, 'find').mockReturnValue({ select } as never);
    const excludeSaleId = '507f1f77bcf86cd799439011';

    await expect(
      listOccupiedSerialNumbers({
        serials: ['S000031'],
        excludeSaleId,
      }),
    ).resolves.toEqual({ occupied: [] });

    expect(Sale.find).toHaveBeenCalledWith({
      lineItems: {
        $elemMatch: {
          kind: 'product',
          serialNumbers: { $in: ['S000031'] },
        },
      },
      _id: { $ne: excludeSaleId },
    });
  });
});
