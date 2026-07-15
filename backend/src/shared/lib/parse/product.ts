import type { ProductPayload } from '../../../domain/shared/types';
import { toNonEmptyString, toNumber, toOptionalDate } from './primitives';

const splitNumericList = (value: unknown) => {
  if (Array.isArray(value)) return value;

  const rawValue = String(value ?? '').trim();
  if (!rawValue) return [];
  if (rawValue.includes(';') || rawValue.includes('\n')) {
    return rawValue.split(/[;\n]/);
  }

  return rawValue.split(/,\s+/);
};

export const normalizeProductPayload = (payload: ProductPayload) => ({
  name: toNonEmptyString(payload.name),
  article: toNonEmptyString(payload.article).toUpperCase(),
  serialNumber: toNonEmptyString(payload.serialNumber).toUpperCase(),
  price: toNumber(payload.price),
  salePriceOptions: Array.isArray(payload.salePriceOptions)
    ? payload.salePriceOptions
        .map((value) => toNumber(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
    : splitNumericList(payload.salePriceOptions)
        .map((value) => toNumber(String(value).trim()))
        .filter((value) => Number.isFinite(value) && value >= 0),
  quantity: toNumber(payload.quantity),
  note: toNonEmptyString(payload.note),
  reservedQuantity:
    payload.reservedQuantity === '' || payload.reservedQuantity === undefined
      ? 0
      : toNumber(payload.reservedQuantity),
  purchasePlace: toNonEmptyString(payload.purchasePlace),
  warehouseId: toNonEmptyString(payload.warehouseId),
  locationId: toNonEmptyString(payload.locationId),
  purchaseDate: toOptionalDate(payload.purchaseDate),
  warrantyPeriod:
    payload.warrantyPeriod === '' || payload.warrantyPeriod === undefined
      ? 0
      : toNumber(payload.warrantyPeriod),
});
