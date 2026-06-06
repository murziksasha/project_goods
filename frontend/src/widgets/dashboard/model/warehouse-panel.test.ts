import { describe, expect, it } from 'vitest';
import {
  defaultWarehouseVisibleColumns,
  getReceiptPaymentStatusClass,
  getReceiptPaymentStatusLabel,
  getWarehouseBadgeAccentStyle,
  getWarehouseColumnLabel,
  toServiceCenterForm,
  toWarehouseForm,
} from './warehouse-panel';

describe('warehouse panel helpers', () => {
  it('maps receipt payment statuses to labels and class names', () => {
    expect(getReceiptPaymentStatusLabel('pending')).toBe('Awaiting payment');
    expect(getReceiptPaymentStatusLabel('without_payment')).toBe(
      'Issued without payment',
    );
    expect(getReceiptPaymentStatusClass('paid')).toBe(
      'receipt-payment-status receipt-payment-status-paid',
    );
  });

  it('builds modal form defaults from optional settings entities', () => {
    expect(toServiceCenterForm()).toEqual({
      name: '',
      color: '#000000',
      address: '',
      phone: '+380',
    });

    expect(
      toWarehouseForm({
        id: 'w-1',
        name: 'Main',
        isActive: false,
        serviceCenterId: 'sc-1',
        receiptAddress: 'Kyiv',
        receiptPhone: '+3801',
        locations: [{ id: 'l-1', name: 'A1' }],
      }),
    ).toEqual({
      name: 'Main',
      isActive: false,
      serviceCenterId: 'sc-1',
      receiptAddress: 'Kyiv',
      receiptPhone: '+3801',
      locations: ['A1'],
    });
  });

  it('keeps column labels in sync with configured columns', () => {
    const allColumns = [
      ...defaultWarehouseVisibleColumns.stock,
      ...defaultWarehouseVisibleColumns.receipts,
    ];

    expect(allColumns.map(getWarehouseColumnLabel)).not.toContain('');
  });

  it('builds badge accent CSS variables for valid colors only', () => {
    expect(getWarehouseBadgeAccentStyle('not-a-color')).toBeUndefined();
    expect(getWarehouseBadgeAccentStyle('#336699')).toMatchObject({
      '--warehouse-badge-accent': '#336699',
      '--warehouse-badge-accent-bg': 'rgba(51, 102, 153, 0.14)',
      '--warehouse-badge-accent-border': 'rgba(51, 102, 153, 0.34)',
    });
  });
});
