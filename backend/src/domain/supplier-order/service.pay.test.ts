import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../shared/lib/errors';
import { leanResult } from '../../test/mongoose-mocks';
import { createFinanceTransaction } from '../finance/service';
import { Supplier } from '../supplier/model';
import { SupplierOrder } from './model';
import { paySupplierOrder } from './service';

vi.mock('../finance/service', () => ({
  createFinanceTransaction: vi.fn(),
}));

const createFinanceTransactionMock = vi.mocked(createFinanceTransaction);

const state = {
  supplierOrder: undefined as Record<string, unknown> | undefined,
};

const buildSupplierOrder = (patch: Record<string, unknown> = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  orderBaseId: 'SO-1',
  number: 'SO-1',
  supplier: '507f1f77bcf86cd799439012',
  deliveryDate: new Date('2026-01-05T00:00:00.000Z'),
  supplyType: 'Local',
  note: '',
  createdBy: 'Owner',
  status: 'approved',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  items: [],
  total: 250,
  paid: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  validate: vi.fn(async () => undefined),
  save: vi.fn(async () => undefined),
  toObject: vi.fn(function toObject(this: Record<string, unknown>) {
    return this;
  }),
  ...patch,
});

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });
  vi.spyOn(SupplierOrder, 'findById').mockImplementation(
    async () => state.supplierOrder as never,
  );
  vi.spyOn(Supplier, 'find').mockReturnValue({
    select: () =>
      leanResult([
        { _id: '507f1f77bcf86cd799439012', name: 'Cable Supplier' },
      ]),
  } as never);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  state.supplierOrder = buildSupplierOrder();
  createFinanceTransactionMock.mockResolvedValue({ id: 'tx-1' } as never);
  installSpies();
});

describe('paySupplierOrder', () => {
  it('creates withdraw transaction and marks order as paid', async () => {
    const result = await paySupplierOrder('507f1f77bcf86cd799439011', {
      cashboxId: '507f1f77bcf86cd799439013',
      note: 'Payment for order SO-1',
    });

    expect(createFinanceTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'withdraw',
        amount: 250,
        currency: 'UAH',
        fromCashboxId: '507f1f77bcf86cd799439013',
        note: 'Payment for order SO-1',
      }),
      expect.objectContaining({ session: undefined }),
    );
    expect(state.supplierOrder?.paymentStatus).toBe('paid');
    expect(state.supplierOrder?.paid).toBe(250);
    expect(result.paymentStatus).toBe('paid');
  });

  it('rejects already paid orders with 409', async () => {
    state.supplierOrder = buildSupplierOrder({ paymentStatus: 'paid', paid: 250 });

    await expect(
      paySupplierOrder('507f1f77bcf86cd799439011', {
        cashboxId: '507f1f77bcf86cd799439013',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Замовлення вже сплачено.',
    });
    expect(createFinanceTransactionMock).not.toHaveBeenCalled();
  });

  it('rejects insufficient cashbox balance with 400', async () => {
    createFinanceTransactionMock.mockRejectedValueOnce(
      new HttpError(400, 'Cashbox balance is not enough for this operation.'),
    );

    await expect(
      paySupplierOrder('507f1f77bcf86cd799439011', {
        cashboxId: '507f1f77bcf86cd799439013',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cashbox balance is not enough for this operation.',
    });
  });

});