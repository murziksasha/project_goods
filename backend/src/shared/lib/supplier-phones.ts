export const getSupplierPhonesFromRecord = (supplier: {
  phone?: string;
  phones?: string[];
}) => {
  if (Array.isArray(supplier.phones) && supplier.phones.length > 0) {
    return supplier.phones.filter((phone): phone is string => Boolean(phone));
  }

  return supplier.phone ? [supplier.phone] : [];
};