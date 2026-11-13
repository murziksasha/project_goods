import type { SalePayload } from '../../../domain/shared/types';
import {
  toNonEmptyString,
  toNumber,
  toOptionalDate,
} from './primitives';

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
    payload.paidAmount === undefined
      ? 0
      : toNumber(payload.paidAmount),
  timeline: Array.isArray(payload.timeline)
    ? payload.timeline
        .map((entry) => ({
          id: toNonEmptyString((entry as { id?: unknown })?.id),
          kind:
            toNonEmptyString((entry as { kind?: unknown })?.kind) ===
            'manual'
              ? 'manual'
              : toNonEmptyString(
                    (entry as { kind?: unknown })?.kind,
                  ) === 'system'
                ? 'system'
                : undefined,
          author: toNonEmptyString(
            (entry as { author?: unknown })?.author,
          ),
          message: toNonEmptyString(
            (entry as { message?: unknown })?.message,
          ),
          createdAt:
            toOptionalDate(
              (entry as { createdAt?: unknown })?.createdAt,
            ) ?? new Date(),
        }))
        .filter((entry) => entry.id && entry.author && entry.message)
    : [],
  paymentHistory: Array.isArray(payload.paymentHistory)
    ? payload.paymentHistory
        .map((entry) => ({
          id: toNonEmptyString((entry as { id?: unknown })?.id),
          type: toNonEmptyString((entry as { type?: unknown })?.type),
          paymentMethod:
            toNonEmptyString(
              (entry as { paymentMethod?: unknown })?.paymentMethod,
            ) === 'non-cash'
              ? 'non-cash'
              : 'cash',
          amount: toNumber((entry as { amount?: unknown })?.amount),
          cashboxId: toNonEmptyString(
            (entry as { cashboxId?: unknown })?.cashboxId,
          ),
          cashboxName: toNonEmptyString(
            (entry as { cashboxName?: unknown })?.cashboxName,
          ),
          author: toNonEmptyString(
            (entry as { author?: unknown })?.author,
          ),
          createdAt:
            toOptionalDate(
              (entry as { createdAt?: unknown })?.createdAt,
            ) ?? new Date(),
        }))
        .filter(
          (entry) =>
            entry.id &&
            (entry.type === 'deposit' || entry.type === 'refund') &&
            (entry.paymentMethod === 'cash' ||
              entry.paymentMethod === 'non-cash') &&
            Number.isFinite(entry.amount) &&
            entry.amount >= 0 &&
            entry.cashboxId &&
            entry.cashboxName &&
            entry.author,
        )
    : [],
  lineItems: Array.isArray(payload.lineItems)
    ? payload.lineItems
        .map((raw) => {
          const rawRecord = (raw ?? {}) as Record<string, unknown>;
          const normalized: Record<string, unknown> = {
            id: toNonEmptyString(rawRecord.id),
            kind: toNonEmptyString(rawRecord.kind),
            productId: toNonEmptyString(rawRecord.productId) || undefined,
            catalogProductId:
              toNonEmptyString(rawRecord.catalogProductId) || undefined,
            serviceId: toNonEmptyString(rawRecord.serviceId) || undefined,
            name: toNonEmptyString(rawRecord.name),
            price: toNumber(rawRecord.price),
            quantity: toNumber(rawRecord.quantity),
            warrantyPeriod:
              rawRecord.warrantyPeriod === undefined
                ? 0
                : toNumber(rawRecord.warrantyPeriod),
            serialNumbers: Array.isArray(rawRecord.serialNumbers)
              ? Array.from(
                  new Set(
                    (rawRecord.serialNumbers as unknown[])
                      .map((value) => toNonEmptyString(value).toUpperCase())
                      .filter(Boolean),
                  ),
                )
              : [],
          };

          const optionalNumField = (field: string) => {
            if (!Object.prototype.hasOwnProperty.call(rawRecord, field)) return;
            const val = rawRecord[field];
            if (val === undefined) return;
            if (val === null || val === '') {
              normalized[field] = null;
              return;
            }
            const parsed = toNumber(val);
            normalized[field] = parsed;
          };

          if (
            Object.prototype.hasOwnProperty.call(rawRecord, 'costMethod') &&
            rawRecord.costMethod !== undefined
          ) {
            const rawMethod = toNonEmptyString(rawRecord.costMethod).toLowerCase();
            normalized.costMethod =
              rawRecord.costMethod === null || rawRecord.costMethod === ''
                ? null
                : rawMethod === 'time_rate'
                  ? 'time_rate'
                  : 'fixed';
          }
          optionalNumField('recordedMinutes');
          optionalNumField('fixedCost');
          optionalNumField('hourlyCost');
          optionalNumField('directExpenses');
          optionalNumField('unitCostOverride');
          if (Object.prototype.hasOwnProperty.call(rawRecord, 'isCostOverridden')) {
            normalized.isCostOverridden = rawRecord.isCostOverridden === true;
          }

          if (Object.prototype.hasOwnProperty.call(rawRecord, 'costSnapshot')) {
            normalized.costSnapshot = rawRecord.costSnapshot;
          }
          if (Object.prototype.hasOwnProperty.call(rawRecord, 'auditedCost')) {
            normalized.auditedCost = rawRecord.auditedCost;
          }
          if (Object.prototype.hasOwnProperty.call(rawRecord, 'costAuditLog')) {
            normalized.costAuditLog = rawRecord.costAuditLog;
          }

          return normalized as {
            id: string;
            kind: string;
            productId?: string;
            catalogProductId?: string;
            serviceId?: string;
            name: string;
            price: number;
            quantity: number;
            warrantyPeriod: number;
            serialNumbers: string[];
            costMethod?: 'fixed' | 'time_rate' | null;
            recordedMinutes?: number | null;
            fixedCost?: number | null;
            hourlyCost?: number | null;
            directExpenses?: number | null;
            unitCostOverride?: number | null;
          };
        })
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
      return { mode: 'percent' as const, value: 0 };
    }

    const modeRaw = toNonEmptyString(
      (payload.discount as { mode?: unknown }).mode,
    );
    const valueRaw = toNumber(
      (payload.discount as { value?: unknown }).value,
    );

    return {
      mode: modeRaw === 'amount' ? 'amount' : 'percent',
      value: Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0,
    };
  })(),
  deviceName: toNonEmptyString(payload.deviceName),
  serialNumber: toNonEmptyString(payload.serialNumber).toUpperCase(),
  isRapidSale:
    payload.isRapidSale === true ||
    String(payload.isRapidSale ?? '').toLowerCase() === 'true',
  kanbanRank: (() => {
    const raw = (payload as { kanbanRank?: unknown }).kanbanRank;
    if (raw === undefined || raw === null || raw === '')
      return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  })(),
});
