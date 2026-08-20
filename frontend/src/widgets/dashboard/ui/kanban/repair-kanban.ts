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

const visibleStatusSet = new Set<RepairStatus>(kanbanVisibleRepairStatuses);

export const columnDropId = (status: RepairStatus) => `column:${status}`;

export const parseColumnDropId = (id: string): RepairStatus | null => {
  if (!id.startsWith('column:')) return null;
  const status = id.slice('column:'.length) as RepairStatus;
  return visibleStatusSet.has(status) ? status : null;
};

export const resolveKanbanDropStatus = (
  overId: string | null | undefined,
  saleById: ReadonlyMap<string, Sale>,
  pending?: KanbanPendingMove | null,
): RepairStatus | null => {
  if (!overId) return null;

  const fromColumn = parseColumnDropId(overId);
  if (fromColumn) return fromColumn;

  if (pending && pending.saleId === overId) {
    return pending.status;
  }

  const overSale = saleById.get(overId);
  if (!overSale) return null;

  const status = normalizeOrderStatus(overSale.status) as RepairStatus;
  return visibleStatusSet.has(status) ? status : null;
};

export const isKanbanVisibleSale = (sale: Pick<Sale, 'status'>) =>
  visibleStatusSet.has(normalizeOrderStatus(sale.status) as RepairStatus);

export const saleMatchesKanbanMasterFilter = (
  sale: Pick<Sale, 'master'>,
  masterId: string,
) => !masterId || sale.master?.id === masterId;

export const countKanbanVisibleSales = (
  sales: readonly Pick<Sale, 'status'>[],
) => sales.reduce((count, sale) => count + (isKanbanVisibleSale(sale) ? 1 : 0), 0);

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

export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCenter(args);
};
