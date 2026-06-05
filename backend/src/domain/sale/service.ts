import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Client, type ClientDocument } from '../client/model';
import { Employee, type EmployeeDocument } from '../employee/model';
import { CatalogProduct, type CatalogProductDocument } from '../catalog-product/model';
import { Product, type ProductDocument } from '../product/model';
import { Sale, type SaleDocument } from './model';
import { formatProduct, formatSale } from '../../shared/lib/formatters';
import { normalizeSalePayload } from '../../shared/lib/parsers';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { getNextRecordNumber } from '../sequence/service';
import { createFinanceTransaction } from '../finance/service';
import type { SalePayload } from '../shared/types';
import { assertNotStale } from '../../shared/lib/errors';
import { upsertCatalogProducts } from '../catalog-product/service';

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
    { returnDocument: 'after' },
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
    { returnDocument: 'before' },
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
  catalogProductId?: string | mongoose.Types.ObjectId | null;
  serviceId?: string | mongoose.Types.ObjectId | null;
  name: string;
  price: number;
  quantity: number;
  warrantyPeriod?: number;
  serialNumbers?: string[];
};

const isStockCommittedSaleStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  return (
    normalized === 'paid' ||
    normalized === 'issued'
  );
};

const isStockCommittedRepairStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  return (
    normalized === 'issued' ||
    normalized === 'issuedwithoutrepair'
  );
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
  status: string,
  lineItems: SaleLineItem[],
  fallbackQuantity: number,
  fallbackProductId?: mongoose.Types.ObjectId | string | null,
): StockLine[] => {
  const isStockCommitted =
    kind === 'sale'
      ? isStockCommittedSaleStatus(status)
      : isStockCommittedRepairStatus(status);

  if (!isStockCommitted) {
    return [];
  }

  const stockMap = new Map<string, number>();

  lineItems.forEach((item) => {
    const productId = item.productId?.toString();

    if (item.kind === 'product' && productId) {
      addStockQuantity(stockMap, productId, item.quantity);
    }
  });

  const normalizedFallbackProductId = fallbackProductId?.toString().trim();
  if (stockMap.size === 0 && normalizedFallbackProductId) {
    addStockQuantity(stockMap, normalizedFallbackProductId, fallbackQuantity);
  }

  return Array.from(stockMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

const assertSerialNumbersNotBoundToOtherSales = async (
  saleId: string,
  lineItems: SaleLineItem[],
) => {
  const requestedSerials = Array.from(
    new Set(
      lineItems
        .filter((item) => item.kind === 'product')
        .flatMap((item) => item.serialNumbers ?? [])
        .map((serial) => String(serial ?? '').trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  if (requestedSerials.length === 0) return;

  const query = {
    ...(saleId ? { _id: { $ne: saleId } } : {}),
    'lineItems.serialNumbers.0': { $exists: true },
  };

  const otherSales = await Sale.find(query)
    .select({ lineItems: 1 })
    .lean<SaleDocument[]>();

  const occupied = new Set<string>();
  otherSales.forEach((sale) => {
    (sale.lineItems ?? []).forEach((item) => {
      if (item.kind !== 'product') return;
      (item.serialNumbers ?? [])
        .map((serial) => String(serial ?? '').trim().toUpperCase())
        .filter(Boolean)
        .forEach((serial) => occupied.add(serial));
    });
  });

  const duplicates = requestedSerials.filter((serial) =>
    occupied.has(serial),
  );
  if (duplicates.length > 0) {
    throw new Error(
      `Serial numbers are already bound to another order: ${duplicates.join(', ')}`,
    );
  }
};

const assertSerializedLineItemsAreAtomic = async (
  lineItems: SaleLineItem[],
) => {
  for (const item of lineItems) {
    if (item.kind !== 'product' || !item.productId) continue;

    const serialNumbers = Array.from(
      new Set(
        (item.serialNumbers ?? [])
          .map((serial) => String(serial ?? '').trim().toUpperCase())
          .filter(Boolean),
      ),
    );

    if (serialNumbers.length > 0) {
      if (serialNumbers.length !== 1 || item.quantity !== 1) {
        throw new Error(
          'Serialized product line items must contain exactly one serial number and quantity 1.',
        );
      }

      isValidObjectIdOrThrow(item.productId.toString(), 'lineItems.productId');
      const product = await Product.findById(item.productId).lean<ProductDocument | null>();
      if (!product) {
        throw new Error('Product not found.');
      }

      const productSerial = String(product.serialNumber ?? '').trim().toUpperCase();
      if (!productSerial || productSerial !== serialNumbers[0]) {
        throw new Error(
          'Serialized product line item must reference the matching stock product.',
        );
      }
      continue;
    }

    if (item.quantity > 1) {
      isValidObjectIdOrThrow(item.productId.toString(), 'lineItems.productId');
      const product = await Product.findById(item.productId).lean<ProductDocument | null>();
      const productSerial = String(product?.serialNumber ?? '').trim();
      if (productSerial) {
        throw new Error(
          'Serialized stock products cannot be sold with quantity greater than 1.',
        );
      }
    }
  }
};

const assertLineItemCatalogProductIds = async (
  lineItems: SaleLineItem[],
) => {
  const catalogProductIds = Array.from(
    new Set(
      lineItems
        .map((item) => item.catalogProductId?.toString().trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (catalogProductIds.length === 0) return;

  catalogProductIds.forEach((catalogProductId) =>
    isValidObjectIdOrThrow(catalogProductId, 'lineItems.catalogProductId'),
  );

  const count = await CatalogProduct.countDocuments({
    _id: { $in: catalogProductIds },
  });
  if (count !== catalogProductIds.length) {
    throw new Error('Catalog product not found.');
  }
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

const normalizeDiscount = (
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

const calculateDiscountAmount = (
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

const calculateTotalAfterDiscount = (
  lineItems: Array<{ price: number; quantity: number }>,
  discount?: { mode?: string; value?: number } | null,
) => {
  const total = calculateLineItemsTotal(lineItems);
  const discountAmount = calculateDiscountAmount(total, discount);
  return Math.max(Math.round((total - discountAmount) * 100) / 100, 0);
};
const calculateLineItemRefundableAmount = (
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

const getDefaultLineItems = (
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

const syncCatalogProductsFromSale = async (
  sourceTag: 'order-card' | 'sales-card' | 'sales-flow',
  lineItems: Array<{ kind: string; name: string }>,
) => {
  const names = lineItems
    .filter((item) => item.kind === 'product')
    .map((item) => item.name);
  await upsertCatalogProducts(names, sourceTag);
};

const assertWorkspaceState = (
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
    throw new Error('Paid amount cannot be negative.');
  }

  const total = calculateTotalAfterDiscount(lineItems, discount);
  if (paidAmount > total) {
    throw new Error('Paid amount cannot exceed order total.');
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
    throw new Error(
      'Refund client payment for bound products and return them to stock first.',
    );
  }

  const isClosingStatus =
    kind === 'repair'
      ? status === 'issued' || status === 'issuedWithoutRepair'
      : status === 'issued' || status === 'paid';

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
  const hasProductId = Boolean(payload.productId);
  if (hasProductId) {
    isValidObjectIdOrThrow(payload.productId, 'productId');
  }
  assertSalePayload(payload.quantity, payload.salePrice);

  const [client, product, manager, master, issuedBy] = await Promise.all([
    Client.findById(payload.clientId).lean<ClientDocument | null>(),
    hasProductId ? Product.findById(payload.productId).lean<ProductDocument | null>() : null,
    resolveEmployee(payload.managerId, 'managerId', ['manager', 'owner'], 'orders.manage'),
    resolveEmployee(payload.masterId, 'masterId', ['master', 'owner'], 'repairs.execute'),
    resolveActiveEmployee(payload.issuedById, 'issuedById'),
  ]);
  const catalogProduct =
    hasProductId && !product
      ? await CatalogProduct.findById(payload.productId).lean<CatalogProductDocument | null>()
      : null;

  if (!client) {
    throw new Error('Client not found.');
  }
  if (client.status === 'blacklist') {
    throw new Error('Sales are blocked for blacklist clients.');
  }
  if (normalizedKind === 'sale' && hasProductId && !product && !catalogProduct) {
    throw new Error('Product not found.');
  }

  const fallbackProduct = product ?? catalogProduct;
  const lineItems =
    payload.lineItems.length > 0
      ? payload.lineItems
      : fallbackProduct
        ? getFallbackLineItems(
            normalizedKind,
            payload.salePrice,
            payload.quantity,
            fallbackProduct,
          )
        : [];
  const primaryLineItemName =
    lineItems.find((item) => item.kind === 'product')?.name?.trim() ?? '';
  const stockDeltas =
    normalizedKind === 'sale' && !product
      ? []
      : getStockLines(
          normalizedKind,
          payload.status || 'new',
          lineItems,
          payload.quantity,
          product?._id ?? payload.productId,
        );

  let stockDeltasApplied = false;

  try {
    await assertSerialNumbersNotBoundToOtherSales('', lineItems);
    await assertSerializedLineItemsAreAtomic(lineItems);
    await assertLineItemCatalogProductIds(lineItems);
    await applyStockDeltas(stockDeltas);
    stockDeltasApplied = true;
    const updatedProduct = product
      ? await Product.findById(product._id).lean<ProductDocument | null>()
      : null;

    const sale = new Sale({
      saleDate: payload.saleDate,
      client: client._id,
      product: product?._id ?? null,
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
      discount: normalizeDiscount(payload.discount),
      productSnapshot: {
        article: product?.article || (normalizedKind === 'sale' ? 'SALE' : 'REPAIR'),
        name:
          payload.deviceName ||
          product?.name ||
          catalogProduct?.name ||
          primaryLineItemName ||
          (normalizedKind === 'sale' ? 'Sale' : 'Repair'),
        serialNumber: payload.serialNumber || product?.serialNumber || '',
      },
      clientSnapshot: {
        name: client.name,
        phone: client.phone,
        status: client.status,
        email: client.email ?? '',
        address: client.address ?? '',
        registrationId: client.registrationId ?? '',
        iban: client.iban ?? '',
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
      sale.discount,
    );
    await sale.validate();
    sale.recordNumber = await getNextRecordNumber();
    await sale.save();
    await syncCatalogProductsFromSale(
      normalizedKind === 'sale' ? 'sales-flow' : 'order-card',
      sale.lineItems,
    );

    return {
      sale: formatSale(sale.toObject<SaleDocument>()),
      product: updatedProduct ? formatProduct(updatedProduct) : null,
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
  const hasProductId = Boolean(payload.productId);
  if (hasProductId) {
    isValidObjectIdOrThrow(payload.productId, 'productId');
  }
  assertSalePayload(payload.quantity, payload.salePrice);

  const existingSale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!existingSale) {
    throw new Error('Sale not found.');
  }
  assertNotStale(payloadInput.expectedUpdatedAt, existingSale.updatedAt, 'Sale');

  const [client, product, manager, master, issuedBy] = await Promise.all([
    Client.findById(payload.clientId).lean<ClientDocument | null>(),
    hasProductId ? Product.findById(payload.productId).lean<ProductDocument | null>() : null,
    resolveEmployee(payload.managerId, 'managerId', ['manager', 'owner'], 'orders.manage'),
    resolveEmployee(payload.masterId, 'masterId', ['master', 'owner'], 'repairs.execute'),
    resolveActiveEmployee(payload.issuedById, 'issuedById'),
  ]);
  const catalogProduct =
    hasProductId && !product
      ? await CatalogProduct.findById(payload.productId).lean<CatalogProductDocument | null>()
      : null;

  if (!client) {
    throw new Error('Client not found.');
  }
  if (client.status === 'blacklist') {
    throw new Error('Sales are blocked for blacklist clients.');
  }
  if (normalizedKind === 'sale' && hasProductId && !product && !catalogProduct) {
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
            _id: existingSale.product ?? '',
            name: existingSale.productSnapshot?.name ?? 'Item',
          },
        );
  const fallbackProduct = product ?? catalogProduct;
  const nextLineItems =
    payload.lineItems.length > 0
      ? payload.lineItems
      : fallbackProduct
        ? getFallbackLineItems(
            normalizedKind,
            payload.salePrice,
            payload.quantity,
            fallbackProduct,
          )
        : [];
  const nextPrimaryLineItemName =
    nextLineItems.find((item) => item.kind === 'product')?.name?.trim() ?? '';
  const stockDeltas =
    normalizedKind === 'sale' && !product
      ? []
      : getStockDeltas(
          getStockLines(
            existingSale.kind === 'sale' ? 'sale' : 'repair',
            existingSale.status || 'new',
            currentLineItems,
            existingSale.quantity,
            existingSale.product ?? '',
          ),
          getStockLines(
            normalizedKind,
            payload.status || existingSale.status || 'new',
            nextLineItems,
            payload.quantity,
            product?._id ?? payload.productId,
          ),
        );

  let stockDeltasApplied = false;

  try {
    await assertLineItemCatalogProductIds(nextLineItems);
    await applyStockDeltas(stockDeltas);
    stockDeltasApplied = true;
    assertWorkspaceState(
      normalizedKind,
      payload.status || existingSale.status || 'new',
      payload.paidAmount || 0,
      nextLineItems,
      payload.discount,
    );
    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        saleDate: payload.saleDate,
        client: client._id,
        product: product?._id ?? existingSale.product ?? null,
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
        discount: normalizeDiscount(payload.discount),
        productSnapshot: {
          article:
            product?.article ||
            existingSale.productSnapshot?.article ||
            (normalizedKind === 'sale' ? 'SALE' : 'REPAIR'),
          name:
            payload.deviceName ||
            product?.name ||
            catalogProduct?.name ||
            nextPrimaryLineItemName ||
            existingSale.productSnapshot?.name ||
            (normalizedKind === 'sale' ? 'Sale' : 'Repair'),
          serialNumber:
            payload.serialNumber ||
            product?.serialNumber ||
            existingSale.productSnapshot?.serialNumber ||
            '',
        },
        clientSnapshot: {
          name: client.name,
          phone: client.phone,
          status: client.status,
          email: client.email ?? '',
          address: client.address ?? '',
          registrationId: client.registrationId ?? '',
          iban: client.iban ?? '',
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
      { returnDocument: 'after', runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new Error('Sale not found.');
    }
    await syncCatalogProductsFromSale(
      normalizedKind === 'sale' ? 'sales-card' : 'order-card',
      updatedSale.lineItems ?? [],
    );
    const updatedProduct = product
      ? await Product.findById(product._id).lean<ProductDocument | null>()
      : null;

    return {
      sale: formatSale(updatedSale),
      product: updatedProduct ? formatProduct(updatedProduct) : null,
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
  assertNotStale(payloadInput.expectedUpdatedAt, existingSale.updatedAt, 'Sale');

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
  const hasIssuedByUpdate = payloadInput.issuedById !== undefined;
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
    Array.isArray(payloadInput.lineItems)
      ? payload.lineItems
      : (existingSale.lineItems?.length
          ? existingSale.lineItems
          : getFallbackLineItems(
              nextKind,
              existingSale.salePrice,
              existingSale.quantity,
              {
                _id: existingSale.product ?? '',
                name: existingSale.productSnapshot?.name ?? 'Item',
              },
            ));
  const nextDeviceName =
    payload.deviceName || existingSale.productSnapshot?.name || '';
  const nextSerialNumber =
    payload.serialNumber !== undefined
      ? payload.serialNumber
      : (existingSale.productSnapshot?.serialNumber ?? '');
  const normalizedLineItems = nextLineItems;
  const nextDiscount =
    payloadInput.discount === undefined
      ? normalizeDiscount(existingSale.discount)
      : normalizeDiscount(payload.discount);
  const master = await resolveEmployee(
    payload.masterId,
    'masterId',
    ['master', 'owner'],
    'repairs.execute',
  );

  if (
    nextKind === 'sale' &&
    nextStatus === 'returned' &&
    (normalizedLineItems.some((item) => item.kind === 'product') ||
      nextPaidAmount > 0)
  ) {
    throw new Error(
      'Sale can be marked returned only after products are returned to stock and client payment is fully refunded.',
    );
  }

  assertWorkspaceState(
    nextKind,
    nextStatus,
    nextPaidAmount,
    normalizedLineItems,
    nextDiscount,
  );

  await assertSerialNumbersNotBoundToOtherSales(
    saleId,
    normalizedLineItems,
  );
  await assertSerializedLineItemsAreAtomic(normalizedLineItems);
  await assertLineItemCatalogProductIds(normalizedLineItems);

  const currentStockLines = getStockLines(
    existingSale.kind === 'sale' ? 'sale' : 'repair',
    existingSale.status || 'new',
    (existingSale.lineItems?.length
      ? existingSale.lineItems
      : getFallbackLineItems(
          existingSale.kind === 'sale' ? 'sale' : 'repair',
          existingSale.salePrice,
          existingSale.quantity,
          {
            _id: existingSale.product ?? '',
            name: existingSale.productSnapshot?.name ?? 'Item',
          },
        )) as SaleLineItem[],
    existingSale.quantity,
    existingSale.product ?? '',
  );
  const nextStockLines = getStockLines(
    nextKind,
    nextStatus,
    normalizedLineItems,
    existingSale.quantity,
    existingSale.product ?? '',
  );
  const stockDeltas = getStockDeltas(currentStockLines, nextStockLines);
  let stockDeltasApplied = false;

  try {
    await applyStockDeltas(stockDeltas);
    stockDeltasApplied = true;

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        kind: nextKind,
        status: nextStatus,
        paidAmount: nextPaidAmount,
        master: master?._id ?? existingSale.master ?? null,
        issuedBy: hasIssuedByUpdate
          ? issuedBy?._id ?? null
          : existingSale.issuedBy ?? null,
        timeline: nextTimeline,
        paymentHistory: nextPaymentHistory,
        lineItems: normalizedLineItems,
        discount: nextDiscount,
        productSnapshot: {
          article: existingSale.productSnapshot?.article ?? '',
          name: nextDeviceName || existingSale.productSnapshot?.name || '',
          serialNumber: nextSerialNumber ?? '',
        },
        masterSnapshot: master
          ? { name: master.name, role: master.role }
          : existingSale.masterSnapshot,
        issuedBySnapshot: hasIssuedByUpdate
          ? (issuedBy
              ? { name: issuedBy.name, role: issuedBy.role }
              : undefined)
          : existingSale.issuedBySnapshot,
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new Error('Sale not found.');
    }
    await syncCatalogProductsFromSale(
      nextKind === 'sale' ? 'sales-card' : 'order-card',
      updatedSale.lineItems ?? [],
    );

    return formatSale(updatedSale);
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
            _id: existingSale.product ?? '',
            name: existingSale.productSnapshot?.name ?? 'Item',
          },
        );
  const stockDeltas = getStockLines(
    existingSale.kind === 'sale' ? 'sale' : 'repair',
    existingSale.status || 'new',
    lineItems,
    existingSale.quantity,
    existingSale.product ?? '',
  ).map((line) => ({
    ...line,
    quantity: -line.quantity,
  }));

  await applyStockDeltas(stockDeltas);
  await Sale.findByIdAndDelete(saleId);

  return { id: saleId, restoredProductId: existingSale.product?.toString() ?? '' };
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

    assertWorkspaceState(
      sale.kind,
      sale.status,
      nextPaidAmount,
      nextLineItems,
      sale.discount,
    );

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        paidAmount: nextPaidAmount,
        lineItems: nextLineItems,
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
      },
      { returnDocument: 'after', runValidators: true },
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
  const lineItemIndex = (sale.lineItems ?? []).findIndex(
    (item) => item.id === lineItemId && item.kind === 'product',
  );
  if (lineItemIndex < 0) {
    throw new Error('Product line item not found.');
  }
  const lineItem = (sale.lineItems ?? [])[lineItemIndex];
  if (!lineItem) {
    throw new Error('Product line item not found.');
  }
  const productId = lineItem.productId?.toString();
  if (!productId) {
    throw new Error('Line item is not linked to a stock product.');
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
    throw new Error('At least one serial number is required.');
  }

  const lineItemSerials = Array.isArray(lineItem.serialNumbers)
    ? lineItem.serialNumbers
        .map((value) => String(value ?? '').trim().toUpperCase())
        .filter(Boolean)
    : [];
  if (lineItemSerials.length === 0) {
    throw new Error('Line item has no bound serial numbers.');
  }

  const missingSerials = requestedSerialNumbers.filter(
    (serial) => !lineItemSerials.includes(serial),
  );
  if (missingSerials.length > 0) {
    throw new Error(`Serial numbers are not bound to this line item: ${missingSerials.join(', ')}`);
  }

  const returnQuantity = requestedSerialNumbers.length;
  if (returnQuantity > lineItem.quantity) {
    throw new Error('Serial count cannot exceed line item quantity.');
  }

  const unitPrice = lineItem.quantity > 0 ? lineItem.price : 0;
  const maxRefundForSelection =
    Math.round(unitPrice * returnQuantity * 100) / 100;
  const refundAmount = Math.round(Number(payload.refundAmount) * 100) / 100;
  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0 ||
    refundAmount > maxRefundForSelection ||
    refundAmount > (sale.paidAmount ?? 0)
  ) {
    throw new Error('Refund amount cannot exceed selected serials total or paid amount.');
  }

  const cashboxId = String(payload.cashboxId ?? '').trim();
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
                ...item,
                quantity: lineItem.quantity - returnQuantity,
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

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        paidAmount: nextPaidAmount,
        lineItems: nextLineItems,
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<SaleDocument | null>();

    if (!updatedSale) {
      throw new Error('Sale not found.');
    }

    return formatSale(updatedSale);
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
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');
  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) throw new Error('Sale not found.');

  const lineItemId = String(payload.lineItemId ?? '').trim();
  const lineItemIndex = (sale.lineItems ?? []).findIndex(
    (item) => item.id === lineItemId && item.kind === 'product',
  );
  if (lineItemIndex < 0) {
    throw new Error('Product line item not found.');
  }
  const lineItem = (sale.lineItems ?? [])[lineItemIndex];
  if (!lineItem) {
    throw new Error('Product line item not found.');
  }
  const productId = lineItem.productId?.toString();
  if (!productId) {
    throw new Error('Line item is not linked to a stock product.');
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
    throw new Error(
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
    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        lineItems: nextLineItems,
        timeline: [
          {
            id: randomUUID(),
            author,
            message: `Returned "${lineItem.name}" to ${warehouse} (stock only).`,
            createdAt,
          },
          ...(sale.timeline ?? []),
        ],
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<SaleDocument | null>();
    if (!updatedSale) throw new Error('Sale not found.');
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

    assertWorkspaceState(
      sale.kind,
      'returned',
      nextPaidAmount,
      remainingLineItems,
      sale.discount,
    );

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      {
        status: 'returned',
        paidAmount: nextPaidAmount,
        lineItems: remainingLineItems,
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
      },
      { returnDocument: 'after', runValidators: true },
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
