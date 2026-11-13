import type { Supplier } from '../../../../entities/supplier';
import { getSupplierPhones } from '../../../../entities/supplier';
import {
  isPhoneLikeQuery,
  phonesMatchQuery,
} from '../../../../shared/lib/phone-search';

const supplierText = (supplier: Supplier, query: string) => {
  const fields = isPhoneLikeQuery(query)
    ? [supplier.name, supplier.note, supplier.supplierOrder]
    : [
        supplier.name,
        ...getSupplierPhones(supplier),
        supplier.note,
        supplier.supplierOrder,
      ];
  return fields.join(' ').toLowerCase();
};

/** Suppliers list `query`. Empty query matches every row. */
export const supplierMatchesListQuery = (supplier: Supplier, query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return true;

  return (
    supplierText(supplier, trimmed).includes(trimmed.toLowerCase()) ||
    phonesMatchQuery(getSupplierPhones(supplier), trimmed)
  );
};
