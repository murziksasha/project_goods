import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../../shared/i18n/config';
import en from '../../../../shared/i18n/locales/en.json';
import uk from '../../../../shared/i18n/locales/uk.json';

const leafKeys = (value: unknown, prefix = ''): string[] => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leafKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
};

afterEach(async () => {
  if (i18n.language !== 'en') {
    await i18n.changeLanguage('en');
  }
});

describe('orders reports i18n', () => {
  it('keeps identical key sets for orders.reports and the new tab label', () => {
    expect(en.orders.tabs.ordersReports).toBe('Reports');
    expect(uk.orders.tabs.ordersReports).toBe('Звіти');
    expect(leafKeys(en.orders.reports).sort()).toEqual(leafKeys(uk.orders.reports).sort());
    expect(leafKeys(en.orders.reports).length).toBeGreaterThan(100);
  });

  it('uses Ukrainian plural forms for export progress including the 221 "one" rule', async () => {
    const phrase = (count: number) =>
      i18n.t('orders.reports.exportProgress', { loaded: count, total: count, count });

    expect(phrase(1)).toContain('1');
    expect(phrase(5)).toContain('5');

    await i18n.changeLanguage('uk');
    expect(phrase(1)).toMatch(/1/);
    expect(phrase(3)).toMatch(/3/);
    expect(phrase(5)).toMatch(/5/);
    // 221 uses the "one" form in Ukrainian (n % 10 === 1 && n % 100 !== 11)
    expect(phrase(221)).toMatch(/221/);
    expect(phrase(221)).toContain('з');
    expect(i18n.exists('orders.reports.exportProgress_one')).toBe(true);
    expect(i18n.exists('orders.reports.exportProgress_few')).toBe(true);
    expect(i18n.exists('orders.reports.exportProgress_many')).toBe(true);
    expect(i18n.exists('orders.reports.exportProgress_other')).toBe(true);
  });
});
