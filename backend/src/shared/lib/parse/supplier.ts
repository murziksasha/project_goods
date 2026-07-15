import type { SupplierPayload } from '../../../domain/shared/types';
import { toNonEmptyString } from './primitives';
import { normalizePhonesList } from './client';

export const normalizeSupplierPayload = (payload: SupplierPayload) => {
  const { phone, phones } = normalizePhonesList(payload);

  return {
    phone,
    phones,
    name: toNonEmptyString(payload.name),
    note: toNonEmptyString(payload.note),
    supplierOrder: toNonEmptyString(payload.supplierOrder),
    isActive:
      payload.isActive === undefined
        ? true
        : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
  };
};
