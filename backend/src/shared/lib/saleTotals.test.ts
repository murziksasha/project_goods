import { describe, expect, it } from 'vitest';
import { getSaleDocumentTotal } from './saleTotals';

const date = new Date('2026-06-01T09:00:00.000Z');

const makeSale = (patch: Record<string, unknown> = {}) =>
  ({
    _id: 'sale-1',
    recordNumber: 'r000001',
    saleDate: date,
    quantity: 9,
    salePrice: 999,
    kind: 'sale',
    status: 'paid',
    paidAmount: 0,
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
        serialNumbers: [],
      },
      {
        id: 'line-2',
        kind: 'service',
        name: 'Work',
        price: 40,
        quantity: 1,
        warrantyPeriod: 0,
        serialNumbers: [],
      },
    ],
    discount: { mode: 'amount', value: 20 },
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

describe('getSaleDocumentTotal', () => {
  it('uses line items and discounts instead of salePrice * quantity', () => {
    expect(getSaleDocumentTotal(makeSale())).toBe(180);
  });

  it('falls back to salePrice * quantity when line items are empty', () => {
    expect(
      getSaleDocumentTotal(
        makeSale({
          quantity: 2,
          salePrice: 100,
          lineItems: [],
          discount: { mode: 'amount', value: 0 },
        }),
      ),
    ).toBe(200);
  });
});