import i18n from '../i18n/config';

const currencyFormatter = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number) =>
  currencyFormatter.format(value);

export const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const parts = currencyFormatter.formatToParts(value);
  let isNegative = false;
  let integerStr = '';
  let fractionStr = '';

  for (const part of parts) {
    if (part.type === 'minusSign') {
      isNegative = true;
    } else if (part.type === 'integer') {
      integerStr += part.value;
    } else if (part.type === 'fraction') {
      fractionStr = part.value;
    }
  }

  const integerPart = parseInt(integerStr || '0', 10);
  const fractionPart = parseInt(
    fractionStr.padEnd(2, '0').slice(0, 2) || '0',
    10,
  );
  const kopiykas = integerPart * 100 + fractionPart;

  if (kopiykas === 0) {
    return 0;
  }

  return isNegative ? -kopiykas : kopiykas;
};

export const formatDate = (value: string | null) => {
  if (!value) {
    return i18n.t('common.notSpecified');
  }

  return new Intl.DateTimeFormat('uk-UA').format(new Date(value));
};

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
