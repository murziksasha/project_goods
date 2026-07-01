import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../product/model';
import { Sale } from './model';
import { returnSaleLineItemToStock } from './service';
import { leanResult, withFormatSaleFields } from './test-helpers';

const lineItem = {
  id: 'li-1',
  kind: 'product',
  productId: '507f1f77bcf86cd799439012',
  name: 'Wireless Mouse',
  price: 350,
  quantity: 1,
  warrantyPeriod: 0,
  serialNumbers: ['S000001'],
};

const buildSale = (kind: 'repair' | 'sale') =>
  withFormatSaleFields({
    _id: '507f1f77bcf86cd799439012',
    id: '507f1f77bcf86cd799439012',
    kind,
    status: 'issued',
    paidAmount: 0,
    quantity: 1,
    salePrice: 350,
    product: null,
    productSnapshot: { name: 'Item', serialNumber: '', article: 'SALE' },
    lineItems: [lineItem],
    discount: { mode: 'amount', value: 0 },
    timeline: [],
  });

let currentSale: any;

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(Sale, 'findById').mockImplementation(
    () => leanResult(currentSale) as never,
  );
  vi.spyOn(Sale, 'findByIdAndUpdate').mockImplementation(
    (_id: unknown, update: any) =>
      leanResult(
        withFormatSaleFields({
          ...currentSale,
          ...update,
          lineItems: update.lineItems ?? currentSale.lineItems,
        }),
      ) as never,
  );
  vi.spyOn(Product, 'findByIdAndUpdate').mockReturnValue(
    leanResult({
      _id: lineItem.productId,
      purchasePlace: 'Service center',
    }) as never,
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  currentSale = buildSale('sale');
  installSpies();
});

describe('returnSaleLineItemToStock', () => {
  it('allows returning product line item to stock for repair orders', async () => {
    currentSale = buildSale('repair');

    await returnSaleLineItemToStock('507f1f77bcf86cd799439011', {
      lineItemId: lineItem.id,
      warehouse: 'Service center',
      author: 'QA',
    });

    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
      lineItem.productId,
      {
        $inc: { quantity: lineItem.quantity },
        $set: { purchasePlace: 'Service center' },
      },
      { returnDocument: 'before' },
    );
    expect(Sale.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('keeps return-to-stock flow working for sale orders', async () => {
    currentSale = buildSale('sale');

    await returnSaleLineItemToStock('507f1f77bcf86cd799439011', {
      lineItemId: lineItem.id,
      warehouse: 'Service center',
      author: 'QA',
    });

    expect(Sale.findByIdAndUpdate).toHaveBeenCalled();
  });
});