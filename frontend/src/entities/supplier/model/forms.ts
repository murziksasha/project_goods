import type { Supplier, SupplierFormValues } from './types';

export type SupplierFormState = {
  name: string;
  phone: string;
  phones: string[];
  supplierOrder: string;
  note: string;
  isActive: boolean;
};

export const getSupplierPhones = (supplier: Supplier): string[] => {
  if (Array.isArray(supplier.phones) && supplier.phones.length > 0) {
    return supplier.phones.filter((phone): phone is string => Boolean(phone));
  }
  return supplier.phone ? [supplier.phone] : [];
};

export const getPrimarySupplierPhone = (supplier: Supplier): string => {
  const phones = getSupplierPhones(supplier);
  return phones[0] || supplier.phone || '';
};

export const toSupplierForm = (supplier?: Supplier): SupplierFormState => {
  const phoneList = supplier ? getSupplierPhones(supplier) : [];
  const primary = phoneList[0] || supplier?.phone || '+380';

  return {
    phone: primary,
    phones: phoneList.length > 0 ? [...phoneList] : [primary],
    name: supplier?.name ?? '',
    note: supplier?.note ?? '',
    supplierOrder: supplier?.supplierOrder ?? '',
    isActive: supplier?.isActive ?? true,
  };
};

export const mapSupplierFormToPayload = (
  form: SupplierFormValues,
): SupplierFormValues => {
  const primary = (form.phone || '').trim();
  let phoneList = Array.isArray(form.phones)
    ? form.phones.map((phone) => (phone || '').trim()).filter((phone) => phone.length > 0)
    : [];

  if (phoneList.length === 0 && primary) {
    phoneList = [primary];
  }

  if (primary) {
    phoneList = [primary, ...phoneList.filter((phone) => phone !== primary)];
  }

  const seen = new Set<string>();
  phoneList = phoneList.filter((phone) => {
    if (seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });

  const finalPrimary = phoneList[0] || primary || '';

  return {
    phone: finalPrimary,
    phones: phoneList.length > 0 ? phoneList : finalPrimary ? [finalPrimary] : [],
    name: form.name.trim(),
    note: form.note.trim(),
    supplierOrder: form.supplierOrder?.trim() ?? '',
    isActive: form.isActive,
  };
};