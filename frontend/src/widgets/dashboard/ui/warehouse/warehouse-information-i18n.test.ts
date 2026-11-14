import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../../shared/i18n/config';
import en from '../../../../shared/i18n/locales/en.json';
import uk from '../../../../shared/i18n/locales/uk.json';
import {
  translateAgeBucket,
  translateAssignedName,
  translateCoverageWarnings,
  translateDemandPattern,
  translateLocationLabel,
  translateStockState,
} from './warehouse-information-i18n';

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

describe('warehouse information i18n helpers', () => {
  it('keeps identical key sets for warehouse.information and analytics.scenario', () => {
    const namespaces = ['warehouse.information', 'analytics.scenario'] as const;
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

  it('maps backend warning codes and known English free text', async () => {
    const coded = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'unknownAgeOnHand', count: 3, units: 12 },
    ]);
    expect(coded[0]).toBe(
      '3 on-hand record(s) (12 unit(s)) have no purchase date (Unknown age).',
    );

    const fromText = translateCoverageWarnings(i18n.t.bind(i18n), [
      'Cold yearly archive purges exist; trailing demand only reflects live persisted sales.',
      'Only 14 day(s) of live sales history available in the 90-day observation window.',
      '2 on-hand record(s) (7 unit(s)) have no purchase date (Unknown age).',
      '1 SKU batch(es) lack purchaseDate and are grouped under unknown age.',
    ]);
    expect(fromText[0]).toContain('Cold yearly archive purges exist');
    expect(fromText[1]).toBe(
      'Only 14 day(s) of live sales history available in the 90-day observation window.',
    );
    expect(fromText[2]).toBe(
      '2 on-hand record(s) (7 unit(s)) have no purchase date (Unknown age).',
    );
    // Unknown / slightly different free text is left as-is
    expect(fromText[3]).toBe(
      '1 SKU batch(es) lack purchaseDate and are grouped under unknown age.',
    );

    await i18n.changeLanguage('uk');
    const ukOne = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'unknownAgeOnHand', count: 1, units: 2 },
    ]);
    const ukFew = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'unknownAgeOnHand', count: 3, units: 7 },
    ]);
    const ukMany = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'unknownAgeOnHand', count: 5, units: 10 },
    ]);
    const uk221 = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'unknownAgeOnHand', count: 221, units: 221 },
    ]);
    // 221 uses the "one" form in Ukrainian (n % 10 === 1 && n % 100 !== 11)
    expect(ukOne[0]).toContain('1 запис на складі');
    expect(ukFew[0]).toContain('3 записи на складі');
    expect(ukMany[0]).toContain('5 записів на складі');
    expect(uk221[0]).toContain('221 запис на складі');

    const ukShortOne = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'shortSalesHistory', count: 1 },
    ]);
    const ukShortFew = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'shortSalesHistory', count: 3 },
    ]);
    const ukShortMany = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'shortSalesHistory', count: 5 },
    ]);
    expect(ukShortOne[0]).toContain('лише 1 день');
    expect(ukShortFew[0]).toContain('лише 3 дні');
    expect(ukShortMany[0]).toContain('лише 5 днів');

    const ukCold = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'coldArchiveDemand' },
    ]);
    expect(ukCold[0]).toContain('холодним річним очищенням');
  });

  it('translates aging buckets, demand patterns, stock states, and unassigned sentinels', async () => {
    expect(translateAgeBucket(i18n.t.bind(i18n), 'unknown')).toBe('Unknown age');
    expect(translateDemandPattern(i18n.t.bind(i18n), 'sparse')).toBe('sparse');
    expect(translateStockState(i18n.t.bind(i18n), 'low_stock', 'filter')).toBe(
      'Low stock (1–2 avail)',
    );
    expect(translateAssignedName(i18n.t.bind(i18n), 'Unassigned supplier')).toBe(
      'Unassigned supplier',
    );
    expect(
      translateLocationLabel(i18n.t.bind(i18n), 'Unassigned warehouse', 'Unassigned location'),
    ).toBe('Unassigned warehouse / Unassigned location');
    expect(translateDemandPattern(i18n.t.bind(i18n), 'custom-pattern')).toBe(
      'custom-pattern',
    );

    await i18n.changeLanguage('uk');
    expect(translateAgeBucket(i18n.t.bind(i18n), 'unknown')).toBe('Невідомий термін');
    expect(translateAgeBucket(i18n.t.bind(i18n), '0-30')).toBe('0–30 днів');
    expect(translateDemandPattern(i18n.t.bind(i18n), 'sparse')).toBe('рідкісний');
    expect(translateStockState(i18n.t.bind(i18n), 'low_stock', 'filter')).toBe(
      'Низький залишок (1–2 доступно)',
    );
    expect(translateAssignedName(i18n.t.bind(i18n), 'Unassigned supplier')).toBe(
      'Без постачальника',
    );
    expect(translateAssignedName(i18n.t.bind(i18n), 'Unassigned warehouse')).toBe(
      'Без складу',
    );
    expect(translateAssignedName(i18n.t.bind(i18n), 'Unassigned location')).toBe(
      'Без локації',
    );
    expect(
      translateLocationLabel(i18n.t.bind(i18n), 'Unassigned warehouse', 'A1'),
    ).toBe('Без складу / A1');
    expect(translateDemandPattern(i18n.t.bind(i18n), 'custom-pattern')).toBe(
      'custom-pattern',
    );
  });
});
