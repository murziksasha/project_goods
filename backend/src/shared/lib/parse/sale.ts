import type { SalePayload } from '../../../domain/shared/types';
import { toNonEmptyString, toNumber, toOptionalDate } from './primitives';

export const normalizeSalePayload = (payload: SalePayload) => ({
  saleDate: toOptionalDate(payload.saleDate) ?? new Date(),
  clientId: toNonEmptyString(payload.clientId),
  productId: toNonEmptyString(payload.productId),
  quantity: toNumber(payload.quantity),
  salePrice: toNumber(payload.salePrice),
  note: toNonEmptyString(payload.note),
  userNote: toNonEmptyString(payload.userNote),
  managerId: toNonEmptyString(payload.managerId),
  masterId: toNonEmptyString(payload.masterId),
  issuedById: toNonEmptyString(payload.issuedById),
  kind: toNonEmptyString(payload.kind) === 'sale' ? 'sale' : 'repair',
  status: toNonEmptyString(payload.status) || 'new',
  paidAmount:
    payload.paidAmount === undefined ? 0 : toNumber(payload.paidAmount),
  timeline: Array.isArray(payload.timeline)
    ? payload.timeline
        .map((entry) => ({
          id: toNonEmptyString((entry as { id?: unknown })?.id),
          kind:
            toNonEmptyString((entry as { kind?: unknown })?.kind) === 'manual'
              ? 'manual'
              : toNonEmptyString((entry as { kind?: unknown })?.kind) === 'system'
                ? 'system'
                : undefined,
          author: toNonEmptyString((entry as { author?: unknown })?.author),
          message: toNonEmptyString((entry as { message?: unknown })?.message),
          createdAt:
            toOptionalDate((entry as { createdAt?: unknown })?.createdAt) ?? new Date(),
        }))
        .filter((entry) => entry.id && entry.author && entry.message)
    : [],
  paymentHistory: Array.isArray(payload.paymentHistory)
    ? payload.paymentHistory
        .map((entry) => ({
          id: toNonEmptyString((entry as { id?: unknown })?.id),
          type: toNonEmptyString((entry as { type?: unknown })?.type),
          paymentMethod:
            toNonEmptyString((entry as { paymentMethod?: unknown })?.paymentMethod) === 'non-cash'
              ? 'non-cash'
              : 'cash',
          amount: toNumber((entry as { amount?: unknown })?.amount),
          cashboxId: toNonEmptyString((entry as { cashboxId?: unknown })?.cashboxId),
          cashboxName: toNonEmptyString((entry as { cashboxName?: unknown })?.cashboxName),
          author: toNonEmptyString((entry as { author?: unknown })?.author),
          createdAt:
            toOptionalDate((entry as { createdAt?: unknown })?.createdAt) ?? new Date(),
        }))
        .filter(
          (entry) =>
            entry.id &&
            (entry.type === 'deposit' || entry.type === 'refund') &&
            (entry.paymentMethod === 'cash' || entry.paymentMethod === 'non-cash') &&
            Number.isFinite(entry.amount) &&
            entry.amount >= 0 &&
            entry.cashboxId &&
            entry.cashboxName &&
            entry.author,
        )
    : [],
  lineItems: Array.isArray(payload.lineItems)
    ? payload.lineItems
        .map((item) => ({
          id: toNonEmptyString((item as { id?: unknown })?.id),
          kind: toNonEmptyString((item as { kind?: unknown })?.kind),
          productId:
            toNonEmptyString((item as { productId?: unknown })?.productId) ||
            undefined,
          catalogProductId:
            toNonEmptyString(
              (item as { catalogProductId?: unknown })?.catalogProductId,
            ) || undefined,
          serviceId:
            toNonEmptyString((item as { serviceId?: unknown })?.serviceId) ||
            undefined,
          name: toNonEmptyString((item as { name?: unknown })?.name),
          price: toNumber((item as { price?: unknown })?.price),
          quantity: toNumber((item as { quantity?: unknown })?.quantity),
          warrantyPeriod:
            (item as { warrantyPeriod?: unknown })?.warrantyPeriod === undefined
              ? 0
              : toNumber((item as { warrantyPeriod?: unknown })?.warrantyPeriod),
          serialNumbers: Array.isArray(
            (item as { serialNumbers?: unknown })?.serialNumbers,
          )
            ? Array.from(
                new Set(
                  ((item as { serialNumbers?: unknown[] }).serialNumbers ?? [])
                    .map((value) => toNonEmptyString(value).toUpperCase())
                    .filter(Boolean),
                ),
              )
            : [],
        }))
        .filter(
          (item) =>
            item.id &&
            (item.kind === 'product' || item.kind === 'service') &&
            item.name &&
            Number.isFinite(item.price) &&
            item.price >= 0 &&
            Number.isFinite(item.quantity) &&
            item.quantity > 0 &&
            Number.isFinite(item.warrantyPeriod) &&
            item.warrantyPeriod >= 0,
        )
    : [],
  discount: (() => {
    if (!payload.discount || typeof payload.discount !== 'object') {
      return { mode: 'amount' as const, value: 0 };
    }

    const modeRaw = toNonEmptyString((payload.discount as { mode?: unknown }).mode);
    const valueRaw = toNumber((payload.discount as { value?: unknown }).value);

    return {
      mode: modeRaw === 'percent' ? 'percent' : 'amount',
      value: Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0,
    };
  })(),
  deviceName: toNonEmptyString(payload.deviceName),
  serialNumber: toNonEmptyString(payload.serialNumber).toUpperCase(),
  isRapidSale:
    payload.isRapidSale === true ||
    String(payload.isRapidSale ?? '').toLowerCase() === 'true',
});
