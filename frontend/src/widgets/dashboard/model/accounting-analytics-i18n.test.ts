import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../shared/i18n/config';
import en from '../../../shared/i18n/locales/en.json';
import uk from '../../../shared/i18n/locales/uk.json';
import { displayCurrencyCode, formatMoney } from './accounting';
import {
  translateCashboxCoverageWarnings,
  translatePeriodLabel,
  translateProfitCoverageWarnings,
  translateProfitKind,
  translateTxType,
} from './accounting-analytics-i18n';

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

describe('accounting analytics i18n helpers', () => {
  it('keeps identical key sets for accounting.reports, accounting.profit, and common.currency', () => {
    const namespaces = [
      'accounting.reports',
      'accounting.profit',
      'common.currency',
    ] as const;
    for (const ns of namespaces) {
      const [enRoot, ukRoot] = ns.split('.').reduce(
        ([enNode, ukNode], part) =>
          [
            (enNode as Record<string, unknown>)[part],
            (ukNode as Record<string, unknown>)[part],
          ] as const,
        [en as unknown, uk as unknown] as const,
      );
      expect(leafKeys(enRoot).sort()).toEqual(leafKeys(ukRoot).sort());
    }
  });

  it('maps cashbox and profit warning codes and known English free text', async () => {
    const coded = translateCashboxCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'shortFinanceHistory', count: 14 },
    ]);
    expect(coded[0]).toBe(
      'Only 14 day(s) of finance history available inside the 90-day observation window.',
    );

    const fromText = translateCashboxCoverageWarnings(i18n.t.bind(i18n), [
      'Transactions on or before 2026-10-01 (12 purged) are sealed; opening balance and full period reconciliation are unavailable inside the sealed purge window.',
      'Trailing 90-day forecast history partially overlaps purged seal date (2026-10-01).',
      '1 SKU batch(es) lack purchaseDate and are grouped under unknown age.',
    ]);
    expect(fromText[0]).toContain('are sealed');
    expect(fromText[1]).toContain('purged seal date (2026-10-01)');
    expect(fromText[2]).toBe(
      '1 SKU batch(es) lack purchaseDate and are grouped under unknown age.',
    );

    const profitCoded = translateProfitCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'incompleteCostRecords', count: 42 },
    ]);
    expect(profitCoded[0]).toBe(
      '42 SKU group(s) have incomplete cost records; overall gross profit/margin is incomplete.',
    );

    await i18n.changeLanguage('uk');
    const ukOne = translateProfitCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'incompleteCostRecords', count: 1 },
    ]);
    const ukFew = translateProfitCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'incompleteCostRecords', count: 3 },
    ]);
    const ukMany = translateProfitCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'incompleteCostRecords', count: 5 },
    ]);
    const uk221 = translateProfitCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'incompleteCostRecords', count: 221 },
    ]);
    expect(ukOne[0]).toContain('1 група SKU');
    expect(ukFew[0]).toContain('3 групи SKU');
    expect(ukMany[0]).toContain('5 груп SKU');
    // 221 uses the "one" form in Ukrainian
    expect(uk221[0]).toContain('221 група SKU');

    const ukSealed = translateCashboxCoverageWarnings(i18n.t.bind(i18n), [
      'Transactions on or before 2026-10-01 (12 purged) are sealed; opening balance and full period reconciliation are unavailable inside the sealed purge window.',
    ]);
    expect(ukSealed[0]).toContain('запечатано');
    expect(ukSealed[0]).toContain('2026-10-01');

    const ukShort = translateCashboxCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'shortFinanceHistory', count: 1 },
    ]);
    const ukShortFew = translateCashboxCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'shortFinanceHistory', count: 3 },
    ]);
    const ukShortMany = translateCashboxCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'shortFinanceHistory', count: 5 },
    ]);
    expect(ukShort[0]).toContain('лише 1 день');
    expect(ukShortFew[0]).toContain('лише 3 дні');
    expect(ukShortMany[0]).toContain('лише 5 днів');
  });

  it('translates periods, operation types, profit kinds, and the UAH suffix', async () => {
    expect(translatePeriodLabel(i18n.t.bind(i18n), 'last30')).toBe('Last 30 days');
    expect(translateTxType(i18n.t.bind(i18n), 'deposit')).toBe('deposit');
    expect(translateProfitKind(i18n.t.bind(i18n), 'sale')).toBe('sale');
    expect(displayCurrencyCode('UAH')).toBe('UAH');
    expect(displayCurrencyCode('USD')).toBe('USD');
    expect(formatMoney(1250, 'UAH')).toBe('1,250.00 UAH');
    expect(formatMoney(200, 'USD')).toBe('200.00 USD');

    await i18n.changeLanguage('uk');
    expect(translatePeriodLabel(i18n.t.bind(i18n), 'last30')).toBe('Останні 30 днів');
    expect(translateTxType(i18n.t.bind(i18n), 'deposit')).toBe('надходження');
    expect(translateTxType(i18n.t.bind(i18n), 'withdraw')).toBe('витрата');
    expect(translateTxType(i18n.t.bind(i18n), 'transfer')).toBe('переказ');
    expect(translateProfitKind(i18n.t.bind(i18n), 'repair')).toBe('ремонт');
    expect(displayCurrencyCode('UAH')).toBe('грн');
    expect(displayCurrencyCode('USD')).toBe('USD');
    expect(formatMoney(1250, 'UAH').replace(/\s/g, ' ')).toBe('1 250,00 грн');
    expect(formatMoney(200, 'USD').replace(/\s/g, ' ')).toBe('200,00 USD');
  });
});
