import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { Sale } from '../../../entities/sale/model/types';
import {
  getSaleClientDisplayName,
  getSaleClientSearchValues,
  isRapidSaleClientLinkDisabled,
} from './sale-client-display';

const t = ((key: string) =>
  key === 'orders.rapidSale.clientLabel' ? 'Rapid sale' : key) as TFunction;

const sale = (patch: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  recordNumber: 'r000001',
  saleDate: '2026-01-01T00:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'new',
  paidAmount: 0,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'client-1',
    name: 'Ivan',
    phone: '+380000000000',
    status: 'regular',
  },
  product: null,
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('sale-client-display', () => {
  it('shows rapid sale label for rapid sales', () => {
    expect(getSaleClientDisplayName(sale({ isRapidSale: true }), t)).toBe('Rapid sale');
    expect(getSaleClientDisplayName(sale(), t)).toBe('Ivan');
    expect(isRapidSaleClientLinkDisabled(sale({ isRapidSale: true }))).toBe(true);
    expect(isRapidSaleClientLinkDisabled(sale())).toBe(false);
  });

  it('includes rapid sale search aliases', () => {
    expect(getSaleClientSearchValues(sale({ isRapidSale: true }), t)).toEqual([
      'Rapid sale',
      'rapid sale',
      'rapid sale',
    ]);
  });
});