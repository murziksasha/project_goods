import { describe, expect, it } from 'vitest';
import type { Supplier } from '../../../entities/supplier/model/types';
import { getSupplierSuggestions } from './supplier-suggestions';

const createSupplier = (
  id: string,
  name: string,
  phone: string,
  isActive: boolean,
): Supplier => ({
  id,
  name,
  phone,
  isActive,
  note: '',
  supplierOrder: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('getSupplierSuggestions', () => {
  it('does not suggest inactive suppliers even when query matches', () => {
    const suppliers: Supplier[] = [
      createSupplier('1', 'Prom.ua', '+38034111', false),
      createSupplier('2', 'Prom Active', '+38034222', true),
    ];

    const suggestions = getSupplierSuggestions(suppliers, 'prom');

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.id).toBe('2');
  });
});

