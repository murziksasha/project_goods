import { formatSupplier } from '../../shared/lib/formatters';
import { normalizePhone, toNonEmptyString } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { Supplier, type SupplierDocument } from './model';
import type { SupplierPayload } from '../shared/types';

const normalizeSupplierPayload = (payload: SupplierPayload) => ({
  phone: normalizePhone(payload.phone),
  name: toNonEmptyString(payload.name),
  note: toNonEmptyString(payload.note),
  supplierOrder: toNonEmptyString(payload.supplierOrder),
  isActive:
    payload.isActive === undefined
      ? true
      : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
});

const mapSupplierError = (error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
    const duplicateField = Object.keys((error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {})[0];
    if (duplicateField === 'phone') {
      return new Error('Supplier with this phone already exists.');
    }
    if (duplicateField === 'name') {
      return new Error('Supplier with this name already exists.');
    }
    return new Error('Supplier with same data already exists.');
  }
  return error;
};

export const listSuppliers = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const suppliers = await Supplier.find(query)
    .sort({ createdAt: -1 })
    .lean<SupplierDocument[]>();
  return suppliers.map(formatSupplier);
};

export const createSupplier = async (payload: SupplierPayload) => {
  try {
    const supplier = new Supplier(normalizeSupplierPayload(payload));
    await supplier.validate();
    await supplier.save();
    return formatSupplier(supplier.toObject<SupplierDocument>());
  } catch (error) {
    throw mapSupplierError(error);
  }
};

export const updateSupplier = async (supplierId: string, payload: SupplierPayload) => {
  isValidObjectIdOrThrow(supplierId, 'supplierId');
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      supplierId,
      normalizeSupplierPayload(payload),
      { returnDocument: 'after', runValidators: true },
    ).lean<SupplierDocument | null>();

    if (!supplier) throw new Error('Supplier not found.');

    return formatSupplier(supplier);
  } catch (error) {
    throw mapSupplierError(error);
  }
};

export const deleteSupplier = async (supplierId: string) => {
  isValidObjectIdOrThrow(supplierId, 'supplierId');
  const deleted = await Supplier.findByIdAndDelete(supplierId).lean<SupplierDocument | null>();
  if (!deleted) throw new Error('Supplier not found.');
  return { id: supplierId };
};
