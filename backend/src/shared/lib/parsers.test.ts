import { describe, expect, it } from 'vitest';
import { normalizeEmployeePayload, normalizeProductPayload } from './parsers';

describe('normalizeProductPayload', () => {
  it('normalizes scalar fields and filters invalid sale prices', () => {
    const result = normalizeProductPayload({
      name: '  Mouse  ',
      article: ' ab-1 ',
      serialNumber: ' sn-99 ',
      price: '2500',
      salePriceOptions: '1200, -1, foo, 1500',
      quantity: '3',
      note: '  note ',
      reservedQuantity: '',
      purchasePlace: ' store ',
      purchaseDate: '2026-01-01',
      warrantyPeriod: undefined,
    });

    expect(result).toMatchObject({
      name: 'Mouse',
      article: 'AB-1',
      serialNumber: 'SN-99',
      price: 2500,
      salePriceOptions: [1200, 1500],
      quantity: 3,
      note: 'note',
      reservedQuantity: 0,
      purchasePlace: 'store',
      warrantyPeriod: 0,
    });
    expect(result.purchaseDate).toBeInstanceOf(Date);
  });
});

describe('normalizeEmployeePayload', () => {
  it('falls back to role defaults and normalizes auth/contact fields', () => {
    const result = normalizeEmployeePayload({
      name: '  Jane ',
      phone: ' +38 (050) 123-45-67 ',
      email: ' ADMIN@MAIL.COM ',
      username: ' BOSS ',
      password: ' pass ',
      role: 'manager',
      permissions: [],
      isActive: 'true',
      note: ' hi ',
    });

    expect(result).toMatchObject({
      name: 'Jane',
      phone: '+380501234567',
      email: 'admin@mail.com',
      username: 'boss',
      password: 'pass',
      role: 'manager',
      permissions: ['orders.view', 'orders.manage', 'clients.manage'],
      isActive: true,
      note: 'hi',
    });
  });
});
