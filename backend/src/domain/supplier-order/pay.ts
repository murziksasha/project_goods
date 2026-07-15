import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { HttpError } from '../../shared/lib/errors';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { createFinanceTransaction } from '../finance/service';
import { withOptionalMongoSession } from '../../shared/lib/mongo-session';
import {
  SupplierOrder,
  type SupplierOrderDocument,
} from './model';
import { getSupplierOrderDisplayNumber } from './formatters';
import { withSupplierName } from './internal';

export const paySupplierOrder = async (
  supplierOrderId: string,
  payload: { cashboxId?: unknown; note?: unknown; transactionDate?: unknown },
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const cashboxId = toNonEmptyString(payload.cashboxId);
  isValidObjectIdOrThrow(cashboxId, 'cashboxId');

  const paidOrder = await withOptionalMongoSession(async (session) => {
    const existing = session
      ? await SupplierOrder.findById(supplierOrderId).session(session)
      : await SupplierOrder.findById(supplierOrderId);
    if (!existing) throw new HttpError(404, 'Supplier order not found.');
    if (existing.paymentStatus === 'paid') {
      throw new HttpError(409, 'Замовлення вже сплачено.');
    }
    if (existing.paymentStatus === 'without_payment') {
      throw new HttpError(409, 'Замовлення вже видано без оплати.');
    }
    if (
      existing.status !== 'approved' &&
      existing.status !== 'overdue' &&
      existing.status !== 'stocked' &&
      existing.status !== 'partially_stocked' &&
      existing.status !== 'partially_completed'
    ) {
      throw new HttpError(
        400,
        'Оплата доступна тільки для замовлень зі статусом approved або stocked.',
      );
    }

    await createFinanceTransaction(
      {
        type: 'withdraw',
        amount: existing.total,
        currency: 'UAH',
        fromCashboxId: cashboxId,
        toCashboxId: '',
        note:
          toNonEmptyString(payload.note) ||
          `Supplier order payment: ${getSupplierOrderDisplayNumber(existing)}`,
        transactionDate: payload.transactionDate,
      },
      { session },
    );

    existing.paymentStatus = 'paid';
    existing.receiptStatus =
      existing.receiptStatus === 'new' ? 'approved' : existing.receiptStatus;
    existing.paid = existing.total;
    await existing.validate();
    await existing.save({ session });
    return existing.toObject<SupplierOrderDocument>();
  });

  return withSupplierName(paidOrder);
};

export const issueSupplierOrderWithoutPayment = async (
  supplierOrderId: string,
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new HttpError(404, 'Supplier order not found.');
  if (existing.paymentStatus === 'paid') throw new HttpError(409, 'Замовлення вже сплачено.');
  if (existing.paymentStatus === 'without_payment') throw new HttpError(409, 'Замовлення вже видано без оплати.');
  if (
    existing.status !== 'approved' &&
    existing.status !== 'overdue' &&
    existing.status !== 'stocked' &&
    existing.status !== 'partially_stocked' &&
    existing.status !== 'partially_completed'
  ) {
    throw new HttpError(400, 'Видача без оплати доступна тільки для замовлень зі статусом approved або stocked.');
  }

  existing.paymentStatus = 'without_payment';
  existing.receiptStatus = existing.receiptStatus === 'new' ? 'approved' : existing.receiptStatus;
  await existing.validate();
  await existing.save();

  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};
