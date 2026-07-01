import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Employee } from '../employee/model';
import * as financeService from '../finance/service';
import { Sale } from './model';
import { acceptSalePayment, refundSalePayment } from './service';
import { leanResult, withFormatSaleFields } from './test-helpers';

const saleId = '507f1f77bcf86cd799439012';

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

const buildSale = () =>
  withFormatSaleFields({
    _id: saleId,
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

let currentSale: any;

const setupPaymentMocks = (sale: any) => {
  currentSale = { ...sale };
};

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
      leanResult(withFormatSaleFields({ ...currentSale, ...update })) as never,
  );
  vi.spyOn(Employee, 'findById').mockReturnValue(leanResult(null) as never);
  vi.spyOn(financeService, 'createFinanceTransaction').mockResolvedValue({
    toCashbox: { name: 'Основная' },
    fromCashbox: { name: 'Основная' },
  } as never);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  currentSale = buildSale();
  installSpies();
});

describe('sale payment/refund finance coupling', () => {
  it('creates a deposit and updates sale payment state together', async () => {
    setupPaymentMocks(buildSale());

    const updatedSale = await acceptSalePayment(saleId, {
      cashboxId: 'cashbox-1',
      amount: '290',
      paymentMethod: 'cash',
      action: 'depositAndIssue',
      targetStatus: 'issued',
      author: 'Manager',
    });

    expect(financeService.createFinanceTransaction).toHaveBeenCalledWith({
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
    setupPaymentMocks(buildSale());

    await expect(
      acceptSalePayment(saleId, {
        cashboxId: 'cashbox-1',
        amount: '100',
        paymentMethod: 'cash',
        action: 'depositAndIssue',
        targetStatus: 'issued',
        author: 'Manager',
      }),
    ).rejects.toThrow('Product shipped but payment has not been received.');

    expect(financeService.createFinanceTransaction).not.toHaveBeenCalled();
    expect(Sale.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('creates a withdraw and updates sale refund state together', async () => {
    setupPaymentMocks({
      ...buildSale(),
      status: 'issued',
      paidAmount: 290,
    });

    const updatedSale = await refundSalePayment(saleId, {
      cashboxId: 'cashbox-1',
      amount: '100',
      author: 'Manager',
    });

    expect(financeService.createFinanceTransaction).toHaveBeenCalledWith({
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
    setupPaymentMocks({
      ...buildSale(),
      paidAmount: 50,
    });

    await expect(
      refundSalePayment(saleId, {
        cashboxId: 'cashbox-1',
        amount: '100',
        author: 'Manager',
      }),
    ).rejects.toThrow('Refund amount cannot exceed the paid amount.');

    expect(financeService.createFinanceTransaction).not.toHaveBeenCalled();
    expect(Sale.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('partial deposit creates finance transaction and does not change status', async () => {
    setupPaymentMocks({
      ...buildSale(),
      kind: 'sale',
      status: 'reserved',
      paidAmount: 0,
    });

    const updatedSale = await acceptSalePayment(saleId, {
      cashboxId: 'cashbox-1',
      amount: '100',
      paymentMethod: 'cash',
      action: 'deposit',
      targetStatus: 'paid',
      author: 'Manager',
    });

    expect(financeService.createFinanceTransaction).toHaveBeenCalledWith({
      type: 'deposit',
      amount: '100',
      currency: 'UAH',
      toCashboxId: 'cashbox-1',
      note: 'Payment for order r000008',
    });
    expect(updatedSale.paidAmount).toBe(100);
    expect(updatedSale.status).toBe('reserved');
    expect(updatedSale.paymentHistory[0]).toMatchObject({
      type: 'deposit',
      amount: 100,
      cashboxId: 'cashbox-1',
    });
  });

  it('full deposit via deposit action auto marks paid when remaining reaches 0', async () => {
    setupPaymentMocks({
      ...buildSale(),
      kind: 'sale',
      status: 'new',
      paidAmount: 0,
    });

    const updatedSale = await acceptSalePayment(saleId, {
      cashboxId: 'cashbox-1',
      amount: '290',
      paymentMethod: 'non-cash',
      action: 'deposit',
      targetStatus: 'issued',
      author: 'Manager',
    });

    expect(financeService.createFinanceTransaction).toHaveBeenCalled();
    expect(updatedSale.paidAmount).toBe(290);
    expect(updatedSale.status).toBe('paid');
  });

  it('partial deposit on repair order creates tx and keeps original status (no auto paid or issue)', async () => {
    const repair = {
      ...buildSale(),
      kind: 'repair',
      status: 'diagnostics',
      paidAmount: 50,
      lineItems: [{ ...lineItem, kind: 'product' }],
    };
    setupPaymentMocks(repair);

    const updated = await acceptSalePayment(saleId, {
      cashboxId: 'cashbox-2',
      amount: '100',
      paymentMethod: 'cash',
      action: 'deposit',
      targetStatus: 'issued',
      author: 'Technician',
    });

    expect(financeService.createFinanceTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ toCashboxId: 'cashbox-2', amount: '100' }),
    );
    expect(updated.paidAmount).toBe(150);
    expect(updated.status).toBe('diagnostics');
  });

  it('full deposit on repair order (with and without products) auto sets paid only', async () => {
    setupPaymentMocks({
      ...buildSale(),
      kind: 'repair',
      status: 'inRepair',
      paidAmount: 0,
    });

    const updatedWith = await acceptSalePayment(saleId, {
      cashboxId: 'cashbox-1',
      amount: '290',
      paymentMethod: 'cash',
      action: 'deposit',
      targetStatus: 'issued',
      author: 'Tech',
    });
    expect(updatedWith.paidAmount).toBe(290);
    expect(updatedWith.status).toBe('paid');

    setupPaymentMocks({
      ...buildSale(),
      kind: 'repair',
      status: 'waitingParts',
      paidAmount: 100,
      lineItems: [
        {
          id: 'li-svc',
          kind: 'service',
          name: 'Diagnostics',
          price: 190,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    });

    const updatedSvc = await acceptSalePayment(saleId, {
      cashboxId: 'cashbox-1',
      amount: '90',
      paymentMethod: 'non-cash',
      action: 'deposit',
      targetStatus: 'paid',
      author: 'Tech',
    });
    expect(updatedSvc.paidAmount).toBe(190);
    expect(updatedSvc.status).toBe('paid');
  });

  it('rejects payment greater than remaining balance', async () => {
    setupPaymentMocks({
      ...buildSale(),
      kind: 'repair',
      status: 'inRepair',
      paidAmount: 100,
      lineItems: [
        {
          id: 'li-svc',
          kind: 'service',
          name: 'Diagnostics',
          price: 190,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    });

    await expect(
      acceptSalePayment(saleId, {
        cashboxId: 'cashbox-1',
        amount: '100',
        paymentMethod: 'cash',
        action: 'deposit',
        targetStatus: 'paid',
        author: 'Tech',
      }),
    ).rejects.toThrow('Payment amount cannot exceed the remaining balance.');
  });
});