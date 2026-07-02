import { describe, expect, it } from 'vitest';
import {
  resolveSupplierOrderModalLocks,
  type SupplierOrderModalLockInput,
} from './supplier-order-utils';

const baseLockInput = (): SupplierOrderModalLockInput => ({
  status: 'approved',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      catalogProductId: 'cat-1',
      productName: 'Cable',
      quantity: 5,
      price: 100,
      receiptStatus: 'new',
    },
  ],
});

describe('resolveSupplierOrderModalLocks', () => {
  it('allows take-on-charge and cancel for approved pending orders', () => {
    const locks = resolveSupplierOrderModalLocks(baseLockInput());

    expect(locks).toEqual({
      isContentLocked: false,
      isTakeOnChargeLocked: false,
      isCancelLocked: false,
    });
  });

  it('locks content only for approved paid orders', () => {
    const locks = resolveSupplierOrderModalLocks({
      ...baseLockInput(),
      paymentStatus: 'paid',
    });

    expect(locks).toEqual({
      isContentLocked: true,
      isTakeOnChargeLocked: false,
      isCancelLocked: false,
    });
  });

  it('locks content only for approved without_payment orders', () => {
    const locks = resolveSupplierOrderModalLocks({
      ...baseLockInput(),
      paymentStatus: 'without_payment',
    });

    expect(locks).toEqual({
      isContentLocked: true,
      isTakeOnChargeLocked: false,
      isCancelLocked: false,
    });
  });

  it('locks all actions for stocked orders', () => {
    const locks = resolveSupplierOrderModalLocks({
      ...baseLockInput(),
      status: 'stocked',
      receiptStatus: 'received',
      items: [
        {
          ...baseLockInput().items[0],
          receiptStatus: 'received',
        },
      ],
    });

    expect(locks).toEqual({
      isContentLocked: true,
      isTakeOnChargeLocked: true,
      isCancelLocked: true,
    });
  });

  it('locks all actions for received orders', () => {
    const locks = resolveSupplierOrderModalLocks({
      ...baseLockInput(),
      receiptStatus: 'received',
      items: [
        {
          ...baseLockInput().items[0],
          receiptStatus: 'received',
        },
      ],
    });

    expect(locks).toEqual({
      isContentLocked: true,
      isTakeOnChargeLocked: true,
      isCancelLocked: true,
    });
  });

  it('locks all actions for cancelled orders', () => {
    const locks = resolveSupplierOrderModalLocks({
      ...baseLockInput(),
      status: 'cancelled',
      paymentStatus: 'cancelled',
    });

    expect(locks).toEqual({
      isContentLocked: true,
      isTakeOnChargeLocked: true,
      isCancelLocked: true,
    });
  });

  it('locks take-on-charge for item-scoped received suborders', () => {
    const locks = resolveSupplierOrderModalLocks(
      {
        ...baseLockInput(),
        receiptStatus: 'approved',
        items: [
          {
            ...baseLockInput().items[0],
            receiptStatus: 'new',
          },
        ],
      },
      { itemReceiptStatus: 'received' },
    );

    expect(locks).toEqual({
      isContentLocked: true,
      isTakeOnChargeLocked: true,
      isCancelLocked: false,
    });
  });

  it('returns unlocked defaults for missing order', () => {
    expect(resolveSupplierOrderModalLocks(null)).toEqual({
      isContentLocked: false,
      isTakeOnChargeLocked: false,
      isCancelLocked: false,
    });
  });
});