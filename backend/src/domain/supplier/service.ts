import { formatSupplier } from '../../shared/lib/formatters';
import { normalizePhone, toNonEmptyString } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { Supplier, type SupplierDocument } from './model';
import type { SupplierPayload } from '../shared/types';

const normalizeSupplierPayload = (payload: SupplierPayload) => ({
  phone: normalizePhone(payload.phone),
  name: toNonEmptyString(payload.name),
  note: toNonEmptyString(payload.note),
  isActive:
    payload.isActive === undefined
      ? true
      : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
});

export const listSuppliers = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const suppliers = await Supplier.find(query)
    .sort({ createdAt: -1 })
    .lean<SupplierDocument[]>();
  return suppliers.map(formatSupplier);
};

export const createSupplier = async (payload: SupplierPayload) => {
  const supplier = new Supplier(normalizeSupplierPayload(payload));
  await supplier.validate();
  await supplier.save();
  return formatSupplier(supplier.toObject<SupplierDocument>());
};

export const updateSupplier = async (supplierId: string, payload: SupplierPayload) => {
  isValidObjectIdOrThrow(supplierId, 'supplierId');
  const supplier = await Supplier.findByIdAndUpdate(
    supplierId,
    normalizeSupplierPayload(payload),
    { new: true, runValidators: true },
  ).lean<SupplierDocument | null>();

  if (!supplier) throw new Error('Supplier not found.');

  return formatSupplier(supplier);
};

export const deleteSupplier = async (supplierId: string) => {
  isValidObjectIdOrThrow(supplierId, 'supplierId');
  const deleted = await Supplier.findByIdAndDelete(supplierId).lean<SupplierDocument | null>();
  if (!deleted) throw new Error('Supplier not found.');
  return { id: supplierId };
};
