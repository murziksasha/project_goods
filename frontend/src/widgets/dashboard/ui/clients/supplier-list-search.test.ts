import { describe, expect, it } from 'vitest';
import type { Supplier } from '../../../../entities/supplier';
import { supplierMatchesListQuery } from './supplier-list-search';

const supplier = (patch: Partial<Supplier> = {}): Supplier => ({
  id: 'supplier-1',
  name: 'Main Parts',
  phone: '+380671112233',
  phones: ['+380671112233', '+380 (63) 111-22-33'],
  supplierOrder: 'SO-1',
  note: 'call before noon',
  isActive: true,
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  ...patch,
});

describe('supplierMatchesListQuery', () => {
  it('matches additional phones across Ukrainian and punctuated forms', () => {
    const row = supplier();
    expect(supplierMatchesListQuery(row, '+38063')).toBe(true);
    expect(supplierMatchesListQuery(row, '0631112233')).toBe(true);
    expect(supplierMatchesListQuery(row, '(063) 111-22-33')).toBe(true);
    expect(supplierMatchesListQuery(row, '1112233')).toBe(true);
  });

  it('does not phone-match a bare country code or a lettered code', () => {
    const row = supplier();
    expect(supplierMatchesListQuery(row, '+380')).toBe(false);
    expect(supplierMatchesListQuery(row, 'S000123')).toBe(false);
    expect(supplierMatchesListQuery(row, 'ART-1')).toBe(false);
  });

  it('still matches name, note, and supplier order as text', () => {
    const row = supplier();
    expect(supplierMatchesListQuery(row, 'parts')).toBe(true);
    expect(supplierMatchesListQuery(row, 'before noon')).toBe(true);
    expect(supplierMatchesListQuery(row, 'SO-1')).toBe(true);
    expect(supplierMatchesListQuery(row, '')).toBe(true);
  });
});
