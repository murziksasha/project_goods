import { describe, expect, it } from 'vitest';
import type { Supplier } from './types';
import {
  getPrimarySupplierPhone,
  getSupplierPhones,
  mapSupplierFormToPayload,
  toSupplierForm,
} from './forms';

const supplier = (patch: Partial<Supplier> = {}): Supplier => ({
  id: 'supplier-1',
  name: 'Main Parts',
  phone: '+380501111111',
  phones: ['+380501111111'],
  supplierOrder: 'SO-1',
  note: '',
  isActive: true,
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  ...patch,
});

describe('supplier phone form helpers', () => {
  it('reads phones array and falls back to legacy phone', () => {
    expect(getSupplierPhones(supplier({
      phones: ['+380501111111', '+380502222222'],
    }))).toEqual(['+380501111111', '+380502222222']);

    expect(getSupplierPhones(supplier({
      phone: '+380503333333',
      phones: [],
    }))).toEqual(['+380503333333']);
  });

  it('maps supplier to form with phones list', () => {
    expect(toSupplierForm(supplier({
      phones: ['+380501111111', '+380502222222'],
    }))).toEqual({
      phone: '+380501111111',
      phones: ['+380501111111', '+380502222222'],
      name: 'Main Parts',
      note: '',
      supplierOrder: 'SO-1',
      isActive: true,
    });
  });

  it('mapSupplierFormToPayload keeps primary first and dedupes phones', () => {
    const payload = mapSupplierFormToPayload({
      name: ' Supplier ',
      phone: '+380501111111',
      phones: ['+380501111111', ' +380502222222 ', '+380501111111'],
      note: ' note ',
      supplierOrder: ' SO-1 ',
      isActive: true,
    });

    expect(payload).toEqual({
      phone: '+380501111111',
      phones: ['+380501111111', '+380502222222'],
      name: 'Supplier',
      note: 'note',
      supplierOrder: 'SO-1',
      isActive: true,
    });
    expect(getPrimarySupplierPhone(supplier({
      phones: payload.phones,
      phone: payload.phone,
    }))).toBe('+380501111111');
  });
});