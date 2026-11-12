import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../../shared/i18n/config';
import en from '../../../../shared/i18n/locales/en.json';
import uk from '../../../../shared/i18n/locales/uk.json';
import {
  translateCoverageWarnings,
  translateRepairStatus,
  translateTechnicianName,
  translateTurnaroundWarning,
} from './orders-information-i18n';

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

describe('orders information i18n helpers', () => {
  it('keeps identical key sets for the new translation namespaces', () => {
    const namespaces = [
      'orders.information',
      'analytics.primitives',
      'common.reportExport',
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

  it('maps backend warning codes and known English free text', async () => {
    const coded = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'untrackedCompletions', count: 221 },
    ]);
    expect(coded[0]).toContain('221 closed repair(s) lack structured completion timestamps');

    const fromText = translateCoverageWarnings(i18n.t.bind(i18n), [
      'Cold yearly archive purges exist; period analytics cover live persisted repairs only.',
      '1 closed repair lacks structured completion timestamp.',
    ]);
    expect(fromText[0]).toContain('Cold yearly archive purges exist');
    // Unknown / slightly different free text is left as-is
    expect(fromText[1]).toBe('1 closed repair lacks structured completion timestamp.');

    const turnaround = translateTurnaroundWarning(
      i18n.t.bind(i18n),
      'Legacy closed orders without structured completion timestamps are excluded from turnaround metrics.',
      'legacyCompletionsExcluded',
    );
    expect(turnaround).toBe(
      'Legacy closed orders without structured completion timestamps are excluded from turnaround metrics.',
    );

    await i18n.changeLanguage('uk');
    const ukOne = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'untrackedCompletions', count: 1 },
    ]);
    const ukFew = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'untrackedCompletions', count: 3 },
    ]);
    const ukMany = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'untrackedCompletions', count: 221 },
    ]);
    // 221 uses the "one" form in Ukrainian (n % 10 === 1 && n % 100 !== 11)
    expect(ukOne[0]).toContain('1 закритий ремонт');
    expect(ukFew[0]).toContain('3 закриті ремонти');
    expect(ukMany[0]).toContain('221 закритий ремонт');
    const ukFive = translateCoverageWarnings(i18n.t.bind(i18n), [], [
      { code: 'untrackedCompletions', count: 5 },
    ]);
    expect(ukFive[0]).toContain('5 закритих ремонтів');
    const ukTurnaround = translateTurnaroundWarning(
      i18n.t.bind(i18n),
      'Legacy closed orders without structured completion timestamps are excluded from turnaround metrics.',
      'legacyCompletionsExcluded',
    );
    expect(ukTurnaround).toContain('Застарілі закриті замовлення');
  });

  it('translates technician sentinel names and known repair statuses', async () => {
    expect(translateTechnicianName(i18n.t.bind(i18n), 'Unassigned', null)).toBe(
      'Unassigned',
    );
    expect(translateRepairStatus(i18n.t.bind(i18n), 'inRepair')).toBe('In repair');

    await i18n.changeLanguage('uk');
    expect(translateTechnicianName(i18n.t.bind(i18n), 'Unassigned', null)).toBe(
      'Без майстра',
    );
    expect(translateRepairStatus(i18n.t.bind(i18n), 'inRepair')).toBe('В ремонті');
    expect(translateRepairStatus(i18n.t.bind(i18n), 'unknownStatus')).toBe(
      'unknownStatus',
    );
  });
});
