import { beforeEach, describe, expect, it, vi } from 'vitest';

const { saleModel, employeeModel, createFinanceTransactionMock } = vi.hoisted(
  () => ({
    saleModel: {
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    },
    employeeModel: {
      findById: vi.fn(),
    },
    createFinanceTransactionMock: vi.fn(),
  }),
);

vi.mock('./model', () => ({
  Sale: saleModel,
}));

vi.mock('../client/model', () => ({
  Client: {},
}));

vi.mock('../employee/model', () => ({
  Employee: employeeModel,
}));

vi.mock('../catalog-product/model', () => ({
  CatalogProduct: {},
}));

vi.mock('../product/model', () => ({
  Product: {},
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
  createFinanceTransaction: createFinanceTransactionMock,
}));

vi.mock('../../shared/lib/errors', () => ({
  assertNotStale: vi.fn(),
}));

vi.mock('../catalog-product/service', () => ({
  upsertCatalogProducts: vi.fn(),
}));

import { acceptSalePayment, refundSalePayment } from './service';

const lineItem = {
  id: 'li-1',
  kind: 'product',
  productId: '507f1f77bcf86cd799439012',
  name: 'Wireless Mouse',
  price: 290,
  quantity: 1,
  warrantyPeriod: 0,
  serialNumbers: [],
};

const buildSale = () => ({
  _id: 'sale-1',
  recordNumber: 'r000008',
  kind: 'sale',
  status: 'reserved',
  paidAmount: 0,
  salePrice: 290,
  quantity: 1,
  product: null,
  productSnapshot: { name: 'Sale', serialNumber: '', article: 'SALE' },
  lineItems: [lineItem],
  discount: { mode: 'amount', value: 0 },
  paymentHistory: [],
  timeline: [],
  issuedBy: null,
  issuedBySnapshot: null,
});

describe('sale payment/refund finance coupling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    employeeModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    createFinanceTransactionMock.mockResolvedValue({
      toCashbox: { name: 'Основная' },
      fromCashbox: { name: 'Основная' },
    });
  });

  it('creates a deposit and updates sale payment state together', async () => {
    const sale = buildSale();
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(sale),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockImplementation(async () => ({
        ...sale,
        ...saleModel.findByIdAndUpdate.mock.calls[0][1],
      })),
    });

    const updatedSale = await acceptSalePayment('sale-1', {
      cashboxId: 'cashbox-1',
      amount: '290',
      paymentMethod: 'cash',
      action: 'depositAndIssue',
      targetStatus: 'issued',
      author: 'Manager',
    });

    expect(createFinanceTransactionMock).toHaveBeenCalledWith({
      type: 'deposit',
      amount: '290',
      currency: 'UAH',
      toCashboxId: 'cashbox-1',
      note: 'Payment for order r000008',
    });
    expect(updatedSale.paidAmount).toBe(290);
    expect(updatedSale.status).toBe('issued');
    expect(updatedSale.paymentHistory[0]).toMatchObject({
      type: 'deposit',
      amount: 290,
      cashboxId: 'cashbox-1',
      cashboxName: 'Основная',
    });
  });

  it('does not create a deposit when issuing would violate payment rules', async () => {
    const sale = buildSale();
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(sale),
    });

    await expect(
      acceptSalePayment('sale-1', {
        cashboxId: 'cashbox-1',
        amount: '100',
        paymentMethod: 'cash',
        action: 'depositAndIssue',
        targetStatus: 'issued',
        author: 'Manager',
      }),
    ).rejects.toThrow('Product shipped but payment has not been received.');

    expect(createFinanceTransactionMock).not.toHaveBeenCalled();
    expect(saleModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('creates a withdraw and updates sale refund state together', async () => {
    const sale = {
      ...buildSale(),
      status: 'issued',
      paidAmount: 290,
    };
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(sale),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockImplementation(async () => ({
        ...sale,
        ...saleModel.findByIdAndUpdate.mock.calls[0][1],
      })),
    });

    const updatedSale = await refundSalePayment('sale-1', {
      cashboxId: 'cashbox-1',
      amount: '100',
      author: 'Manager',
    });

    expect(createFinanceTransactionMock).toHaveBeenCalledWith({
      type: 'withdraw',
      amount: '100',
      currency: 'UAH',
      fromCashboxId: 'cashbox-1',
      note: 'Refund for order r000008',
    });
    expect(updatedSale.paidAmount).toBe(190);
    expect(updatedSale.status).toBe('reserved');
    expect(updatedSale.paymentHistory[0]).toMatchObject({
      type: 'refund',
      amount: 100,
      cashboxId: 'cashbox-1',
    });
  });

  it('rejects refund over paid amount before creating finance transaction', async () => {
    const sale = {
      ...buildSale(),
      paidAmount: 50,
    };
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(sale),
    });

    await expect(
      refundSalePayment('sale-1', {
        cashboxId: 'cashbox-1',
        amount: '100',
        author: 'Manager',
      }),
    ).rejects.toThrow('Refund amount cannot exceed the paid amount.');

    expect(createFinanceTransactionMock).not.toHaveBeenCalled();
    expect(saleModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
