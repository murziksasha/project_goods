import { describe, expect, it } from 'vitest';
import i18n from '../i18n/config';
import { formatAmountInWords, formatPrintAmount, printT } from './printFormatting';

describe('fixed Ukrainian print formatting', () => {
  it.each(['en', 'uk'])('prints Ukrainian under the %s interface without changing its language', async (language) => {
    await i18n.changeLanguage(language);
    const storedLanguage = localStorage.getItem('project-goods.lang');
    expect(formatAmountInWords(950)).toBe("дев'ятсот п'ятдесят гривень 00 копійок");
    expect(formatPrintAmount(1234.56).replaceAll('\u00a0', ' ')).toBe('1 234,56');
    expect(printT('orders.print.invoice.director')).toBe('Директор');
    expect(i18n.language).toBe(language);
    expect(localStorage.getItem('project-goods.lang')).toBe(storedLanguage);
  });

  it.each([
    [0, 'нуль гривень 00 копійок'],
    [1.01, 'одна гривня 01 копійка'],
    [2.02, 'дві гривні 02 копійки'],
    [11.11, 'одинадцять гривень 11 копійок'],
    [21.21, 'двадцять одна гривня 21 копійка'],
    [22.22, 'двадцять дві гривні 22 копійки'],
    [1.999, 'дві гривні 00 копійок'],
    [1001, 'одна тисяча одна гривня 00 копійок'],
    [21000, 'двадцять одна тисяча гривень 00 копійок'],
    [1000000, 'один мільйон гривень 00 копійок'],
  ])('writes %s with Ukrainian gender, plural forms and rounded kopecks', (amount, expected) => {
    expect(formatAmountInWords(amount)).toBe(expected);
  });
});
