import mongoose from 'mongoose';
import { Client, type ClientDocument } from '../client/model';
import { Employee, type EmployeeDocument } from '../employee/model';
import { Product, type ProductDocument } from '../product/model';
import { Sale, type SaleDocument } from './model';
import { formatProduct, formatSale } from '../../shared/lib/formatters';
import { normalizeSalePayload } from '../../shared/lib/parsers';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { getNextRecordNumber } from '../sequence/service';
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
    name: payload.kind === 'sale' ? product.name : 'Repair',
    price: payload.salePrice,
    quantity: payload.quantity,
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
  field: 'managerId' | 'masterId',
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

  const [client, product, manager, master] = await Promise.all([
    Client.findById(payload.clientId).lean<ClientDocument | null>(),
    ensureFreeStock(payload.productId, payload.quantity),
    resolveEmployee(payload.managerId, 'managerId', ['manager', 'owner'], 'orders.manage'),
    resolveEmployee(payload.masterId, 'masterId', ['master', 'owner'], 'repairs.execute'),
  ]);

  if (!client) {
    throw new Error('Client not found.');
  }
  if (client.status === 'blacklist') {
    throw new Error('Sales are blocked for blacklist clients.');
  }

  const updatedProduct = await applyProductQuantityDelta(payload.productId, -payload.quantity);

  try {
    const sale = new Sale({
      saleDate: payload.saleDate,
      client: client._id,
      product: product._id,
      manager: manager?._id ?? null,
      master: master?._id ?? null,
      quantity: payload.quantity,
      salePrice: payload.salePrice,
      kind: normalizedKind,
      status: payload.status || 'new',
      paidAmount: payload.paidAmount || 0,
      note: payload.note,
      timeline: payload.timeline ?? [],
      paymentHistory: payload.paymentHistory ?? [],
      lineItems:
        payload.lineItems.length > 0
          ? payload.lineItems
          : getDefaultLineItems(
              {
                kind: normalizedKind,
                salePrice: payload.salePrice,
                quantity: payload.quantity,
              },
              product,
            ),
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
      product: formatProduct(updatedProduct),
    };
  } catch (error) {
    await Product.findByIdAndUpdate(payload.productId, { $inc: { quantity: payload.quantity } });
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

  const [client, product, manager, master] = await Promise.all([
    Client.findById(payload.clientId).lean<ClientDocument | null>(),
    Product.findById(payload.productId).lean<ProductDocument | null>(),
    resolveEmployee(payload.managerId, 'managerId', ['manager', 'owner'], 'orders.manage'),
    resolveEmployee(payload.masterId, 'masterId', ['master', 'owner'], 'repairs.execute'),
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

  if (existingSale.product.toString() === payload.productId) {
    const availableQuantity =
      Math.max(product.quantity - product.reservedQuantity, 0) + existingSale.quantity;

    if (availableQuantity < payload.quantity) {
      throw new Error('Not enough free stock for this operation.');
    }
  } else {
    await ensureFreeStock(payload.productId, payload.quantity);
  }

  await applyProductQuantityDelta(existingSale.product, existingSale.quantity);

  try {
    const updatedProduct = await applyProductQuantityDelta(payload.productId, -payload.quantity);
    const nextLineItems =
      payload.lineItems.length > 0
        ? payload.lineItems
        : getDefaultLineItems(
            {
              kind: normalizedKind,
              salePrice: payload.salePrice,
              quantity: payload.quantity,
            },
            product,
          );
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
          : undefined,
      },
      { new: true, runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new Error('Sale not found.');
    }

    return {
      sale: formatSale(updatedSale),
      product: formatProduct(updatedProduct),
    };
  } catch (error) {
    await applyProductQuantityDelta(existingSale.product, -existingSale.quantity);
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
      timeline: nextTimeline,
      paymentHistory: nextPaymentHistory,
      lineItems: nextLineItems,
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

  await applyProductQuantityDelta(existingSale.product, existingSale.quantity);
  await Sale.findByIdAndDelete(saleId);

  return { id: saleId, restoredProductId: existingSale.product.toString() };
};
