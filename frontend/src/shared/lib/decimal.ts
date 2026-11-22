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

export const formatMoneyAmount = (value: number) =>
  roundMoney(Number.isFinite(value) ? value : 0).toFixed(2);

export const formatMoney = formatMoneyAmount;

export const calculateMoneyRemainder = (
  remaining: number,
  enteredAmount: unknown,
): number => {
  const parsed = parseMoney(enteredAmount);
  const entered = Number.isFinite(parsed) ? parsed : 0;
  return Math.max(0, roundMoney(roundMoney(remaining) - entered));
};

export const formatMoneyRemainder = (
  remaining: number,
  enteredAmount?: unknown,
): string => {
  if (enteredAmount === undefined) {
    const val = Number.isFinite(remaining) ? Math.max(0, roundMoney(remaining)) : 0;
    return val.toFixed(2).replace('.', ',');
  }
  const rem = calculateMoneyRemainder(remaining, enteredAmount);
  return rem.toFixed(2).replace('.', ',');
};

export const formatRemainder = formatMoneyRemainder;

