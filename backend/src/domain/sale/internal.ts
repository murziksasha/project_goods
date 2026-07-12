import mongoose from 'mongoose';
import { getEffectiveClientStatus } from '../client/constants';
import type { ClientDocument } from '../client/model';
import { Employee, type EmployeeDocument } from '../employee/model';
import { Product, type ProductDocument } from '../product/model';
import type { SaleDocument } from './model';
import { getClientPhonesFromRecord } from '../../shared/lib/client-phones';
import { HttpError } from '../../shared/lib/errors';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { upsertCatalogProducts } from '../catalog-product/service';
import {
  getStockLines,
  type StockLine,
} from './stock';

export const buildClientSnapshot = (
  client: Pick<
    ClientDocument,
    'name' | 'phone' | 'phones' | 'status' | 'email' | 'address' | 'registrationId' | 'iban'
  >,
  visitCount: number,
) => ({
  name: client.name,
  phone: client.phone,
  phones: getClientPhonesFromRecord(client),
  status: getEffectiveClientStatus(client.status ?? '', visitCount),
  email: client.email ?? '',
  address: client.address ?? '',
  registrationId: client.registrationId ?? '',
  iban: client.iban ?? '',
});

export const ensureFreeStock = async (
  productId: mongoose.Types.ObjectId | string,
  quantity: number,
) => {
  const product = await Product.findById(productId).lean<ProductDocument | null>();

  if (!product) {
    throw new HttpError(404, 'Product not found.');
  }

  if (Math.max(product.quantity - product.reservedQuantity, 0) < quantity) {
    throw new HttpError(400, 'Not enough free stock for this operation.');
  }

  return product;
};

export const applyProductQuantityDelta = async (
  productId: mongoose.Types.ObjectId | string,
  delta: number,
  session?: mongoose.ClientSession,
) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    { $inc: { quantity: delta } },
    { returnDocument: 'after', session },
  ).lean<ProductDocument | null>();

  if (!product) {
    throw new HttpError(404, 'Product not found.');
  }

  return product;
};

export const receiveProductToWarehouse = async (
  productId: mongoose.Types.ObjectId | string,
  quantity: number,
  warehouse: string,
  session?: mongoose.ClientSession,
) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    {
      $inc: { quantity },
      $set: { purchasePlace: warehouse },
    },
    { returnDocument: 'before', session },
  ).lean<ProductDocument | null>();

  if (!product) {
    throw new HttpError(404, 'Product not found.');
  }

  return product;
};

export const assertStockDeltasAvailable = async (deltas: StockLine[]) => {
  await Promise.all(
    deltas
      .filter((delta) => delta.quantity > 0)
      .map(async (delta) => {
        isValidObjectIdOrThrow(delta.productId, 'lineItems.productId');
        await ensureFreeStock(delta.productId, delta.quantity);
      }),
  );
};

export const applyStockDeltas = async (
  deltas: StockLine[],
  session?: mongoose.ClientSession,
) => {
  await assertStockDeltasAvailable(deltas);

  for (const delta of deltas) {
    isValidObjectIdOrThrow(delta.productId, 'lineItems.productId');
    await applyProductQuantityDelta(delta.productId, -delta.quantity, session);
  }
};

export const getFallbackLineItems = (
  kind: 'repair' | 'sale',
  salePrice: number,
  quantity: number,
  product?: {
    _id?: mongoose.Types.ObjectId | string | null;
    name?: string | null;
  } | null,
) => {
  const productId = product?._id?.toString().trim();
  const productName = String(product?.name ?? '').trim();
  if (!productId || !productName) return [];

  return getDefaultLineItems(
    {
      kind,
      salePrice,
      quantity,
    },
    { _id: productId, name: productName },
  );
};

export const assertSalePayload = (quantity: number, salePrice: number) => {
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new HttpError(400, 'Sale quantity must be at least 1.');
  }

  if (!Number.isFinite(salePrice) || salePrice < 0) {
    throw new HttpError(400, 'Sale price cannot be negative.');
  }
};

export const calculateLineItemsTotal = (
  lineItems: Array<{ price: number; quantity: number }>,
) =>
  Math.round(
    lineItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    ) * 100,
  ) / 100;

export const normalizeDiscount = (
  discount?: { mode?: string; value?: number } | null,
) => {
  const value =
    Number.isFinite(discount?.value) && (discount?.value ?? 0) > 0
      ? (discount?.value as number)
      : 0;

  return {
    mode: discount?.mode === 'percent' ? 'percent' : 'amount',
    value,
  } as const;
};

export const calculateDiscountAmount = (
  total: number,
  discount?: { mode?: string; value?: number } | null,
) => {
  const normalized = normalizeDiscount(discount);
  if (normalized.value <= 0 || total <= 0) return 0;

  if (normalized.mode === 'percent') {
    return Math.min(
      Math.round(((total * normalized.value) / 100) * 100) / 100,
      total,
    );
  }

  return Math.min(Math.round(normalized.value * 100) / 100, total);
};

export const calculateTotalAfterDiscount = (
  lineItems: Array<{ price: number; quantity: number }>,
  discount?: { mode?: string; value?: number } | null,
) => {
  const total = calculateLineItemsTotal(lineItems);
  const discountAmount = calculateDiscountAmount(total, discount);
  return Math.max(Math.round((total - discountAmount) * 100) / 100, 0);
};
export const calculateLineItemRefundableAmount = (
  sale: SaleDocument,
  lineItem: { price: number; quantity: number },
  lineItems: Array<{ price: number; quantity: number }>,
) => {
  const baseTotal = calculateLineItemsTotal(lineItems);
  const itemTotal =
    Math.round(lineItem.price * lineItem.quantity * 100) / 100;
  if (baseTotal <= 0 || itemTotal <= 0) return 0;
  const orderTotal = calculateTotalAfterDiscount(lineItems, sale.discount);
  const ratio = itemTotal / baseTotal;
  const discountedItemTotal = Math.round(orderTotal * ratio * 100) / 100;
  return Math.max(Math.min(discountedItemTotal, itemTotal), 0);
};

export const getDefaultLineItems = (
  payload: {
    kind: 'repair' | 'sale';
    salePrice: number;
    quantity: number;
  },
  product: { _id: mongoose.Types.ObjectId | string; name: string },
) => {
  if (payload.kind === 'repair') {
    return [];
  }

  return [
    {
      id: `${product._id.toString()}-${payload.kind}-default`,
      kind: 'product',
      productId: product._id.toString(),
      name: product.name,
      price: payload.salePrice,
      quantity: payload.quantity,
      warrantyPeriod: 0,
    },
  ];
};

export const syncCatalogProductsFromSale = async (
  sourceTag: 'order-card' | 'sales-card' | 'sales-flow',
  lineItems: Array<{ kind: string; name: string }>,
) => {
  const names = lineItems
    .filter((item) => item.kind === 'product')
    .map((item) => item.name);
  await upsertCatalogProducts(names, sourceTag);
};

export const assertWorkspaceState = (
  kind: 'repair' | 'sale',
  status: string,
  paidAmount: number,
  lineItems: Array<{
    kind: string;
    price: number;
    quantity: number;
    serialNumbers?: string[];
  }>,
  discount?: { mode?: string; value?: number } | null,
) => {
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new HttpError(400, 'Paid amount cannot be negative.');
  }

  const total = calculateTotalAfterDiscount(lineItems, discount);
  if (paidAmount > total) {
    throw new HttpError(400, 'Paid amount cannot exceed order total.');
  }

  const hasAttachedProducts = lineItems.some((item) => item.kind === 'product');
  const hasBoundProductSerials = lineItems.some(
    (item) =>
      item.kind === 'product' &&
      (item.serialNumbers ?? []).some((serial) => String(serial ?? '').trim()),
  );
  const normalizedStatus = status.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const isRepairRefusalStatus =
    kind === 'repair' &&
    (normalizedStatus === 'clientrejected' ||
      normalizedStatus === 'issuedwithoutrepair' ||
      normalizedStatus === 'issuedwithoutrepairing');

  if (isRepairRefusalStatus && hasBoundProductSerials) {
    throw new HttpError(400, 'Refund client payment for bound products and return them to stock first.',
    );
  }

  const isClosingStatus =
    kind === 'repair'
      ? status === 'issued' || status === 'issuedWithoutRepair'
      : status === 'issued' || status === 'paid';

  if (hasAttachedProducts && isClosingStatus && paidAmount < total) {
    throw new HttpError(400, 'Product shipped but payment has not been received.');
  }
};

export const hasPermission = (
  employee: EmployeeDocument,
  requiredRoles: string[],
  requiredPermission: string,
) =>
  requiredRoles.includes(employee.role) ||
  employee.permissions.includes(requiredPermission as never);

export const resolveEmployee = async (
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
    throw new HttpError(404, `${field} employee not found or inactive.`);
  }
  if (!hasPermission(employee, requiredRoles, requiredPermission)) {
    throw new HttpError(403, `${field} employee does not have required permissions.`);
  }
  return employee;
};

export const resolveActiveEmployee = async (
  employeeId: string,
  field: 'issuedById',
) => {
  if (!employeeId) {
    return null;
  }

  isValidObjectIdOrThrow(employeeId, field);
  const employee = await Employee.findById(employeeId).lean<EmployeeDocument | null>();
  if (!employee || !employee.isActive) {
    throw new HttpError(404, `${field} employee not found or inactive.`);
  }
  return employee;
};
