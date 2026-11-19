import { describe, expect, it } from 'vitest';
import {
  addSaleKitItems,
  expandSaleKitItems,
  formatSaleKitLabel,
  removeSaleKitItem,
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

describe('kit list editing helpers', () => {
  it('adds typed items, splitting commas and ignoring blanks and duplicates', () => {
    expect(addSaleKitItems(['ЗП'], ' сумка, зп , ,Сумка ')).toEqual({
      kit: ['ЗП', 'сумка'],
      added: ['сумка'],
    });
    expect(addSaleKitItems(['ЗП'], '   ')).toEqual({ kit: ['ЗП'], added: [] });
  });

  it('keeps the 20 item limit', () => {
    const full = Array.from({ length: 20 }, (_, index) => `item ${index}`);
    expect(addSaleKitItems(full, 'extra').added).toEqual([]);
  });

  it('turns leftover input into the last item on save', () => {
    expect(addSaleKitItems(['ЗП', 'сумка'], 'чохол').kit).toEqual(['ЗП', 'сумка', 'чохол']);
  });

  it('removes an item by index', () => {
    expect(removeSaleKitItem(['ЗП', 'сумка'], 0)).toEqual({ kit: ['сумка'], removed: 'ЗП' });
    expect(removeSaleKitItem(['ЗП'], 5)).toEqual({ kit: ['ЗП'], removed: undefined });
  });

  it('splits legacy single-string kits by commas for display', () => {
    expect(expandSaleKitItems(['ЗП, сумка'])).toEqual(['ЗП', 'сумка']);
    expect(getSaleKit({ kit: ['плита, кабель'], note: '' })).toEqual(['плита', 'кабель']);
    expect(getSaleKit({ kit: [], note: '(kits: ЗП, сумка)' })).toEqual(['ЗП', 'сумка']);
  });

  it('joins label kits with slashes', () => {
    expect(formatSaleKitLabel(['ЗП', 'сумка'])).toBe('ЗП / сумка');
    expect(formatSaleKit(['ЗП', 'сумка'])).toBe('ЗП, сумка');
  });
});
