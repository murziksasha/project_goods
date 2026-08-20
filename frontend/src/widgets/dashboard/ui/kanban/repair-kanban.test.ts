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
