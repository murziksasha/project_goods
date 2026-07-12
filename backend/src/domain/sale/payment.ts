import { randomUUID } from 'crypto';
import { Sale, type SaleDocument } from './model';
import { formatSale } from '../../shared/lib/formatters';
import { toNumber } from '../../shared/lib/parsers';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { createFinanceTransaction } from '../finance/service';
import { HttpError } from '../../shared/lib/errors';
import {
  assertWorkspaceState,
  calculateTotalAfterDiscount,
  getFallbackLineItems,
  resolveActiveEmployee,
} from './internal';

type SalePaymentAction = 'deposit' | 'depositAndIssue' | 'issueWithoutPayment';
type SalePaymentTargetStatus = 'issued' | 'issuedWithoutRepair' | 'paid';
type SalePaymentMethod = 'cash' | 'non-cash';
type SalePaymentHistoryEntryValue = {
  id: string;
  type: 'deposit' | 'refund';
  paymentMethod: SalePaymentMethod;
  amount: number;
  cashboxId: string;
  cashboxName: string;
  author: string;
  createdAt: Date;
};
type SaleTimelineEntryValue = {
  id: string;
  kind?: 'manual' | 'system';
  author: string;
  message: string;
  createdAt: Date;
};

const normalizePaymentAction = (value: unknown): SalePaymentAction => {
  if (
    value === 'deposit' ||
    value === 'depositAndIssue' ||
    value === 'issueWithoutPayment'
  ) {
    return value;
  }
  throw new HttpError(400, 'Payment action is not valid.');
};

const normalizePaymentTargetStatus = (
  value: unknown,
): SalePaymentTargetStatus => {
  if (value === 'paid' || value === 'issuedWithoutRepair') return value;
  return 'issued';
};

const normalizePaymentMethod = (value: unknown): SalePaymentMethod =>
  value === 'non-cash' ? 'non-cash' : 'cash';

const normalizeMoneyAmount = (value: unknown, field: string) => {
  const amount = Math.round(toNumber(value) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, `${field} is not valid.`);
  }
  return amount;
};

const getSaleWorkspaceLineItems = (sale: SaleDocument) =>
  sale.lineItems?.length
    ? sale.lineItems
    : getFallbackLineItems(
        sale.kind === 'sale' ? 'sale' : 'repair',
        sale.salePrice,
        sale.quantity,
        {
          _id: sale.product ?? '',
          name: sale.productSnapshot?.name ?? 'Item',
        },
      );

export const acceptSalePayment = async (
  saleId: string,
  payload: {
    cashboxId?: unknown;
    amount?: unknown;
    paymentMethod?: unknown;
    action?: unknown;
    targetStatus?: unknown;
    author?: unknown;
    issuedById?: unknown;
  },
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) {
    throw new HttpError(404, 'Sale not found.');
  }

  const action = normalizePaymentAction(payload.action);
  const targetStatus = normalizePaymentTargetStatus(payload.targetStatus);
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  const author = String(payload.author ?? '').trim() || 'System';
  const createdAt = new Date();
  const lineItems = getSaleWorkspaceLineItems(sale);
  const orderTotal = calculateTotalAfterDiscount(lineItems, sale.discount);
  const currentPaidAmount = sale.paidAmount ?? 0;
  const currentRemaining = Math.max(
    Math.round((orderTotal - currentPaidAmount) * 100) / 100,
    0,
  );
  const amount =
    action === 'issueWithoutPayment'
      ? 0
      : normalizeMoneyAmount(payload.amount, 'Payment amount');

  if (action !== 'issueWithoutPayment') {
    if (amount <= 0 || amount > currentRemaining) {
      throw new HttpError(400, 'Payment amount cannot exceed the remaining balance.');
    }
  }

  const nextPaidAmount = Math.min(
    Math.round((currentPaidAmount + amount) * 100) / 100,
    orderTotal,
  );
  const nextPaymentRemaining = Math.max(
    Math.round((orderTotal - nextPaidAmount) * 100) / 100,
    0,
  );
  const hasProducts = lineItems.some((item) => item.kind === 'product');

  if (
    (action === 'depositAndIssue' || action === 'issueWithoutPayment') &&
    hasProducts &&
    targetStatus !== 'paid' &&
    nextPaymentRemaining > 0
  ) {
    throw new HttpError(400, 'Product shipped but payment has not been received.');
  }

  const nextStatus =
    action === 'depositAndIssue' || action === 'issueWithoutPayment'
      ? targetStatus
      : action === 'deposit' && nextPaymentRemaining === 0
        ? 'paid'
        : sale.status;
  const issuedById = String(payload.issuedById ?? '').trim();
  const shouldSetIssuedBy =
    nextStatus === 'issued' ||
    nextStatus === 'issuedWithoutRepair' ||
    nextStatus === 'clientRejected';
  const issuedBy =
    shouldSetIssuedBy && issuedById
      ? await resolveActiveEmployee(issuedById, 'issuedById')
      : null;

  let nextPaymentHistory = (sale.paymentHistory ??
    []) as unknown as SalePaymentHistoryEntryValue[];
  let nextTimeline = (sale.timeline ??
    []) as unknown as SaleTimelineEntryValue[];

  assertWorkspaceState(
    sale.kind,
    nextStatus,
    nextPaidAmount,
    lineItems,
    sale.discount,
  );

  if (action !== 'issueWithoutPayment') {
    const cashboxId = String(payload.cashboxId ?? '').trim();
    const transaction = await createFinanceTransaction({
      type: 'deposit',
      amount: String(amount),
      currency: 'UAH',
      toCashboxId: cashboxId,
      note: `Payment for order ${sale.recordNumber ?? sale._id.toString()}`,
    });
    const cashboxName = transaction.toCashbox?.name ?? 'Cashbox';
    nextPaymentHistory = [
      {
        id: randomUUID(),
        type: 'deposit' as const,
        paymentMethod,
        amount,
        cashboxId,
        cashboxName,
        author,
        createdAt,
      },
      ...nextPaymentHistory,
    ];
    nextTimeline = [
      {
        id: randomUUID(),
        kind: 'system',
        author,
        message: `${author} accepted ${amount} UAH to ${cashboxName} (${paymentMethod}).`,
        createdAt,
      },
      ...nextTimeline,
    ];
  }

  if (nextStatus !== sale.status) {
    nextTimeline = [
      {
        id: randomUUID(),
        kind: 'system',
        author,
        message: `${author} changed status to "${nextStatus}".`,
        createdAt,
      },
      ...nextTimeline,
    ];
  }

  const updatedSale = await Sale.findByIdAndUpdate(
    saleId,
    {
      status: nextStatus,
      paidAmount: nextPaidAmount,
      issuedBy: shouldSetIssuedBy ? issuedBy?._id ?? null : null,
      issuedBySnapshot:
        shouldSetIssuedBy && issuedBy
          ? { name: issuedBy.name, role: issuedBy.role }
          : undefined,
      paymentHistory: nextPaymentHistory,
      timeline: nextTimeline,
    },
    { returnDocument: 'after', runValidators: true },
  ).lean<SaleDocument | null>();

  if (!updatedSale) {
    throw new HttpError(404, 'Sale not found.');
  }

  return formatSale(updatedSale);
};

export const refundSalePayment = async (
  saleId: string,
  payload: {
    cashboxId?: unknown;
    amount?: unknown;
    author?: unknown;
    issuedById?: unknown;
  },
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) {
    throw new HttpError(404, 'Sale not found.');
  }

  const currentPaidAmount = sale.paidAmount ?? 0;
  const amount = normalizeMoneyAmount(payload.amount, 'Refund amount');
  if (amount <= 0 || amount > currentPaidAmount) {
    throw new HttpError(400, 'Refund amount cannot exceed the paid amount.');
  }

  const author = String(payload.author ?? '').trim() || 'System';
  const cashboxId = String(payload.cashboxId ?? '').trim();
  const createdAt = new Date();
  const lineItems = getSaleWorkspaceLineItems(sale);
  const orderTotal = calculateTotalAfterDiscount(lineItems, sale.discount);
  const nextPaidAmount = Math.max(
    Math.round((currentPaidAmount - amount) * 100) / 100,
    0,
  );
  const hasProducts = lineItems.some(
    (item) => item.kind === 'product' && item.quantity > 0,
  );
  const shouldDowngradeIssuedStatus =
    sale.kind !== 'repair' &&
    sale.status === 'issued' &&
    hasProducts &&
    nextPaidAmount < orderTotal;
  const nextStatus = shouldDowngradeIssuedStatus ? 'reserved' : sale.status;
  const issuedById = String(payload.issuedById ?? '').trim();
  const shouldSetIssuedBy =
    nextStatus === 'issued' ||
    nextStatus === 'issuedWithoutRepair' ||
    nextStatus === 'clientRejected';
  const issuedBy =
    shouldSetIssuedBy && issuedById
      ? await resolveActiveEmployee(issuedById, 'issuedById')
      : null;

  assertWorkspaceState(
    sale.kind,
    nextStatus,
    nextPaidAmount,
    lineItems,
    sale.discount,
  );

  const transaction = await createFinanceTransaction({
    type: 'withdraw',
    amount: String(amount),
    currency: 'UAH',
    fromCashboxId: cashboxId,
    note: `Refund for order ${sale.recordNumber ?? sale._id.toString()}`,
  });
  const cashboxName = transaction.fromCashbox?.name ?? 'Cashbox';
  const nextPaymentHistory = [
    {
      id: randomUUID(),
      type: 'refund' as const,
      paymentMethod: 'cash' as const,
      amount,
      cashboxId,
      cashboxName,
      author,
      createdAt,
    },
    ...(sale.paymentHistory ?? []),
  ];
  const nextTimeline = [
    ...(shouldDowngradeIssuedStatus
      ? [
          {
            id: randomUUID(),
            kind: 'system',
            author,
            message: `${author} changed status to "${nextStatus}".`,
            createdAt,
          },
        ]
      : []),
    {
      id: randomUUID(),
      kind: 'system',
      author,
      message: `${author} refunded ${amount} UAH from ${cashboxName}.`,
      createdAt,
    },
    ...(sale.timeline ?? []),
  ];

  const updatedSale = await Sale.findByIdAndUpdate(
    saleId,
    {
      status: nextStatus,
      paidAmount: nextPaidAmount,
      issuedBy: shouldSetIssuedBy ? issuedBy?._id ?? null : null,
      issuedBySnapshot:
        shouldSetIssuedBy && issuedBy
          ? { name: issuedBy.name, role: issuedBy.role }
          : undefined,
      paymentHistory: nextPaymentHistory,
      timeline: nextTimeline,
    },
    { returnDocument: 'after', runValidators: true },
  ).lean<SaleDocument | null>();

  if (!updatedSale) {
    throw new HttpError(404, 'Sale not found.');
  }

  return formatSale(updatedSale);
};
