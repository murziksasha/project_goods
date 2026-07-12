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
};

const toComparableWorkspaceState = (
  sale: WorkspaceComparableSale,
  payloadInput: SalePayload,
) => {
  const payload = normalizeSalePayload(payloadInput);
  const current = {
    kind: sale.kind === 'sale' ? 'sale' : 'repair',
    status: String(sale.status ?? ''),
    paidAmount: sale.paidAmount ?? 0,
    masterId: sale.master ? String(sale.master) : '',
    issuedById: sale.issuedBy ? String(sale.issuedBy) : '',
    deviceName: sale.productSnapshot?.name ?? '',
    serialNumber: sale.productSnapshot?.serialNumber ?? '',
    discount: sale.discount ?? { mode: 'amount', value: 0 },
    paymentHistory: sale.paymentHistory ?? [],
    lineItems: sale.lineItems ?? [],
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
