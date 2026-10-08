import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Employee } from '../employee/model';
import { Product } from '../product/model';
import * as financeService from '../finance/service';
import { Sale } from './model';
import {
  acceptSalePayment,
  refundSalePayment,
  returnSaleLineItem,
  returnSale,
} from './service';
import { leanResult, withFormatSaleFields } from './test-helpers';

const saleId = '507f1f77bcf86cd799439012';
const productId = '507f1f77bcf86cd799439013';

const stockProduct = {
  _id: productId,
  name: 'Stock Item',
  quantity: 5,
  reservedQuantity: 0,
  purchasePlace: 'Main Warehouse',
};

const lineItem = {
  id: 'li-1',
  kind: 'product' as const,
  productId,
  name: 'Stock Item',
  price: 500,
  quantity: 1,
  warrantyPeriod: 0,
  serialNumbers: [],
};

const buildSale = (overrides = {}) =>
  withFormatSaleFields({
    _id: saleId,
    recordNumber: 'r000001',
    kind: 'sale',
    status: 'reserved',
    paidAmount: 0,
    salePrice: 500,
    quantity: 1,
    product: null,
    productSnapshot: { name: 'Stock Item', serialNumber: '', article: 'SALE' },
    lineItems: [lineItem],
    discount: { mode: 'amount', value: 0 },
    paymentHistory: [],
    timeline: [],
    issuedBy: null,
    issuedBySnapshot: null,
    ...overrides,
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
      leanResult(withFormatSaleFields({ ...currentSale, ...update })) as never,
  );
  vi.spyOn(Employee, 'findById').mockReturnValue(leanResult(null) as never);
  vi.spyOn(Product, 'findById').mockReturnValue(leanResult(stockProduct) as never);
  vi.spyOn(Product, 'findByIdAndUpdate').mockReturnValue(
    leanResult({ ...stockProduct, quantity: 4 }) as never,
  );
  vi.spyOn(financeService, 'createFinanceTransaction').mockResolvedValue({
    toCashbox: { name: 'Allowed Cashbox' },
    fromCashbox: { name: 'Allowed Cashbox' },
  } as never);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  currentSale = buildSale();
  installSpies();
});

describe('cashbox authorization enforcement', () => {
  const nonOwnerEmployee = {
    role: 'manager',
    allowedCashboxIds: ['cashbox-allowed-1', 'cashbox-allowed-2'],
  };

  const restrictedEmployeeWithoutCashboxes = {
    role: 'cashier',
    allowedCashboxIds: [],
  };

  const ownerEmployee = {
    role: 'owner',
    allowedCashboxIds: [],
  };

  describe('acceptSalePayment', () => {
    it('rejects non-owner with 403 when using unauthorized cashbox', async () => {
      await expect(
        acceptSalePayment(
          saleId,
          {
            cashboxId: 'cashbox-forbidden',
            amount: '500',
            paymentMethod: 'cash',
            action: 'deposit',
            author: 'Manager',
          },
          nonOwnerEmployee,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Forbidden: cashbox access denied',
      });
    });

    it('rejects non-owner with empty allowedCashboxIds for any cashbox with 403', async () => {
      await expect(
        acceptSalePayment(
          saleId,
          {
            cashboxId: 'cashbox-allowed-1',
            amount: '500',
            paymentMethod: 'cash',
            action: 'deposit',
            author: 'Cashier',
          },
          restrictedEmployeeWithoutCashboxes,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Forbidden: cashbox access denied',
      });
    });

    it('allows non-owner to accept payment into an allowed cashbox', async () => {
      const updated = await acceptSalePayment(
        saleId,
        {
          cashboxId: 'cashbox-allowed-1',
          amount: '500',
          paymentMethod: 'cash',
          action: 'deposit',
          author: 'Manager',
        },
        nonOwnerEmployee,
      );

      expect(updated.paidAmount).toBe(500);
      expect(financeService.createFinanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          toCashboxId: 'cashbox-allowed-1',
        }),
      );
    });

    it('allows owner to accept payment into any cashbox regardless of allowedCashboxIds', async () => {
      const updated = await acceptSalePayment(
        saleId,
        {
          cashboxId: 'any-random-cashbox',
          amount: '500',
          paymentMethod: 'cash',
          action: 'deposit',
          author: 'Owner',
        },
        ownerEmployee,
      );

      expect(updated.paidAmount).toBe(500);
      expect(financeService.createFinanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          toCashboxId: 'any-random-cashbox',
        }),
      );
    });

    it('bypasses cashbox validation for issueWithoutPayment action', async () => {
      currentSale = buildSale({
        kind: 'repair',
        status: 'diagnostics',
        lineItems: [
          {
            id: 'li-svc',
            kind: 'service',
            name: 'Diagnostics',
            price: 500,
            quantity: 1,
          },
        ],
      });

      const updated = await acceptSalePayment(
        saleId,
        {
          action: 'issueWithoutPayment',
          targetStatus: 'issued',
          author: 'Cashier',
        },
        restrictedEmployeeWithoutCashboxes,
      );

      expect(updated.status).toBe('issued');
      expect(financeService.createFinanceTransaction).not.toHaveBeenCalled();
    });
  });

  describe('refundSalePayment', () => {
    beforeEach(() => {
      currentSale = buildSale({
        kind: 'repair',
        status: 'diagnostics',
        paidAmount: 500,
        lineItems: [
          {
            id: 'li-svc',
            kind: 'service',
            name: 'Diagnostics',
            price: 500,
            quantity: 1,
          },
        ],
      });
    });

    it('rejects non-owner with 403 on refund from unauthorized cashbox', async () => {
      await expect(
        refundSalePayment(
          saleId,
          {
            cashboxId: 'cashbox-forbidden',
            amount: '200',
            author: 'Manager',
          },
          nonOwnerEmployee,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Forbidden: cashbox access denied',
      });
    });

    it('allows non-owner to refund from an allowed cashbox', async () => {
      const updated = await refundSalePayment(
        saleId,
        {
          cashboxId: 'cashbox-allowed-2',
          amount: '200',
          author: 'Manager',
        },
        nonOwnerEmployee,
      );

      expect(updated.paidAmount).toBe(300);
      expect(financeService.createFinanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCashboxId: 'cashbox-allowed-2',
        }),
      );
    });

    it('allows owner to refund from any cashbox', async () => {
      const updated = await refundSalePayment(
        saleId,
        {
          cashboxId: 'any-cashbox',
          amount: '200',
          author: 'Owner',
        },
        ownerEmployee,
      );

      expect(updated.paidAmount).toBe(300);
      expect(financeService.createFinanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCashboxId: 'any-cashbox',
        }),
      );
    });
  });

  describe('returnSaleLineItem', () => {
    beforeEach(() => {
      currentSale = buildSale({
        status: 'paid',
        paidAmount: 500,
      });
    });

    it('rejects non-owner with 403 on return from unauthorized cashbox', async () => {
      await expect(
        returnSaleLineItem(
          saleId,
          {
            lineItemId: 'li-1',
            cashboxId: 'cashbox-forbidden',
            refundAmount: '500',
            warehouse: 'Main Warehouse',
            author: 'Manager',
          },
          nonOwnerEmployee,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Forbidden: cashbox access denied',
      });
    });

    it('allows non-owner to return line item using allowed cashbox', async () => {
      const updated = await returnSaleLineItem(
        saleId,
        {
          lineItemId: 'li-1',
          cashboxId: 'cashbox-allowed-1',
          refundAmount: '500',
          warehouse: 'Main Warehouse',
          author: 'Manager',
        },
        nonOwnerEmployee,
      );

      expect(updated.paidAmount).toBe(0);
      expect(financeService.createFinanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCashboxId: 'cashbox-allowed-1',
        }),
      );
    });

    it('allows owner to return line item using any cashbox', async () => {
      const updated = await returnSaleLineItem(
        saleId,
        {
          lineItemId: 'li-1',
          cashboxId: 'any-cashbox',
          refundAmount: '500',
          warehouse: 'Main Warehouse',
          author: 'Owner',
        },
        ownerEmployee,
      );

      expect(updated.paidAmount).toBe(0);
      expect(financeService.createFinanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCashboxId: 'any-cashbox',
        }),
      );
    });
  });

  describe('returnSale', () => {
    beforeEach(() => {
      currentSale = buildSale({
        status: 'paid',
        paidAmount: 500,
      });
    });

    it('rejects non-owner with 403 on full return from unauthorized cashbox', async () => {
      await expect(
        returnSale(
          saleId,
          {
            cashboxId: 'cashbox-forbidden',
            refundAmount: '500',
            warehouse: 'Main Warehouse',
            author: 'Manager',
          },
          nonOwnerEmployee,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Forbidden: cashbox access denied',
      });
    });

    it('allows non-owner to perform return with allowed cashbox', async () => {
      const updated = await returnSale(
        saleId,
        {
          cashboxId: 'cashbox-allowed-1',
          refundAmount: '500',
          warehouse: 'Main Warehouse',
          author: 'Manager',
        },
        nonOwnerEmployee,
      );

      expect(updated.status).toBe('returned');
      expect(financeService.createFinanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCashboxId: 'cashbox-allowed-1',
        }),
      );
    });

    it('allows owner to perform return with any cashbox', async () => {
      const updated = await returnSale(
        saleId,
        {
          cashboxId: 'random-cashbox',
          refundAmount: '500',
          warehouse: 'Main Warehouse',
          author: 'Owner',
        },
        ownerEmployee,
      );

      expect(updated.status).toBe('returned');
      expect(financeService.createFinanceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCashboxId: 'random-cashbox',
        }),
      );
    });
  });
});

