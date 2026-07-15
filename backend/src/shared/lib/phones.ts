/** Shared phone list helpers for client/supplier records. */

export const getPhonesFromRecord = (record: {
  phone?: string;
  phones?: string[];
}) => {
  if (Array.isArray(record.phones) && record.phones.length > 0) {
    return record.phones.filter((phone): phone is string => Boolean(phone));
  }

  return record.phone ? [record.phone] : [];
};

export const getClientPhonesFromRecord = getPhonesFromRecord;
export const getSupplierPhonesFromRecord = getPhonesFromRecord;
