import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sale } from './model';
import { listSales } from './list';

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
});
