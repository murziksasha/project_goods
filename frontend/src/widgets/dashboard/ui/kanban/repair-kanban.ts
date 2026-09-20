import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core';
import type { Sale } from '../../../../entities/sale/model/types';
import {
  kanbanVisibleRepairStatuses,
  normalizeOrderStatus,
  type RepairStatus,
} from '../orders/workspace/orders-workspace-shared';

export type KanbanPendingMove = {
  saleId: string;
  status: RepairStatus;
};

const visibleStatusSet = new Set<RepairStatus>(
  kanbanVisibleRepairStatuses,
);

export const columnDropId = (status: RepairStatus) =>
  `column:${status}`;
export const railDropId = (status: RepairStatus) => `rail:${status}`;

export const parseColumnDropId = (
  id: string,
): RepairStatus | null => {
  if (!id.startsWith('column:')) return null;
  const status = id.slice('column:'.length) as RepairStatus;
  return visibleStatusSet.has(status) ? status : null;
};

export const parseRailDropId = (id: string): RepairStatus | null => {
  if (!id.startsWith('rail:')) return null;
  const status = id.slice('rail:'.length) as RepairStatus;
  return visibleStatusSet.has(status) ? status : null;
};

export const resolveKanbanDropStatus = (
  overId: string | null | undefined,
  saleById: ReadonlyMap<string, Sale>,
  pending?: KanbanPendingMove | null,
): RepairStatus | null => {
  if (!overId) return null;

  const fromRail = parseRailDropId(overId);
  if (fromRail) return fromRail;

  const fromColumn = parseColumnDropId(overId);
  if (fromColumn) return fromColumn;

  if (pending && pending.saleId === overId) {
    return pending.status;
  }

  const overSale = saleById.get(overId);
  if (!overSale) return null;

  const status = normalizeOrderStatus(
    overSale.status,
  ) as RepairStatus;
  return visibleStatusSet.has(status) ? status : null;
};

export const isKanbanVisibleSale = (sale: Pick<Sale, 'status'>) =>
  visibleStatusSet.has(
    normalizeOrderStatus(sale.status) as RepairStatus,
  );

export const saleMatchesKanbanMasterFilter = (
  sale: Pick<Sale, 'master'>,
  masterId: string,
) => !masterId || sale.master?.id === masterId;

export const countKanbanVisibleSales = (
  sales: readonly Pick<Sale, 'status'>[],
) =>
  sales.reduce(
    (count, sale) => count + (isKanbanVisibleSale(sale) ? 1 : 0),
    0,
  );

export const groupRepairSalesByKanbanStatus = (
  sales: readonly Sale[],
  pending?: KanbanPendingMove | null,
): Map<RepairStatus, Sale[]> => {
  const byStatus = new Map<RepairStatus, Sale[]>();
  for (const status of kanbanVisibleRepairStatuses) {
    byStatus.set(status, []);
  }

  for (const sale of sales) {
    const status =
      pending && pending.saleId === sale.id
        ? pending.status
        : (normalizeOrderStatus(sale.status) as RepairStatus);
    const bucket = byStatus.get(status);
    if (bucket) bucket.push(sale);
  }

  for (const bucket of byStatus.values()) {
    bucket.sort((a, b) => kanbanSortKey(a) - kanbanSortKey(b));
  }

  return byStatus;
};

export const shouldKeepKanbanPendingMove = (
  sales: readonly Sale[],
  pending: KanbanPendingMove | null | undefined,
) => {
  if (!pending) return false;
  const sale = sales.find((item) => item.id === pending.saleId);
  if (!sale) return false;
  return normalizeOrderStatus(sale.status) !== pending.status;
};

export const kanbanCollisionDetection: CollisionDetection = (
  args,
) => {
  const pointerHits = pointerWithin(args);
  const railHits = pointerHits.filter((hit) =>
    String(hit.id).startsWith('rail:'),
  );
  if (railHits.length > 0) return railHits;

  // Cards take precedence over column background droppables
  const cardHits = pointerHits.filter(
    (hit) =>
      !String(hit.id).startsWith('column:') &&
      !String(hit.id).startsWith('rail:'),
  );
  if (cardHits.length > 0) return cardHits;

  if (pointerHits.length > 0) return pointerHits;
  return closestCenter(args);
};

export const kanbanCollapsedStorageKey =
  'project-goods.kanban-collapsed-columns';

export const parseCollapsedKanbanColumns = (
  value: string | null,
): RepairStatus[] => {
  try {
    const parsed = JSON.parse(value ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RepairStatus =>
        typeof item === 'string' &&
        visibleStatusSet.has(item as RepairStatus),
    );
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Card ranking helpers
// ---------------------------------------------------------------------------

const RANK_GAP = 1000;

/** Effective sort key for a kanban card.
 *  Explicit rank wins; falls back to oldest-first by saleDate (newest at the end). */
export const kanbanSortKey = (sale: Sale): number =>
  sale.kanbanRank ?? new Date(sale.saleDate).getTime();

/**
 * Compute the minimal rank changes needed after an Up/Down button press.
 * Returns a Map of saleId → newRank (only changed cards).
 */
export const computeColumnRankAfterMove = (
  columnSales: readonly Sale[],
  movedId: string,
  direction: 'up' | 'down',
): Map<string, number> => {
  const sorted = [...columnSales].sort(
    (a, b) => kanbanSortKey(a) - kanbanSortKey(b),
  );
  const idx = sorted.findIndex((s) => s.id === movedId);
  if (idx < 0) return new Map();
  if (direction === 'up' && idx === 0) return new Map();
  if (direction === 'down' && idx === sorted.length - 1)
    return new Map();

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  const current = sorted[idx];
  const neighbour = sorted[swapIdx];

  const hasCleanRanks = sorted.every(
    (s) => typeof s.kanbanRank === 'number' && s.kanbanRank > 0,
  );

  if (!hasCleanRanks || current.kanbanRank === neighbour.kanbanRank) {
    const reordered = [...sorted];
    reordered[idx] = neighbour;
    reordered[swapIdx] = current;
    const result = new Map<string, number>();
    reordered.forEach((s, i) => {
      const newRank = (i + 1) * RANK_GAP;
      if (s.kanbanRank !== newRank) {
        result.set(s.id, newRank);
      }
    });
    return result;
  }

  return new Map([
    [movedId, neighbour.kanbanRank!],
    [neighbour.id, current.kanbanRank!],
  ]);
};

/**
 * Compute rank changes after a drag-reorder within the same column.
 * Inserts `movedId` before or after `targetId` (or at the end when targetId is null).
 * Returns a Map of saleId → newRank for all cards that changed.
 */
export const computeColumnRankAfterDrop = (
  columnSales: readonly Sale[],
  movedId: string,
  targetId: string | null,
  position: 'before' | 'after' = 'before',
): Map<string, number> => {
  const sorted = [...columnSales].sort(
    (a, b) => kanbanSortKey(a) - kanbanSortKey(b),
  );

  // Build the new order: remove movedId, insert before or after targetId
  const without = sorted.filter((s) => s.id !== movedId);
  let insertAt: number;
  if (targetId === null) {
    insertAt = without.length;
  } else {
    const targetIdx = without.findIndex((s) => s.id === targetId);
    if (targetIdx < 0) {
      insertAt = without.length;
    } else {
      insertAt = position === 'after' ? targetIdx + 1 : targetIdx;
    }
  }

  const newOrder = [...without];
  const moved = sorted.find((s) => s.id === movedId);
  if (!moved) return new Map();
  newOrder.splice(insertAt, 0, moved);

  // Assign ranks with gaps
  const result = new Map<string, number>();
  newOrder.forEach((s, i) => {
    const newRank = (i + 1) * RANK_GAP;
    // Only include changed entries
    if (kanbanSortKey(s) !== newRank) {
      result.set(s.id, newRank);
    }
  });
  return result;
};
