import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Client, type ClientDocument } from '../client/model';
import { Employee, type EmployeeDocument } from '../employee/model';
import { Product, type ProductDocument } from '../product/model';
import { Sale, type SaleDocument } from './model';
import { formatProduct, formatSale } from '../../shared/lib/formatters';
import { normalizeSalePayload } from '../../shared/lib/parsers';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { getNextRecordNumber } from '../sequence/service';
import { createFinanceTransaction } from '../finance/service';
import type { SalePayload } from '../shared/types';

const ensureFreeStock = async (
  productId: mongoose.Types.ObjectId | string,
  quantity: number,
) => {
  const product = await Product.findById(productId).lean<ProductDocument | null>();

  if (!product) {
    throw new Error('Product not found.');
  }

  if (Math.max(product.quantity - product.reservedQuantity, 0) < quantity) {
    throw new Error('Not enough free stock for this operation.');
  }

  return product;
};

const applyProductQuantityDelta = async (
  productId: mongoose.Types.ObjectId | string,
  delta: number,
) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    { $inc: { quantity: delta } },
    { new: true },
  ).lean<ProductDocument | null>();

  if (!product) {
    throw new Error('Product not found.');
  }

  return product;
};

const receiveProductToWarehouse = async (
  productId: mongoose.Types.ObjectId | string,
  quantity: number,
  warehouse: string,
) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    {
      $inc: { quantity },
      $set: { purchasePlace: warehouse },
    },
    { new: false },
  ).lean<ProductDocument | null>();

  if (!product) {
    throw new Error('Product not found.');
  }

  return product;
};

type StockLine = {
  productId: string;
  quantity: number;
};

type SaleLineItem = {
  id: string;
  kind: string;
  productId?: string | mongoose.Types.ObjectId | null;
  name: string;
  price: number;
  quantity: number;
  warrantyPeriod?: number;
};

const addStockQuantity = (
  stockMap: Map<string, number>,
  productId: string,
  quantity: number,
) => {
  stockMap.set(productId, (stockMap.get(productId) ?? 0) + quantity);
};

const getStockLines = (
  kind: 'repair' | 'sale',
  lineItems: SaleLineItem[],
  fallbackProductId: mongoose.Types.ObjectId | string,
  fallbackQuantity: number,
): StockLine[] => {
  const stockMap = new Map<string, number>();

  if (kind === 'sale') {
    lineItems.forEach((item) => {
      const productId = item.productId?.toString();

      if (item.kind === 'product' && productId) {
        addStockQuantity(stockMap, productId, item.quantity);
      }
    });
  }

  if (stockMap.size === 0) {
    addStockQuantity(stockMap, fallbackProductId.toString(), fallbackQuantity);
  }

  return Array.from(stockMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

const getStockDeltas = (
  currentLines: StockLine[],
  nextLines: StockLine[],
) => {
  const deltaMap = new Map<string, number>();

  currentLines.forEach((line) => {
    addStockQuantity(deltaMap, line.productId, -line.quantity);
  });
  nextLines.forEach((line) => {
    addStockQuantity(deltaMap, line.productId, line.quantity);
  });

  return Array.from(deltaMap.entries())
    .map(([productId, quantity]) => ({ productId, quantity }))
    .filter((line) => line.quantity !== 0);
};

const assertStockDeltasAvailable = async (deltas: StockLine[]) => {
  await Promise.all(
    deltas
      .filter((delta) => delta.quantity > 0)
      .map(async (delta) => {
        isValidObjectIdOrThrow(delta.productId, 'lineItems.productId');
        await ensureFreeStock(delta.productId, delta.quantity);
      }),
  );
};

const applyStockDeltas = async (deltas: StockLine[]) => {
  await assertStockDeltasAvailable(deltas);

  for (const delta of deltas) {
    isValidObjectIdOrThrow(delta.productId, 'lineItems.productId');
    await applyProductQuantityDelta(delta.productId, -delta.quantity);
  }
};

const getFallbackLineItems = (
  kind: 'repair' | 'sale',
  salePrice: number,
  quantity: number,
  product: { _id: mongoose.Types.ObjectId | string; name: string },
) =>
  getDefaultLineItems(
    {
      kind,
      salePrice,
      quantity,
    },
    product,
  );

const assertSalePayload = (quantity: number, salePrice: number) => {
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error('Sale quantity must be at least 1.');
  }

  if (!Number.isFinite(salePrice) || salePrice < 0) {
    throw new Error('Sale price cannot be negative.');
  }
};

const calculateLineItemsTotal = (
  lineItems: Array<{ price: number; quantity: number }>,
) =>
  Math.round(
    lineItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    ) * 100,
  ) / 100;

const getDefaultLineItems = (
  payload: {
    kind: 'repair' | 'sale';
    salePrice: number;
    quantity: number;
  },
  product: { _id: mongoose.Types.ObjectId | string; name: string },
) => [
  {
    id: `${product._id.toString()}-${payload.kind}-default`,
    kind: payload.kind === 'sale' ? 'product' : 'service',
    productId: payload.kind === 'sale' ? product._id.toString() : undefined,
    name: payload.kind === 'sale' ? product.name : 'Repair',
    price: payload.salePrice,
    quantity: payload.quantity,
    warrantyPeriod: 0,
  },
];

const assertWorkspaceState = (
  kind: 'repair' | 'sale',
  status: string,
  paidAmount: number,
  lineItems: Array<{ kind: string; price: number; quantity: number }>,
) => {
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new Error('Paid amount cannot be negative.');
  }

  const total = calculateLineItemsTotal(lineItems);
  if (paidAmount > total) {
    throw new Error('Paid amount cannot exceed order total.');
  }

  const hasAttachedProducts = lineItems.some((item) => item.kind === 'product');
  const isClosingStatus =
    kind === 'repair'
      ? status === 'issued' || status === 'issuedWithoutRepair'
      : status === 'paid' || status === 'completed';

  if (hasAttachedProducts && isClosingStatus && paidAmount < total) {
    throw new Error('Product shipped but payment has not been received.');
  }
};

const hasPermission = (
  employee: EmployeeDocument,
  requiredRoles: string[],
  requiredPermission: string,
) =>
  requiredRoles.includes(employee.role) ||
  employee.permissions.includes(requiredPermission as never);

const resolveEmployee = async (
  employeeId: string,
  field: 'managerId' | 'masterId' | 'issuedById',
  requiredRoles: string[],
  requiredPermission: string,
) => {
  if (!employeeId) {
    return null;
  }

  isValidObjectIdOrThrow(employeeId, field);
  const employee = await Employee.findById(employeeId).lean<EmployeeDocument | null>();
  if (!employee || !employee.isActive) {
    throw new Error(`${field} employee not found or inactive.`);
  }
  if (!hasPermission(employee, requiredRoles, requiredPermission)) {
    throw new Error(`${field} employee does not have required permissions.`);
  }
  return employee;
};

const resolveActiveEmployee = async (
  employeeId: string,
  field: 'issuedById',
) => {
  if (!employeeId) {
    return null;
  }

  isValidObjectIdOrThrow(employeeId, field);
  const employee = await Employee.findById(employeeId).lean<EmployeeDocument | null>();
  if (!employee || !employee.isActive) {
    throw new Error(`${field} employee not found or inactive.`);
  }
  return employee;
};

export const listSales = async () => {
  const sales = await Sale.find().sort({ saleDate: -1 }).lean<SaleDocument[]>();
  return sales.map(formatSale);
};

export const createSale = async (payloadInput: SalePayload) => {
  const payload = normalizeSalePayload(payloadInput);
  const normalizedKind = payload.kind === 'sale' ? 'sale' : 'repair';
  isValidObjectIdOrThrow(payload.clientId, 'clientId');
  isValidObjectIdOrThrow(payload.productId, 'productId');
  assertSalePayload(payload.quantity, payload.salePrice);

  const [client, product, manager, master, issuedBy] = await Promise.all([
    Client.findById(payload.clientId).lean<ClientDocument | null>(),
    Product.findById(payload.productId).lean<ProductDocument | null>(),
    resolveEmployee(payload.managerId, 'managerId', ['manager', 'owner'], 'orders.manage'),
    resolveEmployee(payload.masterId, 'masterId', ['master', 'owner'], 'repairs.execute'),
    resolveActiveEmployee(payload.issuedById, 'issuedById'),
  ]);

  if (!client) {
    throw new Error('Client not found.');
  }
  if (client.status === 'blacklist') {
    throw new Error('Sales are blocked for blacklist clients.');
  }
  if (!product) {
    throw new Error('Product not found.');
  }

  const lineItems =
    payload.lineItems.length > 0
      ? payload.lineItems
      : getFallbackLineItems(
          normalizedKind,
          payload.salePrice,
          payload.quantity,
          product,
        );
  const stockDeltas = getStockLines(
    normalizedKind,
    lineItems,
    payload.productId,
    payload.quantity,
  );

  let stockDeltasApplied = false;

  try {
    await applyStockDeltas(stockDeltas);
    stockDeltasApplied = true;
    const updatedProduct = await Product.findById(payload.productId).lean<ProductDocument | null>();

    const sale = new Sale({
      saleDate: payload.saleDate,
      client: client._id,
      product: product._id,
      manager: manager?._id ?? null,
      master: master?._id ?? null,
      issuedBy: issuedBy?._id ?? null,
      quantity: payload.quantity,
      salePrice: payload.salePrice,
      kind: normalizedKind,
      status: payload.status || 'new',
      paidAmount: payload.paidAmount || 0,
      note: payload.note,
      timeline: payload.timeline ?? [],
      paymentHistory: payload.paymentHistory ?? [],
      lineItems,
      productSnapshot: {
        article: product.article,
        name: product.name,
        serialNumber: product.serialNumber,
      },
      clientSnapshot: {
        name: client.name,
        phone: client.phone,
        status: client.status,
      },
      managerSnapshot: manager
        ? { name: manager.name, role: manager.role }
        : undefined,
      masterSnapshot: master
        ? { name: master.name, role: master.role }
        : undefined,
      issuedBySnapshot: issuedBy
        ? { name: issuedBy.name, role: issuedBy.role }
        : undefined,
    });

    assertWorkspaceState(
      normalizedKind,
      sale.status,
      sale.paidAmount,
      sale.lineItems,
    );
    await sale.validate();
    sale.recordNumber = await getNextRecordNumber();
    await sale.save();

    return {
      sale: formatSale(sale.toObject<SaleDocument>()),
      product: formatProduct(updatedProduct ?? product),
    };
  } catch (error) {
    if (stockDeltasApplied) {
      await applyStockDeltas(
        stockDeltas.map((delta) => ({
          ...delta,
          quantity: -delta.quantity,
        })),
      );
    }
    throw error;
  }
};

export const updateSale = async (saleId: string, payloadInput: SalePayload) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const payload = normalizeSalePayload(payloadInput);
  const normalizedKind = payload.kind === 'sale' ? 'sale' : 'repair';
  isValidObjectIdOrThrow(payload.clientId, 'clientId');
  isValidObjectIdOrThrow(payload.productId, 'productId');
  assertSalePayload(payload.quantity, payload.salePrice);

  const existingSale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!existingSale) {
    throw new Error('Sale not found.');
  }

  const [client, product, manager, master, issuedBy] = await Promise.all([
    Client.findById(payload.clientId).lean<ClientDocument | null>(),
    Product.findById(payload.productId).lean<ProductDocument | null>(),
    resolveEmployee(payload.managerId, 'managerId', ['manager', 'owner'], 'orders.manage'),
    resolveEmployee(payload.masterId, 'masterId', ['master', 'owner'], 'repairs.execute'),
    resolveActiveEmployee(payload.issuedById, 'issuedById'),
  ]);

  if (!client) {
    throw new Error('Client not found.');
  }
  if (client.status === 'blacklist') {
    throw new Error('Sales are blocked for blacklist clients.');
  }
  if (!product) {
    throw new Error('Product not found.');
  }

  const currentLineItems =
    existingSale.lineItems?.length
      ? existingSale.lineItems
      : getFallbackLineItems(
          existingSale.kind === 'sale' ? 'sale' : 'repair',
          existingSale.salePrice,
          existingSale.quantity,
          {
            _id: existingSale.product,
            name: existingSale.productSnapshot?.name ?? 'Item',
          },
        );
  const nextLineItems =
    payload.lineItems.length > 0
      ? payload.lineItems
      : getFallbackLineItems(
          normalizedKind,
          payload.salePrice,
          payload.quantity,
          product,
        );
  const stockDeltas = getStockDeltas(
    getStockLines(
      existingSale.kind === 'sale' ? 'sale' : 'repair',
      currentLineItems,
      existingSale.product,
      existingSale.quantity,
    ),
    getStockLines(
      normalizedKind,
      nextLineItems,
      payload.productId,
      payload.quantity,
    ),
  );

  let stockDeltasApplied = false;

  try {
    await applyStockDeltas(stockDeltas);
    stockDeltasApplied = true;
    assertWorkspaceState(
      normalizedKind,
      payload.status || existingSale.status || 'new',
      payload.paidAmount || 0,
      nextLineItems,
    );
    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        saleDate: payload.saleDate,
        client: client._id,
        product: product._id,
        manager: manager?._id ?? null,
        master: master?._id ?? null,
        issuedBy: issuedBy?._id ?? existingSale.issuedBy ?? null,
        quantity: payload.quantity,
        salePrice: payload.salePrice,
        kind: normalizedKind,
        status: payload.status || existingSale.status || 'new',
        paidAmount: payload.paidAmount || 0,
        note: payload.note,
        timeline: payload.timeline ?? existingSale.timeline ?? [],
        paymentHistory:
          payload.paymentHistory ?? existingSale.paymentHistory ?? [],
        lineItems: nextLineItems,
        productSnapshot: {
          article: product.article,
          name: product.name,
          serialNumber: product.serialNumber,
        },
        clientSnapshot: {
          name: client.name,
          phone: client.phone,
          status: client.status,
        },
        managerSnapshot: manager
          ? { name: manager.name, role: manager.role }
          : undefined,
        masterSnapshot: master
          ? { name: master.name, role: master.role }
          : existingSale.masterSnapshot,
        issuedBySnapshot: issuedBy
          ? { name: issuedBy.name, role: issuedBy.role }
          : existingSale.issuedBySnapshot,
      },
      { new: true, runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new Error('Sale not found.');
    }
    const updatedProduct = await Product.findById(payload.productId).lean<ProductDocument | null>();

    return {
      sale: formatSale(updatedSale),
      product: formatProduct(updatedProduct ?? product),
    };
  } catch (error) {
    if (stockDeltasApplied) {
      await applyStockDeltas(
        stockDeltas.map((delta) => ({
          ...delta,
          quantity: -delta.quantity,
        })),
      );
    }
    throw error;
  }
};

export const updateSaleWorkspace = async (
  saleId: string,
  payloadInput: SalePayload,
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');
  const payload = normalizeSalePayload(payloadInput);
  const existingSale = await Sale.findById(saleId).lean<SaleDocument | null>();

  if (!existingSale) {
    throw new Error('Sale not found.');
  }

  const nextKind =
    payload.kind === 'sale' || existingSale.kind === 'sale'
      ? 'sale'
      : 'repair';
  const nextStatus = payload.status || existingSale.status || 'new';
  const nextPaidAmount =
    payloadInput.paidAmount === undefined
      ? existingSale.paidAmount ?? 0
      : payload.paidAmount;
  const issuedBy = await resolveActiveEmployee(payload.issuedById, 'issuedById');
  const nextTimeline =
    Array.isArray(payloadInput.timeline) && payload.timeline.length > 0
      ? payload.timeline
      : existingSale.timeline ?? [];
  const nextPaymentHistory =
    Array.isArray(payloadInput.paymentHistory) &&
    payload.paymentHistory.length >= 0
      ? payload.paymentHistory
      : existingSale.paymentHistory ?? [];
  const nextLineItems =
    Array.isArray(payloadInput.lineItems) && payload.lineItems.length > 0
      ? payload.lineItems
      : (existingSale.lineItems?.length
          ? existingSale.lineItems
          : getDefaultLineItems(
              {
                kind: nextKind,
                salePrice: existingSale.salePrice,
                quantity: existingSale.quantity,
              },
              {
              _id: existingSale.product,
              name: existingSale.productSnapshot?.name ?? 'Item',
              },
            ));

  assertWorkspaceState(nextKind, nextStatus, nextPaidAmount, nextLineItems);

  const updatedSale = await Sale.findByIdAndUpdate(
    saleId,
    {
      kind: nextKind,
      status: nextStatus,
      paidAmount: nextPaidAmount,
      issuedBy: issuedBy?._id ?? existingSale.issuedBy ?? null,
      timeline: nextTimeline,
      paymentHistory: nextPaymentHistory,
      lineItems: nextLineItems,
      issuedBySnapshot: issuedBy
        ? { name: issuedBy.name, role: issuedBy.role }
        : existingSale.issuedBySnapshot,
    },
    { new: true, runValidators: true },
  ).lean<SaleDocument | null>();

  if (!updatedSale) {
    throw new Error('Sale not found.');
  }

  return formatSale(updatedSale);
};

export const deleteSale = async (saleId: string) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const existingSale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!existingSale) {
    throw new Error('Sale not found.');
  }

  const lineItems =
    existingSale.lineItems?.length
      ? existingSale.lineItems
      : getFallbackLineItems(
          existingSale.kind === 'sale' ? 'sale' : 'repair',
          existingSale.salePrice,
          existingSale.quantity,
          {
            _id: existingSale.product,
            name: existingSale.productSnapshot?.name ?? 'Item',
          },
        );
  const stockDeltas = getStockLines(
    existingSale.kind === 'sale' ? 'sale' : 'repair',
    lineItems,
    existingSale.product,
    existingSale.quantity,
  ).map((line) => ({
    ...line,
    quantity: -line.quantity,
  }));

  await applyStockDeltas(stockDeltas);
  await Sale.findByIdAndDelete(saleId);

  return { id: saleId, restoredProductId: existingSale.product.toString() };
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
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) {
    throw new Error('Sale not found.');
  }
  if (sale.kind !== 'sale') {
    throw new Error('Only product sales can be returned this way.');
  }

  const lineItemId = String(payload.lineItemId ?? '').trim();
  const lineItem = (sale.lineItems ?? []).find((item) => item.id === lineItemId);
  if (!lineItem || lineItem.kind !== 'product') {
    throw new Error('Product line item not found.');
  }

  const productId = lineItem.productId?.toString();
  if (!productId) {
    throw new Error('Line item is not linked to a stock product.');
  }
  isValidObjectIdOrThrow(productId, 'lineItems.productId');

  const refundAmount = Math.round(Number(payload.refundAmount) * 100) / 100;
  const itemTotal = Math.round(lineItem.price * lineItem.quantity * 100) / 100;
  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0 ||
    refundAmount > itemTotal ||
    refundAmount > (sale.paidAmount ?? 0)
  ) {
    throw new Error('Refund amount cannot exceed item total or paid amount.');
  }

  const cashboxId = String(payload.cashboxId ?? '').trim();
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
        author,
        message: `Returned "${lineItem.name}" to ${warehouse}; refunded ${refundAmount} UAH from ${cashboxName}.`,
        createdAt,
      },
      ...(sale.timeline ?? []),
    ];

    assertWorkspaceState(sale.kind, sale.status, nextPaidAmount, nextLineItems);

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        paidAmount: nextPaidAmount,
        lineItems: nextLineItems,
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
      },
      { new: true, runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new Error('Sale not found.');
    }

    return formatSale(updatedSale);
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
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) {
    throw new Error('Sale not found.');
  }
  if (sale.kind !== 'sale') {
    throw new Error('Only product sales can be returned this way.');
  }
  if (sale.status === 'returned') {
    throw new Error('Sale is already returned.');
  }

  const lineItems = sale.lineItems ?? [];
  const productLineItems = lineItems.filter((item) => item.kind === 'product');
  if (productLineItems.length === 0) {
    throw new Error('Sale has no product line items to return.');
  }

  const stockDeltas = productLineItems.map((item) => {
    const productId = item.productId?.toString();
    if (!productId) {
      throw new Error('Product line item is not linked to a stock product.');
    }
    isValidObjectIdOrThrow(productId, 'lineItems.productId');
    return { productId, quantity: item.quantity };
  });

  const refundAmount = Math.round(Number(payload.refundAmount) * 100) / 100;
  const productTotal = calculateLineItemsTotal(productLineItems);
  const remainingLineItems = lineItems.filter((item) => item.kind !== 'product');
  const remainingTotal = calculateLineItemsTotal(remainingLineItems);
  const currentPaidAmount = sale.paidAmount ?? 0;
  const nextPaidAmount = Math.max(
    Math.round((currentPaidAmount - refundAmount) * 100) / 100,
    0,
  );

  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0 ||
    refundAmount > productTotal ||
    refundAmount > currentPaidAmount ||
    nextPaidAmount > remainingTotal
  ) {
    throw new Error('Refund amount is not valid for this return.');
  }

  const cashboxId = String(payload.cashboxId ?? '').trim();
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
    const transaction = await createFinanceTransaction({
      type: 'withdraw',
      amount: String(refundAmount),
      currency: 'UAH',
      fromCashboxId: cashboxId,
      note: `Full return for sale ${sale.recordNumber ?? sale._id.toString()}`,
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
        author,
        message: `Returned sale to ${warehouse}; products: ${returnedNames}; refunded ${refundAmount} UAH from ${cashboxName}.`,
        createdAt,
      },
      ...(sale.timeline ?? []),
    ];

    assertWorkspaceState(sale.kind, 'returned', nextPaidAmount, remainingLineItems);

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        status: 'returned',
        paidAmount: nextPaidAmount,
        lineItems: remainingLineItems,
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
      },
      { new: true, runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new Error('Sale not found.');
    }

    return formatSale(updatedSale);
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
