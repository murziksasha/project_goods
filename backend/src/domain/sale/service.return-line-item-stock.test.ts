import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  saleModel,
  productModel,
} = vi.hoisted(() => ({
  saleModel: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  productModel: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('./model', () => ({
  Sale: saleModel,
}));

vi.mock('../client/model', () => ({
  Client: {},
}));

vi.mock('../employee/model', () => ({
  Employee: {
    findById: vi.fn(),
  },
}));

vi.mock('../catalog-product/model', () => ({
  CatalogProduct: {},
}));

vi.mock('../product/model', () => ({
  Product: productModel,
}));

vi.mock('../../shared/lib/formatters', () => ({
  formatProduct: vi.fn((value) => value),
  formatSale: vi.fn((value) => value),
}));

vi.mock('../../shared/lib/parsers', () => ({
  normalizeSalePayload: vi.fn(),
}));

vi.mock('../../shared/lib/query', () => ({
  isValidObjectIdOrThrow: vi.fn(),
}));

vi.mock('../sequence/service', () => ({
  getNextRecordNumber: vi.fn(),
}));

vi.mock('../finance/service', () => ({
  createFinanceTransaction: vi.fn(),
}));

vi.mock('../../shared/lib/errors', () => ({
  assertNotStale: vi.fn(),
}));

vi.mock('../catalog-product/service', () => ({
  upsertCatalogProducts: vi.fn(),
}));

import { returnSaleLineItemToStock } from './service';

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

const buildSale = (kind: 'repair' | 'sale') => ({
  _id: 'sale-1',
  id: 'sale-1',
  kind,
  status: 'issued',
  paidAmount: 0,
  quantity: 1,
  salePrice: 350,
  lineItems: [lineItem],
  discount: { mode: 'amount', value: 0 },
  timeline: [],
});

describe('returnSaleLineItemToStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...buildSale('sale'),
        lineItems: [],
      }),
    });
    productModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: lineItem.productId,
        purchasePlace: 'Service center',
      }),
    });
  });

  it('allows returning product line item to stock for repair orders', async () => {
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(buildSale('repair')),
    });

    await returnSaleLineItemToStock('507f1f77bcf86cd799439011', {
      lineItemId: lineItem.id,
      warehouse: 'Service center',
      author: 'QA',
    });

    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      lineItem.productId,
      {
        $inc: { quantity: lineItem.quantity },
        $set: { purchasePlace: 'Service center' },
      },
      { returnDocument: 'before' },
    );
    expect(saleModel.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('keeps return-to-stock flow working for sale orders', async () => {
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(buildSale('sale')),
    });

    await returnSaleLineItemToStock('507f1f77bcf86cd799439011', {
      lineItemId: lineItem.id,
      warehouse: 'Service center',
      author: 'QA',
    });

    expect(saleModel.findByIdAndUpdate).toHaveBeenCalled();
  });
});

