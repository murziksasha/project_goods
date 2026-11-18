import { describe, expect, it } from 'vitest';
import {
  areSaleKitsEqual,
  formatSaleKit,
  getSaleKit,
  normalizeSaleKit,
  parseLegacySaleKitFromNote,
  splitSaleKitText,
} from './sale-kit';

describe('sale kit helpers', () => {
  it('normalizes items: trims, collapses spaces, drops empty and duplicate items', () => {
    expect(normalizeSaleKit(['  ЗП ', '', 'сумка', 'зп', '  ', 'чохол   шкіряний'])).toEqual([
      'ЗП',
      'сумка',
      'чохол шкіряний',
    ]);
    expect(normalizeSaleKit(undefined)).toEqual([]);
    expect(normalizeSaleKit([1, null, 'ok'] as unknown[])).toEqual(['ok']);
  });

  it('splits free text by commas, semicolons, pipes and new lines', () => {
    expect(splitSaleKitText('ЗП, сумка; кабель | чохол\nкоробка')).toEqual([
      'ЗП',
      'сумка',
      'кабель',
      'чохол',
      'коробка',
    ]);
  });

  it('parses the legacy (kits: ...) note of old orders', () => {
    expect(parseLegacySaleKitFromNote('(kits: ЗП, сумка)\nНе вмикається\nType: repair')).toEqual([
      'ЗП',
      'сумка',
    ]);
    expect(parseLegacySaleKitFromNote('Type: repair')).toEqual([]);
    expect(parseLegacySaleKitFromNote(undefined)).toEqual([]);
  });

  it('prefers the kit field and falls back to the note', () => {
    expect(getSaleKit({ kit: ['кабель'], note: '(kits: ЗП)' })).toEqual(['кабель']);
    expect(getSaleKit({ kit: [], note: '(kits: ЗП)' })).toEqual(['ЗП']);
    expect(getSaleKit({ note: '(kits: ЗП)' })).toEqual(['ЗП']);
    expect(getSaleKit({ kit: [], note: '' })).toEqual([]);
  });

  it('formats and compares kits', () => {
    expect(formatSaleKit(['ЗП', 'сумка'])).toBe('ЗП, сумка');
    expect(formatSaleKit([])).toBe('');
    expect(areSaleKitsEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(areSaleKitsEqual(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
