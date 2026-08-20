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
import type { Sale } from '../../../../entities/sale/model/types';
import {
  countKanbanVisibleSales,
  groupRepairSalesByKanbanStatus,
  isKanbanVisibleSale,
  parseColumnDropId,
  resolveKanbanDropStatus,
  saleMatchesKanbanMasterFilter,
  shouldKeepKanbanPendingMove,
} from './repair-kanban';

const repairSale = { kind: 'repair' } as Sale;

describe('repair kanban status model', () => {
  it('includes notPickedUp in repairStatuses and finalRepairStatuses', () => {
    expect(repairStatuses.some((item) => item.key === 'notPickedUp')).toBe(
      true,
    );
    expect(finalRepairStatuses).toContain('notPickedUp');
  });

  it('keeps notPickedUp unlocked for stock and out of handoff', () => {
    expect(stockLockedRepairStatuses.has('notPickedUp')).toBe(false);
    expect(handoffRepairStatuses).not.toContain('notPickedUp');
    expect(shouldCaptureReceivedBy(repairSale, 'notPickedUp')).toBe(false);
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
  const sale = (id: string, status: string) => ({ id, status }) as Sale;

  it('counts only sales that belong to visible columns', () => {
    expect(isKanbanVisibleSale(sale('a', 'new'))).toBe(true);
    expect(isKanbanVisibleSale(sale('b', 'issued'))).toBe(false);
    expect(isKanbanVisibleSale(sale('c', 'notPickedUp'))).toBe(false);
    expect(
      countKanbanVisibleSales([
        sale('a', 'new'),
        sale('b', 'issued'),
        sale('c', 'inRepair'),
        sale('d', 'notPickedUp'),
        sale('e', 'paid'),
        sale('f', 'clientRejected'),
      ]),
    ).toBe(3);
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
    expect(saleMatchesKanbanMasterFilter(withMaster, 'master-1')).toBe(true);
    expect(saleMatchesKanbanMasterFilter(withMaster, 'manager-1')).toBe(false);
    expect(saleMatchesKanbanMasterFilter(createdByManager, 'manager-1')).toBe(
      false,
    );
  });
});

describe('repair kanban drop helpers', () => {
  const sale = (id: string, status: string) => ({ id, status }) as Sale;

  it('parses visible column drop ids and rejects junk', () => {
    expect(parseColumnDropId('column:ready')).toBe('ready');
    expect(parseColumnDropId('column:notPickedUp')).toBeNull();
    expect(parseColumnDropId('ready')).toBeNull();
  });

  it('resolves drop status from a column id or another sale', () => {
    const saleById = new Map([
      ['a', sale('a', 'new')],
      ['b', sale('b', 'inRepair')],
    ]);

    expect(resolveKanbanDropStatus('column:diagnostics', saleById)).toBe(
      'diagnostics',
    );
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
    expect(columns.get('inRepair')?.map((item) => item.id)).toEqual(['a']);
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

