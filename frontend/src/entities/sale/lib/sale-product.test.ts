import { describe, expect, it } from 'vitest';
import type { Sale } from '../model/types';
import { getSaleProductName, getSaleProductSnapshot } from './sale-product';

const sale = (patch: Partial<Sale> = {}): Sale =>
  ({
    id: 'sale-1',
    recordNumber: 's000001',
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
    client: { id: 'client-1', name: 'Client', phone: '+380000000001' },
    ...patch,
  }) as Sale;

describe('sale-product helpers', () => {
  it('uses the first service line item when no product lines exist', () => {
    const serviceOnlySale = sale({
      lineItems: [
        {
          id: 'service-1',
          kind: 'service',
          name: 'Screen cleaning',
          price: 150,
          quantity: 1,
          warrantyPeriod: 1,
        },
      ],
    });

    expect(getSaleProductName(serviceOnlySale)).toBe('Screen cleaning');
    expect(getSaleProductSnapshot(serviceOnlySale).name).toBe('Screen cleaning');
  });

  it('prefers product line items over service line items', () => {
    const mixedSale = sale({
      lineItems: [
        {
          id: 'product-1',
          kind: 'product',
          name: 'Cable',
          price: 100,
          quantity: 1,
          warrantyPeriod: 0,
        },
        {
          id: 'service-1',
          kind: 'service',
          name: 'Setup',
          price: 50,
          quantity: 1,
          warrantyPeriod: 1,
        },
      ],
    });

    expect(getSaleProductName(mixedSale)).toBe('Cable');
  });
});