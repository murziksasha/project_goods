export const normalizeDecimalInput = (value: string) => {
  const trimmedValue = value.trimStart();
  let hasSeparator = false;

  return Array.from(trimmedValue)
    .filter((char) => {
      if (/\d/.test(char)) return true;
      if ((char === ',' || char === '.') && !hasSeparator) {
        hasSeparator = true;
        return true;
      }

      return false;
    })
    .join('');
};

export const parseDecimal = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;

  const normalizedValue = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d*)?$/.test(normalizedValue)) return NaN;

  return Number(normalizedValue);
};

export const roundMoney = (value: number) =>
  Math.round(value * 100) / 100;

export const parseMoney = (value: unknown) => {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) ? roundMoney(parsed) : NaN;
};
