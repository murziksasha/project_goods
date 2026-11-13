import { randomUUID } from 'crypto';
import { Product } from '../product/model';
import { Sale, type SaleDocument } from './model';
import { formatSale } from '../../shared/lib/formatters';
import { toNumber } from '../../shared/lib/parsers';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { createFinanceTransaction } from '../finance/service';
import { HttpError } from '../../shared/lib/errors';
import {
  assertEmployeeCanTransactWithCashbox,
  type EmployeeCashboxActor,
  assertWorkspaceState,
  calculateLineItemRefundableAmount,
  calculateLineItemsTotal,
  calculateTotalAfterDiscount,
  receiveProductToWarehouse,
} from './internal';
import type { EmployeeDocument } from '../employee/model';
import { employeeHasPermission } from '../auth/service';
import {
  buildNextStatusTransitions,
  resolveLineItemEffectiveCost,
  scaleReturnedLineItemCostSnapshots,
  type CostableSaleLineItem,
  type ReturnEventValue,
  type StatusTransitionValue,
} from './costing';

const buildReturnEvent = ({
  lineItem,
  quantity,
  refundAmount,
  returnedAt,
  actor,
}: {
  lineItem: Record<string, unknown>;
  quantity: number;
  refundAmount: number;
  returnedAt: Date;
  actor?: EmployeeCashboxActor | null;
}): ReturnEventValue => {
  const effectiveCost = resolveLineItemEffectiveCost(
    lineItem as unknown as CostableSaleLineItem,
  );
  const actorAny = actor as { _id?: { toString: () => string }; name?: string } | null | undefined;
  return {
    id: randomUUID(),
    lineItemId: lineItem.id ? String(lineItem.id) : null,
    name: String(lineItem.name ?? ''),
    productId: lineItem.productId ? String(lineItem.productId) : null,
    catalogProductId: lineItem.catalogProductId
      ? String(lineItem.catalogProductId)
      : null,
    quantity,
    grossAmount:
      Math.round(Number(lineItem.price ?? 0) * quantity * 100) / 100,
    refundAmount,
    unitCost: effectiveCost.unitCost,
    returnedAt,
    returnedById: actorAny?._id ? actorAny._id.toString() : null,
    returnedByName: actorAny?.name ?? null,
  };
};

const formatReturnSaleResult = (
  updatedSale: SaleDocument,
  actor?: EmployeeCashboxActor | null,
) => {
  const actorPerm = actor as Pick<EmployeeDocument, 'role' | 'permissions'> | null | undefined;
  return formatSale(updatedSale, {
    includeCosts:
      actorPerm && actorPerm.permissions !== undefined
        ? employeeHasPermission(actorPerm, 'finance.view')
        : true,
  });
};

export const returnSaleLineItem = async (
  saleId: string,
  payload: {
    lineItemId?: unknown;
    cashboxId?: unknown;
    refundAmount?: unknown;
    warehouse?: unknown;
    author?: unknown;
  },
  actor?: EmployeeCashboxActor | null,
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) {
    throw new HttpError(404, 'Sale not found.');
  }
  if (sale.kind !== 'sale') {
    throw new HttpError(400, 'Only product sales can be returned this way.');
  }

  const lineItemId = String(payload.lineItemId ?? '').trim();
  const lineItem = (sale.lineItems ?? []).find((item) => item.id === lineItemId);
  if (!lineItem || lineItem.kind !== 'product') {
    throw new HttpError(404, 'Product line item not found.');
  }

  const productId = lineItem.productId?.toString();
  if (!productId) {
    throw new HttpError(400, 'Line item is not linked to a stock product.');
  }
  isValidObjectIdOrThrow(productId, 'lineItems.productId');

  const refundAmount = Math.round(toNumber(payload.refundAmount) * 100) / 100;
  const itemTotal = Math.round(lineItem.price * lineItem.quantity * 100) / 100;
  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0 ||
    refundAmount > itemTotal ||
    refundAmount > (sale.paidAmount ?? 0)
  ) {
    throw new HttpError(400, 'Refund amount cannot exceed item total or paid amount.');
  }

  const cashboxId = String(payload.cashboxId ?? '').trim();
  assertEmployeeCanTransactWithCashbox(actor, cashboxId);
  const warehouse = String(payload.warehouse ?? '').trim() || 'Warehouse';
  const author = String(payload.author ?? '').trim() || 'System';
  const createdAt = new Date();
  const nextLineItems = (sale.lineItems ?? []).filter((item) => item.id !== lineItemId);
  const nextPaidAmount = Math.max(Math.round(((sale.paidAmount ?? 0) - refundAmount) * 100) / 100, 0);

  const previousProduct = await receiveProductToWarehouse(
    productId,
    lineItem.quantity,
    warehouse,
  );

  try {
    const transaction = await createFinanceTransaction({
      type: 'withdraw',
      amount: String(refundAmount),
      currency: 'UAH',
      fromCashboxId: cashboxId,
      note: `Return for sale ${sale.recordNumber ?? sale._id.toString()}: ${lineItem.name}`,
      category: 'client_refund',
    });
    const cashboxName = transaction.fromCashbox?.name ?? 'Cashbox';
    const nextPaymentHistory = [
      {
        id: randomUUID(),
        type: 'refund' as const,
        amount: refundAmount,
        cashboxId,
        cashboxName,
        author,
        createdAt,
      },
      ...(sale.paymentHistory ?? []),
    ];
    const nextTimeline = [
      {
        id: randomUUID(),
        kind: 'system',
        author,
        message: `Returned "${lineItem.name}" to ${warehouse}; refunded ${refundAmount} UAH from ${cashboxName}.`,
        createdAt,
      },
      ...(sale.timeline ?? []),
    ];

    assertWorkspaceState(
      sale.kind,
      sale.status,
      nextPaidAmount,
      nextLineItems,
      sale.discount,
    );

    const existingLineReturnEvents = ((sale as unknown as { returnEvents?: ReturnEventValue[] }).returnEvents ?? []);
    const nextReturnEvents = [
      buildReturnEvent({
        lineItem: lineItem as unknown as Record<string, unknown>,
        quantity: lineItem.quantity,
        refundAmount,
        returnedAt: createdAt,
        actor,
      }),
      ...existingLineReturnEvents,
    ];

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        paidAmount: nextPaidAmount,
        lineItems: nextLineItems,
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
        returnEvents: nextReturnEvents,
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new HttpError(404, 'Sale not found.');
    }

    return formatReturnSaleResult(updatedSale, actor);
  } catch (error) {
    await Product.findByIdAndUpdate(productId, {
      $inc: { quantity: -lineItem.quantity },
      $set: { purchasePlace: previousProduct.purchasePlace },
    });
    throw error;
  }
};

export const returnSaleLineItemBySerials = async (
  saleId: string,
  payload: {
    lineItemId?: unknown;
    serialNumbers?: unknown;
    cashboxId?: unknown;
    refundAmount?: unknown;
    warehouse?: unknown;
    author?: unknown;
  },
  actor?: EmployeeCashboxActor | null,
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) {
    throw new HttpError(404, 'Sale not found.');
  }
  if (sale.kind !== 'sale') {
    throw new HttpError(400, 'Only product sales can be returned this way.');
  }

  const lineItemId = String(payload.lineItemId ?? '').trim();
  const lineItemIndex = (sale.lineItems ?? []).findIndex(
    (item) => item.id === lineItemId && item.kind === 'product',
  );
  if (lineItemIndex < 0) {
    throw new HttpError(404, 'Product line item not found.');
  }
  const lineItem = (sale.lineItems ?? [])[lineItemIndex];
  if (!lineItem) {
    throw new HttpError(404, 'Product line item not found.');
  }
  const productId = lineItem.productId?.toString();
  if (!productId) {
    throw new HttpError(400, 'Line item is not linked to a stock product.');
  }
  isValidObjectIdOrThrow(productId, 'lineItems.productId');

  const requestedSerialNumbers = Array.isArray(payload.serialNumbers)
    ? Array.from(
        new Set(
          payload.serialNumbers
            .map((value) => String(value ?? '').trim().toUpperCase())
            .filter(Boolean),
        ),
      )
    : [];
  if (requestedSerialNumbers.length === 0) {
    throw new HttpError(400, 'At least one serial number is required.');
  }

  const lineItemSerials = Array.isArray(lineItem.serialNumbers)
    ? lineItem.serialNumbers
        .map((value) => String(value ?? '').trim().toUpperCase())
        .filter(Boolean)
    : [];
  if (lineItemSerials.length === 0) {
    throw new HttpError(400, 'Line item has no bound serial numbers.');
  }

  const missingSerials = requestedSerialNumbers.filter(
    (serial) => !lineItemSerials.includes(serial),
  );
  if (missingSerials.length > 0) {
    throw new HttpError(400, `Serial numbers are not bound to this line item: ${missingSerials.join(', ')}`);
  }

  const returnQuantity = requestedSerialNumbers.length;
  if (returnQuantity > lineItem.quantity) {
    throw new HttpError(400, 'Serial count cannot exceed line item quantity.');
  }

  const unitPrice = lineItem.quantity > 0 ? lineItem.price : 0;
  const maxRefundForSelection =
    Math.round(unitPrice * returnQuantity * 100) / 100;
  const refundAmount = Math.round(toNumber(payload.refundAmount) * 100) / 100;
  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0 ||
    refundAmount > maxRefundForSelection ||
    refundAmount > (sale.paidAmount ?? 0)
  ) {
    throw new HttpError(400, 'Refund amount cannot exceed selected serials total or paid amount.');
  }

  const cashboxId = String(payload.cashboxId ?? '').trim();
  assertEmployeeCanTransactWithCashbox(actor, cashboxId);
  const warehouse = String(payload.warehouse ?? '').trim() || 'Warehouse';
  const author = String(payload.author ?? '').trim() || 'System';
  const createdAt = new Date();
  const nextPaidAmount = Math.max(
    Math.round(((sale.paidAmount ?? 0) - refundAmount) * 100) / 100,
    0,
  );

  const nextLineItems =
    returnQuantity === lineItem.quantity
      ? (sale.lineItems ?? []).filter((_, index) => index !== lineItemIndex)
      : (sale.lineItems ?? []).map((item, index) =>
          index !== lineItemIndex
            ? item
            : {
                ...scaleReturnedLineItemCostSnapshots(
                  item as unknown as CostableSaleLineItem,
                  lineItem.quantity - returnQuantity,
                ),
                serialNumbers: lineItemSerials.filter(
                  (serial) => !requestedSerialNumbers.includes(serial),
                ),
              },
        );

  const previousProduct = await receiveProductToWarehouse(
    productId,
    returnQuantity,
    warehouse,
  );

  try {
    const transaction = await createFinanceTransaction({
      type: 'withdraw',
      amount: String(refundAmount),
      currency: 'UAH',
      fromCashboxId: cashboxId,
      note: `Serial return for sale ${sale.recordNumber ?? sale._id.toString()}: ${lineItem.name}`,
      category: 'client_refund',
    });
    const cashboxName = transaction.fromCashbox?.name ?? 'Cashbox';
    const nextPaymentHistory = [
      {
        id: randomUUID(),
        type: 'refund' as const,
        amount: refundAmount,
        cashboxId,
        cashboxName,
        author,
        createdAt,
      },
      ...(sale.paymentHistory ?? []),
    ];
    const nextTimeline = [
      {
        id: randomUUID(),
        kind: 'system',
        author,
        message: `Returned serials [${requestedSerialNumbers.join(', ')}] for "${lineItem.name}" to ${warehouse}; refunded ${refundAmount} UAH from ${cashboxName}.`,
        createdAt,
      },
      ...(sale.timeline ?? []),
    ];

    assertWorkspaceState(
      sale.kind,
      sale.status,
      nextPaidAmount,
      nextLineItems,
      sale.discount,
    );

    const existingLineReturnEvents = ((sale as unknown as { returnEvents?: ReturnEventValue[] }).returnEvents ?? []);
    const nextReturnEvents = [
      buildReturnEvent({
        lineItem: lineItem as unknown as Record<string, unknown>,
        quantity: lineItem.quantity,
        refundAmount,
        returnedAt: createdAt,
        actor,
      }),
      ...existingLineReturnEvents,
    ];

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        paidAmount: nextPaidAmount,
        lineItems: nextLineItems,
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
        returnEvents: nextReturnEvents,
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new HttpError(404, 'Sale not found.');
    }

    return formatReturnSaleResult(updatedSale, actor);
  } catch (error) {
    await Product.findByIdAndUpdate(productId, {
      $inc: { quantity: -returnQuantity },
      $set: { purchasePlace: previousProduct.purchasePlace },
    });
    throw error;
  }
};

export const returnSaleLineItemToStock = async (
  saleId: string,
  payload: {
    lineItemId?: unknown;
    warehouse?: unknown;
    author?: unknown;
  },
  actor?: Pick<EmployeeDocument, '_id' | 'name' | 'role' | 'permissions'> | null,
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');
  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) throw new HttpError(404, 'Sale not found.');

  const lineItemId = String(payload.lineItemId ?? '').trim();
  const lineItemIndex = (sale.lineItems ?? []).findIndex(
    (item) => item.id === lineItemId && item.kind === 'product',
  );
  if (lineItemIndex < 0) {
    throw new HttpError(404, 'Product line item not found.');
  }
  const lineItem = (sale.lineItems ?? [])[lineItemIndex];
  if (!lineItem) {
    throw new HttpError(404, 'Product line item not found.');
  }
  const productId = lineItem.productId?.toString();
  if (!productId) {
    throw new HttpError(400, 'Line item is not linked to a stock product.');
  }
  isValidObjectIdOrThrow(productId, 'lineItems.productId');

  const currentLineItems = sale.lineItems ?? [];
  const refundableAmount = calculateLineItemRefundableAmount(
    sale,
    lineItem,
    currentLineItems,
  );
  const maxPaidAfterReturn = Math.max(
    Math.round(
      (calculateTotalAfterDiscount(currentLineItems, sale.discount) -
        refundableAmount) *
        100,
    ) / 100,
    0,
  );
  const currentPaidAmount = sale.paidAmount ?? 0;
  if (currentPaidAmount > maxPaidAfterReturn) {
    throw new HttpError(
      400,
      `Refund ${refundableAmount} UAH to client before returning product to stock.`,
    );
  }

  const warehouse = String(payload.warehouse ?? '').trim() || 'Warehouse';
  const author = String(payload.author ?? '').trim() || 'System';
  const createdAt = new Date();
  const nextLineItems = currentLineItems.filter(
    (_, index) => index !== lineItemIndex,
  );
  const previousProduct = await receiveProductToWarehouse(
    productId,
    lineItem.quantity,
    warehouse,
  );

  try {
    assertWorkspaceState(
      sale.kind,
      sale.status,
      currentPaidAmount,
      nextLineItems,
      sale.discount,
    );
    const existingStockReturnEvents = ((sale as unknown as { returnEvents?: ReturnEventValue[] }).returnEvents ?? []);
    const nextStockReturnEvents = [
      buildReturnEvent({
        lineItem: lineItem as unknown as Record<string, unknown>,
        quantity: lineItem.quantity,
        refundAmount: 0,
        returnedAt: createdAt,
        actor,
      }),
      ...existingStockReturnEvents,
    ];

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        lineItems: nextLineItems,
        returnEvents: nextStockReturnEvents,
        timeline: [
          {
            id: randomUUID(),
            kind: 'system',
            author,
            message: `Returned "${lineItem.name}" to ${warehouse} (stock only).`,
            createdAt,
          },
          ...(sale.timeline ?? []),
        ],
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<SaleDocument | null>();
    if (!updatedSale) throw new HttpError(404, 'Sale not found.');
    return formatReturnSaleResult(updatedSale, actor);
  } catch (error) {
    await Product.findByIdAndUpdate(productId, {
      $inc: { quantity: -lineItem.quantity },
      $set: { purchasePlace: previousProduct.purchasePlace },
    });
    throw error;
  }
};

export const returnSale = async (
  saleId: string,
  payload: {
    cashboxId?: unknown;
    refundAmount?: unknown;
    warehouse?: unknown;
    author?: unknown;
  },
  actor?: EmployeeCashboxActor | null,
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) {
    throw new HttpError(404, 'Sale not found.');
  }
  if (sale.kind !== 'sale') {
    throw new HttpError(400, 'Only product sales can be returned this way.');
  }
  if (sale.status === 'returned') {
    throw new HttpError(400, 'Sale is already returned.');
  }

  const lineItems = sale.lineItems ?? [];
  const productLineItems = lineItems.filter((item) => item.kind === 'product');
  if (productLineItems.length === 0) {
    throw new HttpError(400, 'Sale has no product line items to return.');
  }

  const stockDeltas = productLineItems.map((item) => {
    const productId = item.productId?.toString();
    if (!productId) {
      throw new HttpError(400, 'Product line item is not linked to a stock product.');
    }
    isValidObjectIdOrThrow(productId, 'lineItems.productId');
    return { productId, quantity: item.quantity };
  });

  const refundAmount = Math.round(toNumber(payload.refundAmount) * 100) / 100;
  const productTotal = calculateLineItemsTotal(productLineItems);
  const remainingLineItems = lineItems.filter((item) => item.kind !== 'product');
  const currentPaidAmount = Math.round((sale.paidAmount ?? 0) * 100) / 100;
  const goodsOnlyAmount = Math.max(0, Math.min(productTotal, currentPaidAmount));
  const isAllowedRefund =
    Math.abs(refundAmount - goodsOnlyAmount) < 0.005 ||
    Math.abs(refundAmount - currentPaidAmount) < 0.005;

  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0 ||
    refundAmount > currentPaidAmount ||
    !isAllowedRefund
  ) {
    throw new HttpError(400, 'Refund amount is not valid for this return.');
  }

  const nextPaidAmount = Math.max(
    Math.round((currentPaidAmount - refundAmount) * 100) / 100,
    0,
  );

  const cashboxId = String(payload.cashboxId ?? '').trim();
  assertEmployeeCanTransactWithCashbox(actor, cashboxId);
  const warehouse = String(payload.warehouse ?? '').trim() || 'Warehouse';
  const author = String(payload.author ?? '').trim() || 'System';
  const createdAt = new Date();

  const previousProducts: Array<{
    productId: string;
    quantity: number;
    purchasePlace: string;
  }> = [];

  for (const delta of stockDeltas) {
    const previousProduct = await receiveProductToWarehouse(
      delta.productId,
      delta.quantity,
      warehouse,
    );
    previousProducts.push({
      productId: delta.productId,
      quantity: delta.quantity,
      purchasePlace: previousProduct.purchasePlace,
    });
  }

  try {
    const hasUnrefundedServices =
      remainingLineItems.length > 0 &&
      Math.abs(currentPaidAmount - goodsOnlyAmount) >= 0.005 &&
      Math.abs(refundAmount - goodsOnlyAmount) < 0.005;
    const notePrefix = hasUnrefundedServices ? 'Return' : 'Full return';
    const orderToken = sale.recordNumber ?? sale._id.toString();

    const transaction = await createFinanceTransaction({
      type: 'withdraw',
      amount: String(refundAmount),
      currency: 'UAH',
      fromCashboxId: cashboxId,
      note: `${notePrefix} for sale ${orderToken}`,
      category: 'client_refund',
    });
    const cashboxName = transaction.fromCashbox?.name ?? 'Cashbox';
    const nextPaymentHistory = [
      {
        id: randomUUID(),
        type: 'refund' as const,
        amount: refundAmount,
        cashboxId,
        cashboxName,
        author,
        createdAt,
      },
      ...(sale.paymentHistory ?? []),
    ];
    const returnedNames = productLineItems.map((item) => item.name).join(', ');
    const nextTimeline = [
      {
        id: randomUUID(),
        kind: 'system',
        author,
        message: `Returned sale to ${warehouse}; products: ${returnedNames}; refunded ${refundAmount} UAH from ${cashboxName}.`,
        createdAt,
      },
      ...(sale.timeline ?? []),
    ];

    assertWorkspaceState(
      sale.kind,
      'returned',
      nextPaidAmount,
      remainingLineItems,
      sale.discount,
    );

    const saleAnyForReturn = sale as unknown as {
      statusTransitions?: StatusTransitionValue[];
      returnEvents?: ReturnEventValue[];
    };
    const nextReturnTransitions = buildNextStatusTransitions({
      existingTransitions: saleAnyForReturn.statusTransitions ?? [],
      fromStatus: sale.status ?? null,
      toStatus: 'returned',
      employee: actor as unknown as Pick<EmployeeDocument, '_id' | 'name'> | null,
      now: createdAt,
    });
    const nextFullReturnEvents = [
      ...productLineItems.map((returnedLine, idx) =>
        buildReturnEvent({
          lineItem: returnedLine as unknown as Record<string, unknown>,
          quantity: returnedLine.quantity,
          refundAmount:
            idx === 0 ? refundAmount : 0,
          returnedAt: createdAt,
          actor,
        }),
      ),
      ...(saleAnyForReturn.returnEvents ?? []),
    ];

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        status: 'returned',
        paidAmount: nextPaidAmount,
        lineItems: remainingLineItems,
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
        statusTransitions: nextReturnTransitions,
        returnEvents: nextFullReturnEvents,
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new HttpError(404, 'Sale not found.');
    }

    return formatReturnSaleResult(updatedSale, actor);
  } catch (error) {
    for (const product of previousProducts) {
      await Product.findByIdAndUpdate(product.productId, {
        $inc: { quantity: -product.quantity },
        $set: { purchasePlace: product.purchasePlace },
      });
    }
    throw error;
  }
};

