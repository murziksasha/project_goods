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