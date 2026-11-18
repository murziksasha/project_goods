/**
 * Value formatters for print template variables (see PRINT_FORMS_SPEC.md,
 * "New Barcode label"). Pure functions so they are easy to unit test.
 */

/** Shop time zone: intake date/time on labels is always shown in Kyiv time. */
export const printTimeZone = 'Europe/Kyiv';

// Older ICU builds only know the legacy alias.
const resolvePrintTimeZone = () => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: printTimeZone }).format(0);
    return printTimeZone;
  } catch {
    return 'Europe/Kiev';
  }
};

const getKyivParts = (value: string | Date | undefined | null) => {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: resolvePrintTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: read('day'),
    month: read('month'),
    year: read('year'),
    hour: read('hour'),
    minute: read('minute'),
  };
};

/** `dd.MM.yyyy` in Kyiv time; empty string for missing/invalid input. */
export const formatPrintAcceptedDate = (value: string | Date | undefined | null) => {
  const parts = getKyivParts(value);
  return parts ? `${parts.day}.${parts.month}.${parts.year}` : '';
};

/** `HH:mm` (24h) in Kyiv time; empty string for missing/invalid input. */
export const formatPrintAcceptedTime = (value: string | Date | undefined | null) => {
  const parts = getKyivParts(value);
  return parts ? `${parts.hour}:${parts.minute}` : '';
};

/**
 * `r000124` → `#124`: drop the letter prefix and leading zeros. Values without
 * a trailing number are returned as `#<value>`; empty input stays empty.
 */
export const formatOrderNumberShort = (orderNumber: string | undefined | null) => {
  const value = (orderNumber ?? '').trim();
  if (!value) return '';
  const match = /(\d+)\s*$/.exec(value);
  if (!match) return `#${value}`;
  const digits = match[1].replace(/^0+(?=\d)/, '');
  return `#${digits}`;
};
