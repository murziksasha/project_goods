export const hasDuplicatePhones = (phones: string[]) => {
  const seen = new Set<string>();
  for (const phone of phones || []) {
    const trimmed = (phone || '').trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) return true;
    seen.add(trimmed);
  }
  return false;
};

export const getPhoneRows = (phone: string, phones?: string[]) =>
  phones && phones.length > 0 ? phones : [phone || ''];

export type PhoneFieldState = {
  phone: string;
  phones: string[];
};

export const normalizePhoneFieldState = (
  phone: string,
  phones?: string[],
): PhoneFieldState => {
  const rows = getPhoneRows(phone, phones);
  const primary = rows[0] ?? phone ?? '';
  return {
    phone: primary,
    phones: rows.length > 0 ? rows : [primary || ''],
  };
};

export const updatePhoneAtIndex = (
  phone: string,
  phones: string[] | undefined,
  index: number,
  value: string,
): PhoneFieldState => {
  const rows = [...getPhoneRows(phone, phones)];
  rows[index] = value;
  const cleaned = rows.filter((item, itemIndex) => item || itemIndex === 0);
  const nextPhones = cleaned.length > 0 ? cleaned : [''];
  const nextPrimary = index === 0 ? value : (nextPhones[0] ?? phone);
  return { phone: nextPrimary, phones: nextPhones };
};

export const removePhoneAtIndex = (
  phone: string,
  phones: string[] | undefined,
  index: number,
): PhoneFieldState => {
  const rows = getPhoneRows(phone, phones);

  if (rows.length <= 1) {
    return { phone: rows[0] ?? phone ?? '', phones: [rows[0] ?? phone ?? ''] };
  }

  if (index === 0) {
    const nextPhones = rows.slice(1);
    return { phone: nextPhones[0] ?? '', phones: nextPhones };
  }

  const nextPhones = rows.filter((_, itemIndex) => itemIndex !== index);
  return normalizePhoneFieldState(phone, nextPhones);
};

export const setPrimaryPhoneAtIndex = (
  phone: string,
  phones: string[] | undefined,
  index: number,
): PhoneFieldState => {
  const rows = getPhoneRows(phone, phones);
  if (index <= 0 || index >= rows.length) {
    return normalizePhoneFieldState(phone, phones);
  }

  const selected = rows[index];
  const rest = rows.filter((_, itemIndex) => itemIndex !== index);
  const nextPhones = [selected, ...rest];
  return { phone: selected, phones: nextPhones };
};

export const addPhoneRow = (
  phone: string,
  phones: string[] | undefined,
  defaultValue = '+380',
): PhoneFieldState => {
  const rows = getPhoneRows(phone, phones);
  const nextPhones = [...rows, defaultValue];
  return { phone: nextPhones[0] ?? phone, phones: nextPhones };
};