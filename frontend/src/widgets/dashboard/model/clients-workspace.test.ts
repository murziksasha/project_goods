import { describe, expect, it } from 'vitest';
import type { Sale } from '../../../entities/sale/model/types';
import { getClientStatsMap } from './clients-workspace';

const baseSale: Sale = {
  id: 'sale-1',
  recordNumber: 'r000001',
  saleDate: '2026-05-12T10:00:00.000Z',
  quantity: 9,
  salePrice: 999,
  kind: 'sale',
  status: 'paid',
  paidAmount: 180,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [
    {
      id: 'line-1',
      kind: 'product',
      name: 'Part',
      price: 80,
      quantity: 2,
      warrantyPeriod: 0,
    },
    {
      id: 'line-2',
      kind: 'service',
      name: 'Work',
      price: 40,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
  discount: { mode: 'amount', value: 20 },
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380501111111',
    status: 'new',
  },
  product: null,
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-05-12T10:00:00.000Z',
  updatedAt: '2026-05-12T10:00:00.000Z',
};

describe('getClientStatsMap', () => {
  it('uses line items and discounts instead of salePrice * quantity', () => {
    const statsByClient = getClientStatsMap([baseSale]);
    const stats = statsByClient.get('client-1');

    expect(stats?.visits).toBe(1);
    expect(stats?.income).toBe(180);
    expect(stats?.salesCount).toBe(1);
  });

  it('aggregates multiple sales for the same client', () => {
    const secondSale: Sale = {
      ...baseSale,
      id: 'sale-2',
      recordNumber: 'r000002',
      discount: { mode: 'amount', value: 0 },
      lineItems: [
        {
          id: 'line-3',
          kind: 'product',
          name: 'Cable',
          price: 50,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    };

    const statsByClient = getClientStatsMap([baseSale, secondSale]);
    const stats = statsByClient.get('client-1');

    expect(stats?.visits).toBe(2);
    expect(stats?.income).toBe(230);
  });
});