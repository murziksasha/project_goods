import { describe, expect, it } from 'vitest';
import {
  finalRepairStatuses,
  handoffRepairStatuses,
  kanbanCollapsedRepairStatuses,
  kanbanHiddenRepairStatuses,
  kanbanVisibleRepairStatuses,
  normalizeOrderStatus,
  repairStatuses,
  shouldCaptureReceivedBy,
  stockLockedRepairStatuses,
} from '../orders/workspace/orders-workspace-shared';
import type { Sale } from '../../../../entities/sale';
import {
  computeColumnRankAfterDrop,
  computeColumnRankAfterMove,
  countKanbanVisibleSales,
  groupRepairSalesByKanbanStatus,
  isKanbanVisibleSale,
  kanbanCollisionDetection,
  kanbanSortKey,
  parseCollapsedKanbanColumns,
  parseColumnDropId,
  parseRailDropId,
  railDropId,
  resolveKanbanDropStatus,
  saleMatchesKanbanMasterFilter,
  shouldKeepKanbanPendingMove,
} from './repair-kanban';

const repairSale = { kind: 'repair' } as Sale;

describe('repair kanban status model', () => {
  it('includes notPickedUp in repairStatuses and finalRepairStatuses', () => {
    expect(
      repairStatuses.some((item) => item.key === 'notPickedUp'),
    ).toBe(true);
    expect(finalRepairStatuses).toContain('notPickedUp');
  });

  it('keeps notPickedUp unlocked for stock and out of handoff', () => {
    expect(stockLockedRepairStatuses.has('notPickedUp')).toBe(false);
    expect(handoffRepairStatuses).not.toContain('notPickedUp');
    expect(shouldCaptureReceivedBy(repairSale, 'notPickedUp')).toBe(
      false,
    );
    expect(shouldCaptureReceivedBy(repairSale, 'issued')).toBe(true);
  });

  it('normalizes notPickedUp aliases', () => {
    expect(normalizeOrderStatus('notPickedUp')).toBe('notPickedUp');
    expect(normalizeOrderStatus('not_picked_up')).toBe('notPickedUp');
    expect(normalizeOrderStatus('Not picked up')).toBe('notPickedUp');
  });

  it('defines visible, hidden, and collapsed kanban columns', () => {
    expect(kanbanVisibleRepairStatuses).toEqual([
      'new',
      'diagnostics',
      'waitingParts',
      'clientApproved',
      'inRepair',
      'refinement',
      'ready',
      'paid',
      'away',
    ]);
    expect(kanbanHiddenRepairStatuses).toEqual([
      'issued',
      'issuedWithoutRepair',
      'clientRejected',
      'notPickedUp',
    ]);
    expect(kanbanCollapsedRepairStatuses).toEqual([]);
  });
});

describe('repair kanban visibility', () => {
  const sale = (id: string, status: string) =>
    ({ id, status }) as Sale;

  it('counts only sales that belong to visible columns', () => {
    expect(isKanbanVisibleSale(sale('a', 'new'))).toBe(true);
    expect(isKanbanVisibleSale(sale('b', 'issued'))).toBe(false);
    expect(isKanbanVisibleSale(sale('c', 'notPickedUp'))).toBe(false);
    expect(isKanbanVisibleSale(sale('g', 'away'))).toBe(true);
    expect(
      countKanbanVisibleSales([
        sale('a', 'new'),
        sale('b', 'issued'),
        sale('c', 'inRepair'),
        sale('d', 'notPickedUp'),
        sale('e', 'paid'),
        sale('f', 'clientRejected'),
        sale('g', 'away'),
      ]),
    ).toBe(4);
  });

  it('matches kanban master filter by assigned master only', () => {
    const withMaster = {
      master: { id: 'master-1', name: 'Kostiantyn', role: 'master' },
    } as Sale;
    const createdByManager = {
      master: null,
      manager: { id: 'manager-1', name: 'Olexandr', role: 'manager' },
    } as Sale;

    expect(saleMatchesKanbanMasterFilter(withMaster, '')).toBe(true);
    expect(
      saleMatchesKanbanMasterFilter(withMaster, 'master-1'),
    ).toBe(true);
    expect(
      saleMatchesKanbanMasterFilter(withMaster, 'manager-1'),
    ).toBe(false);
    expect(
      saleMatchesKanbanMasterFilter(createdByManager, 'manager-1'),
    ).toBe(false);
  });
});

describe('repair kanban drop helpers', () => {
  const sale = (id: string, status: string) =>
    ({ id, status }) as Sale;

  it('parses visible column drop ids and rejects junk', () => {
    expect(parseColumnDropId('column:ready')).toBe('ready');
    expect(parseColumnDropId('column:away')).toBe('away');
    expect(parseColumnDropId('column:notPickedUp')).toBeNull();
    expect(parseColumnDropId('ready')).toBeNull();
    expect(parseRailDropId(railDropId('paid'))).toBe('paid');
    expect(parseRailDropId('column:paid')).toBeNull();
    expect(
      parseCollapsedKanbanColumns('["new","ready","issued"]'),
    ).toEqual(['new', 'ready']);
  });

  it('resolves drop status from a column id or another sale', () => {
    const saleById = new Map([
      ['a', sale('a', 'new')],
      ['b', sale('b', 'inRepair')],
    ]);

    expect(resolveKanbanDropStatus('rail:ready', saleById)).toBe(
      'ready',
    );
    expect(
      resolveKanbanDropStatus('column:diagnostics', saleById),
    ).toBe('diagnostics');
    expect(resolveKanbanDropStatus('b', saleById)).toBe('inRepair');
    expect(resolveKanbanDropStatus('missing', saleById)).toBeNull();
    expect(
      resolveKanbanDropStatus('a', saleById, {
        saleId: 'a',
        status: 'ready',
      }),
    ).toBe('ready');
  });

  it('moves a pending sale into the target column', () => {
    const columns = groupRepairSalesByKanbanStatus(
      [sale('a', 'new'), sale('b', 'new')],
      { saleId: 'a', status: 'inRepair' },
    );

    expect(columns.get('new')?.map((item) => item.id)).toEqual(['b']);
    expect(columns.get('inRepair')?.map((item) => item.id)).toEqual([
      'a',
    ]);
  });

  it('drops pending once sales already have the new status', () => {
    const sales = [sale('a', 'inRepair')];
    expect(
      shouldKeepKanbanPendingMove(sales, {
        saleId: 'a',
        status: 'inRepair',
      }),
    ).toBe(false);
    expect(
      shouldKeepKanbanPendingMove(sales, {
        saleId: 'a',
        status: 'ready',
      }),
    ).toBe(true);
  });
});

describe('kanban rank helpers', () => {
  const rankSale = (
    id: string,
    saleDate: string,
    kanbanRank?: number,
  ) => ({ id, status: 'new', saleDate, kanbanRank }) as Sale;

  it('kanbanSortKey falls back to saleDate.getTime() (oldest-first) when rank is absent', () => {
    const s = rankSale('a', '2026-09-01T00:00:00.000Z');
    expect(kanbanSortKey(s)).toBe(
      new Date('2026-09-01T00:00:00.000Z').getTime(),
    );
  });

  it('kanbanSortKey prefers explicit rank over date', () => {
    const s = rankSale('a', '2026-09-01T00:00:00.000Z', 500);
    expect(kanbanSortKey(s)).toBe(500);
  });

  describe('computeColumnRankAfterMove', () => {
    it('moves card up by swapping ranks with the previous card', () => {
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 1000);
      const s2 = rankSale('b', '2026-01-02T00:00:00.000Z', 2000);
      const updates = computeColumnRankAfterMove([s1, s2], 'b', 'up');
      expect(updates.get('b')).toBe(1000);
      expect(updates.get('a')).toBe(2000);
    });

    it('moves card down by swapping ranks with the next card', () => {
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 1000);
      const s2 = rankSale('b', '2026-01-02T00:00:00.000Z', 2000);
      const updates = computeColumnRankAfterMove(
        [s1, s2],
        'a',
        'down',
      );
      expect(updates.get('a')).toBe(2000);
      expect(updates.get('b')).toBe(1000);
    });

    it('returns empty map when card is already first and direction is up', () => {
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 1000);
      const s2 = rankSale('b', '2026-01-02T00:00:00.000Z', 2000);
      const updates = computeColumnRankAfterMove([s1, s2], 'a', 'up');
      expect(updates.size).toBe(0);
    });

    it('returns empty map when card is already last and direction is down', () => {
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 1000);
      const s2 = rankSale('b', '2026-01-02T00:00:00.000Z', 2000);
      const updates = computeColumnRankAfterMove(
        [s1, s2],
        'b',
        'down',
      );
      expect(updates.size).toBe(0);
    });

    it('returns empty map for unknown saleId', () => {
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 1000);
      const updates = computeColumnRankAfterMove(
        [s1],
        'missing',
        'up',
      );
      expect(updates.size).toBe(0);
    });
  });

  describe('computeColumnRankAfterDrop', () => {
    it('inserts moved card before target card', () => {
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 1000);
      const s2 = rankSale('b', '2026-01-02T00:00:00.000Z', 2000);
      const s3 = rankSale('c', '2026-01-03T00:00:00.000Z', 3000);
      // Move c before a → new order: c, a, b
      const updates = computeColumnRankAfterDrop(
        [s1, s2, s3],
        'c',
        'a',
      );
      const ranked = [...updates.entries()].sort(
        (x, y) => x[1] - y[1],
      );
      expect(ranked[0][0]).toBe('c');
      expect(ranked[1][0]).toBe('a');
    });

    it('appends card to end when targetId is null', () => {
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 1000);
      const s2 = rankSale('b', '2026-01-02T00:00:00.000Z', 2000);
      // Move a to end → order: b, a
      const updates = computeColumnRankAfterDrop([s1, s2], 'a', null);
      const aRank = updates.get('a');
      const bRank = updates.get('b') ?? kanbanSortKey(s2);
      expect(aRank).toBeDefined();
      expect(aRank!).toBeGreaterThan(bRank);
    });

    it('inserts moved card after target card when position is after', () => {
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 1000);
      const s2 = rankSale('b', '2026-01-02T00:00:00.000Z', 2000);
      const s3 = rankSale('c', '2026-01-03T00:00:00.000Z', 3000);
      // Move a after b → new order: b, a, c
      const updates = computeColumnRankAfterDrop(
        [s1, s2, s3],
        'a',
        'b',
        'after',
      );
      const ranked = [...updates.entries()].sort(
        (x, y) => x[1] - y[1],
      );
      expect(ranked[0][0]).toBe('b');
      expect(ranked[1][0]).toBe('a');
      expect(updates.has('c')).toBe(false);
    });

    it('returns empty map when drop is a no-op', () => {
      // Only one card — moving it to itself is a no-op
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 1000);
      const updates = computeColumnRankAfterDrop([s1], 'a', null);
      expect(updates.size).toBe(0);
    });
  });

  describe('kanbanCollisionDetection', () => {
    it('prioritizes card droppables over column droppables', () => {
      const droppableContainers = [
        {
          id: 'column:diagnostics',
          rect: {
            current: { top: 0, bottom: 500, left: 0, right: 300 },
          },
        },
        {
          id: 'sale-1',
          rect: {
            current: { top: 10, bottom: 100, left: 10, right: 290 },
          },
        },
      ];
      const collisionArgs = {
        active: {
          id: 'sale-2',
          data: { current: {} },
          rect: { current: { initial: null, translated: null } },
        },
        collisionRect: {
          top: 20,
          bottom: 80,
          left: 20,
          right: 280,
          width: 260,
          height: 60,
        },
        droppableRects: new Map([
          [
            'column:diagnostics',
            {
              top: 0,
              bottom: 500,
              left: 0,
              right: 300,
              width: 300,
              height: 500,
            },
          ],
          [
            'sale-1',
            {
              top: 10,
              bottom: 100,
              left: 10,
              right: 290,
              width: 280,
              height: 90,
            },
          ],
        ]),
        droppableContainers: droppableContainers as any,
        pointerCoordinates: { x: 50, y: 50 },
      };

      const collisions = kanbanCollisionDetection(
        collisionArgs as any,
      );
      expect(collisions.length).toBeGreaterThan(0);
      expect(collisions[0].id).toBe('sale-1');
    });
  });

  describe('groupRepairSalesByKanbanStatus sorting', () => {
    it('sorts sales within each column by kanbanSortKey', () => {
      const s1 = rankSale('a', '2026-01-01T00:00:00.000Z', 3000);
      const s2 = rankSale('b', '2026-01-02T00:00:00.000Z', 1000);
      const s3 = rankSale('c', '2026-01-03T00:00:00.000Z', 2000);

      const columns = groupRepairSalesByKanbanStatus([s1, s2, s3]);
      const newColumn = columns.get('new') ?? [];
      expect(newColumn.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    });
  });
});
