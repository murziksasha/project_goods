import { describe, expect, it } from 'vitest';
import { formatSale } from './formatters';

const date = new Date('2026-06-01T09:00:00.000Z');

const makeSale = (patch: Record<string, unknown> = {}) =>
  ({
    _id: 'sale-1',
    recordNumber: 'R000001',
    saleDate: date,
    quantity: 1,
    salePrice: 100,
    kind: 'repair',
    status: 'new',
    paidAmount: 0,
    note: '',
    timeline: [],
    paymentHistory: [],
    lineItems: [],
    discount: { mode: 'amount', value: 0 },
    client: 'client-1',
    clientSnapshot: {
      name: 'Client',
      phone: '+380000000000',
      status: 'new',
    },
    product: null,
    productSnapshot: {
      article: 'ART-1',
      name: 'Device',
      serialNumber: '',
    },
    manager: null,
    master: null,
    issuedBy: null,
    createdAt: date,
    updatedAt: date,
    ...patch,
  }) as never;

describe('formatSale favorite state', () => {
  it('includes favorite state when present', () => {
    expect(formatSale(makeSale({ isFavorite: true })).isFavorite).toBe(true);
  });

  it('defaults missing favorite state to false for old documents', () => {
    expect(formatSale(makeSale()).isFavorite).toBe(false);
  });
});
