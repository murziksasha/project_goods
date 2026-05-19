import type { Supplier } from '../../../entities/supplier/model/types';

export const getSupplierSuggestions = (
  suppliers: Supplier[],
  searchValue: string,
) => {
  const normalized = searchValue.trim().toLowerCase();
  if (normalized.length < 2) return [];
  return suppliers
    .filter(
      (supplier) =>
        supplier.isActive &&
        [supplier.name, supplier.phone]
          .join(' ')
          .toLowerCase()
          .includes(normalized),
    )
    .slice(0, 8);
};
