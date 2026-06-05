import { describe, expect, it } from 'vitest';
import type { Sale } from '../../../entities/sale/model/types';
import {
  isIssueWithoutPaymentBlockedForSale,
  isRepairStatusChangeLockedByStock,
  type OrderLineItem,
} from './orders-workspace-shared';

const repairProductLineItems: OrderLineItem[] = [
  {
    id: 'line-product-1',
    kind: 'product',
    productId: 'product-1',
    name: 'Wireless mouse M22',
    price: 500,
    quantity: 1,
    warrantyPeriod: 0,
    serialNumbers: ['S000003'],
  },
  {
    id: 'line-product-2',
    kind: 'product',
    productId: 'product-2',
    name: 'Wireless mouse M22',
    price: 500,
    quantity: 1,
    warrantyPeriod: 0,
    serialNumbers: ['S000004'],
  },
];

const repairSale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'repair-1',
  recordNumber: 'r000003',
  saleDate: '2026-06-05T00:00:00.000Z',
  quantity: 1,
  salePrice: 0,
  kind: 'repair',
  status: 'ready',
  paidAmount: 1000,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: repairProductLineItems,
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'new',
  },
  product: {
    id: '',
    article: '',
    name: 'Repair device',
    serialNumber: '',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
  ...overrides,
});

describe('repair stock status guards', () => {
  it('does not block issuing a repair order with bound stock serials', () => {
    expect(
      isRepairStatusChangeLockedByStock(
        repairSale(),
        'issued',
        repairProductLineItems,
      ),
    ).toBe(false);
  });

  it('does not block marking a repair order with bound stock serials as paid', () => {
    expect(
      isRepairStatusChangeLockedByStock(
        repairSale(),
        'paid',
        repairProductLineItems,
      ),
    ).toBe(false);
  });

  it('blocks refusal statuses while bound stock serials are still attached', () => {
    expect(
      isRepairStatusChangeLockedByStock(
        repairSale(),
        'clientRejected',
        repairProductLineItems,
      ),
    ).toBe(true);
    expect(
      isRepairStatusChangeLockedByStock(
        repairSale(),
        'issuedWithoutRepair',
        repairProductLineItems,
      ),
    ).toBe(true);
  });

  it('does not block refusal statuses after stock serials are unbound', () => {
    const unboundItems = repairProductLineItems.map((item) => ({
      ...item,
      serialNumbers: [],
    }));

    expect(
      isRepairStatusChangeLockedByStock(
        repairSale({ lineItems: unboundItems }),
        'clientRejected',
        unboundItems,
      ),
    ).toBe(false);
  });

  it('still blocks issuing a repair order with products when payment remains', () => {
    expect(
      isIssueWithoutPaymentBlockedForSale(
        repairSale({ paidAmount: 500 }),
        'issued',
        repairProductLineItems,
        500,
      ),
    ).toBe(true);
  });
});
