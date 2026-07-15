import { Client, type ClientDocument } from '../client/model';
import { CatalogProduct, type CatalogProductDocument } from '../catalog-product/model';
import { Product, type ProductDocument } from '../product/model';
import { Sale, type SaleDocument } from './model';
import { formatProduct, formatSale } from '../../shared/lib/formatters';
import { normalizeSalePayload } from '../../shared/lib/parsers';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import type { SalePayload } from '../shared/types';
import { assertNotStale, HttpError } from '../../shared/lib/errors';
import { withOptionalMongoSession } from '../../shared/lib/mongo-session';
import {
  getStockDeltas,
  getStockLines,
  type SaleLineItem,
} from './stock';
import {
  assertLineItemCatalogProductIds,
  assertSerialNumbersNotBoundToOtherSales,
  assertSerializedLineItemsAreAtomic,
} from './validators';
import {
  applyStockDeltas,
  assertSalePayload,
  assertWorkspaceState,
  buildClientSnapshot,
  getFallbackLineItems,
  normalizeDiscount,
  resolveActiveEmployee,
  resolveEditableSaleStatus,
  resolveEmployee,
  syncCatalogProductsFromSale,
} from './internal';

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
    throw new HttpError(404, 'Sale not found.');
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
    throw new HttpError(404, 'Client not found.');
  }
  if (client.status === 'blacklist') {
    throw new HttpError(400, 'Sales are blocked for blacklist clients.');
  }
  if (normalizedKind === 'sale' && hasProductId && !product && !catalogProduct) {
    throw new HttpError(404, 'Product not found.');
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
    nextLineItems.find((item) => item.kind === 'product')?.name?.trim() ??
    nextLineItems.find((item) => item.kind === 'service')?.name?.trim() ??
    '';
  const nextStatus = resolveEditableSaleStatus(
    normalizedKind,
    payload.status || existingSale.status || 'new',
    payload.paidAmount || 0,
    nextLineItems,
    payload.discount,
  );
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
            nextStatus,
            nextLineItems,
            payload.quantity,
            product?._id ?? payload.productId,
          ),
        );

  await assertLineItemCatalogProductIds(nextLineItems);
  assertWorkspaceState(
    normalizedKind,
    nextStatus,
    payload.paidAmount || 0,
    nextLineItems,
    payload.discount,
  );
  const clientVisitCount = await Sale.countDocuments({ client: client._id });

  const result = await withOptionalMongoSession(async (session) => {
    let stockDeltasApplied = false;
    try {
      await applyStockDeltas(stockDeltas, session);
      stockDeltasApplied = true;
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
          status: nextStatus,
          paidAmount: payload.paidAmount || 0,
          note: payload.note,
          userNote: payload.userNote,
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
          clientSnapshot: buildClientSnapshot(client, clientVisitCount),
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
        { returnDocument: 'after', runValidators: true, session },
      ).lean<SaleDocument | null>();

      if (!updatedSale) {
        throw new HttpError(404, 'Sale not found.');
      }
      const updatedProduct = product
        ? await Product.findById(product._id).lean<ProductDocument | null>()
        : null;

      return {
        sale: formatSale(updatedSale),
        product: updatedProduct ? formatProduct(updatedProduct) : null,
        lineItems: updatedSale.lineItems ?? [],
      };
    } catch (error) {
      if (stockDeltasApplied && !session) {
        await applyStockDeltas(
          stockDeltas.map((delta) => ({
            ...delta,
            quantity: -delta.quantity,
          })),
        );
      }
      throw error;
    }
  });

  await syncCatalogProductsFromSale(
    normalizedKind === 'sale' ? 'sales-card' : 'order-card',
    result.lineItems,
  );

  return {
    sale: result.sale,
    product: result.product,
  };
};

export const updateSaleWorkspace = async (
  saleId: string,
  payloadInput: SalePayload,
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');
  const payload = normalizeSalePayload(payloadInput);
  const existingSale = await Sale.findById(saleId).lean<SaleDocument | null>();

  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  assertNotStale(payloadInput.expectedUpdatedAt, existingSale.updatedAt, 'Sale');

  const nextKind =
    payload.kind === 'sale' || existingSale.kind === 'sale'
      ? 'sale'
      : 'repair';
  const nextPaidAmount =
    payloadInput.paidAmount === undefined
      ? existingSale.paidAmount ?? 0
      : payload.paidAmount;
  const issuedBy = await resolveActiveEmployee(payload.issuedById, 'issuedById');
  const hasIssuedByUpdate = payloadInput.issuedById !== undefined;
  const hasMasterUpdate = payloadInput.masterId !== undefined;
  const hasUserNoteUpdate = payloadInput.userNote !== undefined;
  const nextUserNote = hasUserNoteUpdate
    ? payload.userNote
    : (existingSale.userNote ?? '');
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
  const nextStatus = resolveEditableSaleStatus(
    nextKind,
    payload.status || existingSale.status || 'new',
    nextPaidAmount,
    normalizedLineItems,
    nextDiscount,
  );
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
    throw new HttpError(404, 'Sale can be marked returned only after products are returned to stock and client payment is fully refunded.',
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

  const result = await withOptionalMongoSession(async (session) => {
    let stockDeltasApplied = false;
    try {
      await applyStockDeltas(stockDeltas, session);
      stockDeltasApplied = true;

      const updatedSale = await Sale.findByIdAndUpdate(
        saleId,
        {
          kind: nextKind,
          status: nextStatus,
          paidAmount: nextPaidAmount,
          master: hasMasterUpdate
            ? master?._id ?? null
            : existingSale.master ?? null,
          issuedBy: hasIssuedByUpdate
            ? issuedBy?._id ?? null
            : existingSale.issuedBy ?? null,
          timeline: nextTimeline,
          paymentHistory: nextPaymentHistory,
          lineItems: normalizedLineItems,
          discount: nextDiscount,
          userNote: nextUserNote,
          productSnapshot: {
            article: existingSale.productSnapshot?.article ?? '',
            name: nextDeviceName || existingSale.productSnapshot?.name || '',
            serialNumber: nextSerialNumber ?? '',
          },
          masterSnapshot: hasMasterUpdate
            ? (master ? { name: master.name, role: master.role } : undefined)
            : existingSale.masterSnapshot,
          issuedBySnapshot: hasIssuedByUpdate
            ? (issuedBy
                ? { name: issuedBy.name, role: issuedBy.role }
                : undefined)
            : existingSale.issuedBySnapshot,
        },
        { returnDocument: 'after', runValidators: true, session },
      ).lean<SaleDocument | null>();

      if (!updatedSale) {
        throw new HttpError(404, 'Sale not found.');
      }

      return {
        sale: formatSale(updatedSale),
        lineItems: updatedSale.lineItems ?? [],
      };
    } catch (error) {
      if (stockDeltasApplied && !session) {
        await applyStockDeltas(
          stockDeltas.map((delta) => ({
            ...delta,
            quantity: -delta.quantity,
          })),
        );
      }
      throw error;
    }
  });

  await syncCatalogProductsFromSale(
    nextKind === 'sale' ? 'sales-card' : 'order-card',
    result.lineItems,
  );

  return result.sale;
};

export const deleteSale = async (saleId: string) => {
  isValidObjectIdOrThrow(saleId, 'saleId');

  const existingSale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
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

  await withOptionalMongoSession(async (session) => {
    let stockDeltasApplied = false;
    try {
      await applyStockDeltas(stockDeltas, session);
      stockDeltasApplied = true;
      await Sale.findByIdAndDelete(saleId, { session });
    } catch (error) {
      if (stockDeltasApplied && !session) {
        await applyStockDeltas(
          stockDeltas.map((delta) => ({
            ...delta,
            quantity: -delta.quantity,
          })),
        );
      }
      throw error;
    }
  });

  return { id: saleId, restoredProductId: existingSale.product?.toString() ?? '' };
};
