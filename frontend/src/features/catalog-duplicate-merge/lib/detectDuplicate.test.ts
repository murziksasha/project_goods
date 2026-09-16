import { describe, expect, it } from 'vitest';
import {
  findCatalogDuplicate,
  normalizeCatalogName,
  normalizeClientId,
} from './detectDuplicate';

describe('detectDuplicate', () => {
  it('normalizes names by trimming, collapsing spaces, and lowercasing', () => {
    expect(normalizeCatalogName('  iPhone   13   Pro  ')).toBe(
      'iphone 13 pro',
    );
    expect(normalizeCatalogName(null)).toBe('');
  });

  it('normalizes clientId by trimming string representations', () => {
    expect(normalizeClientId('  client-1  ')).toBe('client-1');
    expect(normalizeClientId(null)).toBe('');
    expect(normalizeClientId(undefined)).toBe('');
  });

  it('finds duplicate when name matches case-insensitively with extra whitespace', () => {
    const items = [
      { id: '1', name: 'iPhone 13' },
      { id: '2', name: 'Samsung Galaxy' },
    ];

    const duplicate = findCatalogDuplicate({
      currentId: '99',
      name: '  iphone   13 ',
      items,
    });

    expect(duplicate).toEqual(items[0]);
  });

  it('excludes current record from duplicate detection', () => {
    const items = [{ id: '1', name: 'iPhone 13' }];

    const duplicate = findCatalogDuplicate({
      currentId: '1',
      name: 'iphone 13',
      items,
    });

    expect(duplicate).toBeNull();
  });

  it('does not match partial or fuzzy names', () => {
    const items = [{ id: '1', name: 'iPhone 13 Pro' }];

    expect(
      findCatalogDuplicate({
        currentId: '2',
        name: 'iPhone 13',
        items,
      }),
    ).toBeNull();

    expect(
      findCatalogDuplicate({
        currentId: '2',
        name: 'iPhone 13 Pro Max',
        items,
      }),
    ).toBeNull();
  });

  it('handles client-scoped duplicate detection for client devices', () => {
    const items = [
      { id: '1', name: 'MacBook Air', clientId: 'client-A' },
      { id: '2', name: 'MacBook Air', clientId: 'client-B' },
      { id: '3', name: 'MacBook Air', clientId: null },
    ];

    // Same name, different client -> no duplicate
    expect(
      findCatalogDuplicate({
        currentId: '4',
        name: 'MacBook Air',
        scopeByClient: true,
        clientId: 'client-C',
        items,
      }),
    ).toBeNull();

    // Same name, matching client-A -> duplicate
    expect(
      findCatalogDuplicate({
        currentId: '4',
        name: 'macbook air',
        scopeByClient: true,
        clientId: 'client-A',
        items,
      }),
    ).toEqual(items[0]);

    // Both unassigned (null / undefined / empty) -> duplicate
    expect(
      findCatalogDuplicate({
        currentId: '4',
        name: 'MacBook Air',
        scopeByClient: true,
        clientId: undefined,
        items,
      }),
    ).toEqual(items[2]);
  });
});
