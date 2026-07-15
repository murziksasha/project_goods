export const toNonEmptyString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const toOptionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const normalizedValue = value.trim().replace(/\s+/g, '').replace(',', '.');
    if (!/^-?\d+(?:\.\d*)?$/.test(normalizedValue)) return NaN;

    return Number(normalizedValue);
  }

  return NaN;
};

export const normalizePhone = (value: unknown) =>
  String(value ?? '')
    .replace(/[^\d+]/g, '')
    .trim();

export const normalizeClientPhone = (value: unknown) => {
  const normalized = normalizePhone(value);
  const digits = normalized.replace(/\D/g, '');
  if (digits.startsWith('380') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+380${digits.slice(1)}`;
  if (digits.length === 9) return `+380${digits}`;
  return normalized;
};

export const normalizeEmail = (value: unknown) => toNonEmptyString(value).toLowerCase();
