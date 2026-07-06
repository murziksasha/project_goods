import type { receiptStatuses } from './model';

export type ItemReceiptStatus = (typeof receiptStatuses)[number];

export type SupplierOrderItemLike = {
  receiptStatus?: ItemReceiptStatus | string;
};

export type ResolvedSupplierOrderStatus = {
  status:
    | 'partially_stocked'
    | 'partially_completed'
    | 'stocked'
    | 'cancelled'
    | null;
  receiptStatus: 'new' | 'approved' | 'received';
};

const toItemReceiptStatus = (value: unknown): ItemReceiptStatus => {
  const normalized = String(value ?? 'new');
  if (
    normalized === 'new' ||
    normalized === 'approved' ||
    normalized === 'received' ||
    normalized === 'cancelled'
  ) {
    return normalized;
  }
  return 'new';
};

const isPendingItemStatus = (status: ItemReceiptStatus) =>
  status === 'new' || status === 'approved';

export const areAllSupplierOrderItemsReceived = (
  items: SupplierOrderItemLike[] = [],
) =>
  items.length > 0 &&
  items.every((item) => toItemReceiptStatus(item.receiptStatus) === 'received');

export const resolveSupplierOrderStatusFromItems = (
  items: SupplierOrderItemLike[] = [],
): ResolvedSupplierOrderStatus => {
  if (items.length === 0) {
    return { status: null, receiptStatus: 'new' };
  }

  const statuses = items.map((item) => toItemReceiptStatus(item.receiptStatus));
  const allReceived = statuses.every((status) => status === 'received');
  const allCancelled = statuses.every((status) => status === 'cancelled');
  const allTerminal = statuses.every(
    (status) => status === 'received' || status === 'cancelled',
  );
  const anyReceived = statuses.some((status) => status === 'received');
  const anyCancelled = statuses.some((status) => status === 'cancelled');
  const anyPending = statuses.some(isPendingItemStatus);

  if (allReceived) {
    return { status: 'stocked', receiptStatus: 'received' };
  }

  if (allCancelled) {
    return { status: 'cancelled', receiptStatus: 'approved' };
  }

  if (allTerminal && anyReceived && anyCancelled) {
    return { status: 'partially_completed', receiptStatus: 'approved' };
  }

  if ((anyReceived || anyCancelled) && anyPending) {
    return { status: 'partially_stocked', receiptStatus: 'approved' };
  }

  return { status: null, receiptStatus: 'approved' };
};