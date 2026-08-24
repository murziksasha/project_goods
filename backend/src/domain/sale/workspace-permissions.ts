import type { SalePayload } from '../shared/types';
import { normalizeSalePayload } from '../../shared/lib/parsers';

export const getSaleFavoritePermission = (kind: unknown) =>
  kind === 'sale' ? 'sales.manage' : 'orders.manage';

export const getSaleManagePermission = (kind: unknown) =>
  kind === 'sale' ? 'sales.manage' : 'orders.manage';

type WorkspaceComparableSale = {
  kind?: string;
  status?: string;
  paidAmount?: number;
  master?: { toString: () => string } | string | null;
  issuedBy?: { toString: () => string } | string | null;
  productSnapshot?: {
    name?: string;
    serialNumber?: string | null;
  } | null;
  discount?: unknown;
  paymentHistory?: unknown[];
  lineItems?: unknown[];
  timeline?: unknown[];
  userNote?: string | null;
};

const asComparableId = (value: unknown) => {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.toString === 'function') {
    const text = value.toString();
    return text && text !== '[object Object]' ? text : '';
  }
  return '';
};

const withComparableLineItemIds = (items: unknown) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const row = item as Record<string, unknown>;
    return {
      ...row,
      productId: asComparableId(row.productId),
      catalogProductId: asComparableId(row.catalogProductId),
      serviceId: asComparableId(row.serviceId),
    };
  });
};

const toComparableWorkspaceState = (
  sale: WorkspaceComparableSale,
  payloadInput: SalePayload,
) => {
  const payload = normalizeSalePayload({
    ...payloadInput,
    lineItems: withComparableLineItemIds(payloadInput.lineItems),
  });
  const currentNormalized = normalizeSalePayload({
    kind: sale.kind,
    status: sale.status,
    paidAmount: sale.paidAmount,
    discount: sale.discount,
    deviceName: sale.productSnapshot?.name,
    serialNumber: sale.productSnapshot?.serialNumber,
    paymentHistory: sale.paymentHistory,
    lineItems: withComparableLineItemIds(sale.lineItems),
    timeline: sale.timeline,
  });
  const current = {
    kind: sale.kind === 'sale' ? 'sale' : 'repair',
    status: String(sale.status ?? ''),
    paidAmount: sale.paidAmount ?? 0,
    masterId: sale.master ? String(sale.master) : '',
    issuedById: sale.issuedBy ? String(sale.issuedBy) : '',
    deviceName: currentNormalized.deviceName,
    serialNumber: currentNormalized.serialNumber,
    discount: currentNormalized.discount,
    paymentHistory: currentNormalized.paymentHistory,
    lineItems: currentNormalized.lineItems,
    timeline: sale.timeline ?? [],
  };

  return {
    current,
    next: {
      kind: payloadInput.kind === undefined ? current.kind : payload.kind,
      status: payloadInput.status === undefined ? current.status : payload.status,
      paidAmount:
        payloadInput.paidAmount === undefined ? current.paidAmount : payload.paidAmount,
      masterId:
        payloadInput.masterId === undefined ? current.masterId : payload.masterId,
      issuedById:
        payloadInput.issuedById === undefined ? current.issuedById : payload.issuedById,
      deviceName:
        payloadInput.deviceName === undefined ? current.deviceName : payload.deviceName,
      serialNumber:
        payloadInput.serialNumber === undefined
          ? current.serialNumber
          : payload.serialNumber,
      discount:
        payloadInput.discount === undefined ? current.discount : payload.discount,
      paymentHistory:
        payloadInput.paymentHistory === undefined
          ? current.paymentHistory
          : payload.paymentHistory,
      lineItems:
        payloadInput.lineItems === undefined ? current.lineItems : payload.lineItems,
      timeline: payload.timeline,
    },
  };
};

/** True when PATCH workspace only appends live-feed timeline (orders.chat). */
export const isManualCommentWorkspacePatch = (
  sale: WorkspaceComparableSale,
  payloadInput: SalePayload,
) => {
  const { current, next } = toComparableWorkspaceState(sale, payloadInput);
  if (JSON.stringify(current.timeline) === JSON.stringify(next.timeline)) {
    return false;
  }

  return (
    current.kind === next.kind &&
    current.status === next.status &&
    current.paidAmount === next.paidAmount &&
    current.masterId === next.masterId &&
    current.issuedById === next.issuedById &&
    current.deviceName === next.deviceName &&
    current.serialNumber === next.serialNumber &&
    JSON.stringify(current.discount) === JSON.stringify(next.discount) &&
    JSON.stringify(current.paymentHistory) ===
      JSON.stringify(next.paymentHistory) &&
    JSON.stringify(current.lineItems) === JSON.stringify(next.lineItems)
  );
};

/** True when PATCH only moves a repair card or assigns a master (kanban.use). */
export const isKanbanBoardWorkspacePatch = (
  sale: WorkspaceComparableSale,
  payloadInput: SalePayload,
) => {
  const { current, next } = toComparableWorkspaceState(sale, payloadInput);
  if (current.kind === 'sale' || next.kind === 'sale') {
    return false;
  }

  const statusChanged = current.status !== next.status;
  const masterChanged = current.masterId !== next.masterId;
  if (!statusChanged && !masterChanged) {
    return false;
  }

  const currentUserNote = String(sale.userNote ?? '');
  const nextUserNote =
    payloadInput.userNote === undefined
      ? currentUserNote
      : String(payloadInput.userNote ?? '');
  if (nextUserNote !== currentUserNote) {
    return false;
  }

  return (
    current.kind === next.kind &&
    current.paidAmount === next.paidAmount &&
    current.deviceName === next.deviceName &&
    current.serialNumber === next.serialNumber &&
    JSON.stringify(current.discount) === JSON.stringify(next.discount) &&
    JSON.stringify(current.paymentHistory) ===
      JSON.stringify(next.paymentHistory) &&
    JSON.stringify(current.lineItems) === JSON.stringify(next.lineItems)
  );
};
