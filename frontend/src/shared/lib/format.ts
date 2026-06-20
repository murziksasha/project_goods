import i18n from '../i18n/config';

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 2,
  }).format(value);

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
