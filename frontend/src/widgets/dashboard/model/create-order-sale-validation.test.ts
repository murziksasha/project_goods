import { describe, expect, it } from 'vitest';
import {
  getCreateOrderSaleTitle,
  validateCreateOrderSaleLineItems,
} from './create-order-sale-validation';

describe('create-order-sale-validation', () => {
  it('returns the first product name as the sale title', () => {
    expect(
      getCreateOrderSaleTitle([{ name: 'Cable' }], [{ name: 'Setup' }]),
    ).toBe('Cable');
  });

  it('falls back to the first service name when products are absent', () => {
    expect(getCreateOrderSaleTitle([], [{ name: 'Diagnostics' }])).toBe(
      'Diagnostics',
    );
  });

  it('requires at least one product or service line', () => {
    expect(validateCreateOrderSaleLineItems([], [])).toBe(
      'dashboard.actions.errors.saleLineItemsRequired',
    );
    expect(validateCreateOrderSaleLineItems([], [{ name: 'Setup' }])).toBeNull();
    expect(validateCreateOrderSaleLineItems([{ name: 'Cable' }], [])).toBeNull();
  });
});