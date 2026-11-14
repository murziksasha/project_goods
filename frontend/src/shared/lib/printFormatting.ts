import i18n from '../i18n/config';

export const printT = i18n.getFixedT('uk');
export const printLocale = 'uk-UA';

export const formatPrintAmount = (value: number) =>
  new Intl.NumberFormat(printLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const pluralizeUk = (value: number, one: string, few: string, many: string) => {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};

type PluralForms = { one: string; few: string; many: string };
const amountWords = (key: string) => printT(`orders.print.amountInWords.${key}`, { returnObjects: true }) as unknown as string[];
const amountForms = (key: string) => printT(`orders.print.amountInWords.${key}`, { returnObjects: true }) as unknown as PluralForms;
const pluralize = (value: number, forms: PluralForms) => pluralizeUk(value, forms.one, forms.few, forms.many);

export const numberToUkrainianWords = (value: number) => {
  if (value === 0) return printT('orders.print.amountInWords.zero');
  const units = amountWords('units');
  const femaleUnits = amountWords('femaleUnits');
  const teens = amountWords('teens');
  const tens = amountWords('tens');
  const hundreds = amountWords('hundreds');
  const chunkToWords = (chunk: number, female: boolean) => {
    const parts: string[] = [];
    const hundred = Math.floor(chunk / 100);
    const ten = Math.floor((chunk % 100) / 10);
    const unit = chunk % 10;
    if (hundred) parts.push(hundreds[hundred]);
    if (ten === 1) parts.push(teens[unit]);
    else {
      if (ten > 1) parts.push(tens[ten]);
      if (unit) parts.push((female ? femaleUnits : units)[unit]);
    }
    return parts.filter(Boolean).join(' ');
  };
  const scales = [
    { divisor: 1_000_000_000, female: false, forms: { one: 'мільярд', few: 'мільярди', many: 'мільярдів' } },
    { divisor: 1_000_000, female: false, forms: { one: 'мільйон', few: 'мільйони', many: 'мільйонів' } },
    { divisor: 1000, female: true, forms: amountForms('thousand') },
  ];
  const words: string[] = [];
  let rest = value;
  for (const scale of scales) {
    const chunk = Math.floor(rest / scale.divisor);
    if (chunk) words.push(chunkToWords(chunk, scale.female), pluralize(chunk, scale.forms));
    rest %= scale.divisor;
  }
  if (rest) words.push(chunkToWords(rest, true));
  return words.join(' ');
};

export const formatAmountInWords = (value: number) => {
  const cents = Math.round(value * 100);
  const hryvnias = Math.floor(cents / 100);
  const kopiyky = cents % 100;
  return `${numberToUkrainianWords(hryvnias)} ${pluralize(hryvnias, amountForms('hryvnia'))} ${String(kopiyky).padStart(2, '0')} ${pluralize(kopiyky, amountForms('kopiyka'))}`;
};
