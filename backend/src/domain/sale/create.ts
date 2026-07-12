import { Client, type ClientDocument } from '../client/model';
import { CatalogProduct, type CatalogProductDocument } from '../catalog-product/model';
import { Product, type ProductDocument } from '../product/model';
import { Sale, type SaleDocument } from './model';
import { formatProduct, formatSale } from '../../shared/lib/formatters';
import { normalizeSalePayload } from '../../shared/lib/parsers';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { getNextRecordNumber } from '../sequence/service';
import type { SalePayload } from '../shared/types';
import { HttpError } from '../../shared/lib/errors';
import { withOptionalMongoSession } from '../../shared/lib/mongo-session';
import { getOrCreateRapidSaleClient } from '../client/rapid-sale-client';
import { getStockLines, type SaleLineItem } from './stock';
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
  resolveEmployee,
  syncCatalogProductsFromSale,
} from './internal';

const assertRapidSaleLineItems = (lineItems: SaleLineItem[]) => {
  if (lineItems.length < 1) {
    throw new HttpError(400, 'Rapid sale must contain at least one line item.');
  }

  for (const item of lineItems) {
    if (item.kind !== 'product') continue;
    if (!item.productId) {
      throw new HttpError(400, 'Rapid sale product lines must be linked to warehouse stock.');
    }
    if (item.catalogProductId) {
      throw new HttpError(400, 'Rapid sale does not support catalog-only product lines.');
    }
  }
};

export const createSale = async (payloadInput: SalePayload) => {
  const payload = normalizeSalePayload(payloadInput);
  const isRapidSale = payload.isRapidSale === true;
  const normalizedKind = payload.kind === 'sale' ? 'sale' : 'repair';

  if (isRapidSale) {
    if (normalizedKind !== 'sale') {
      throw new HttpError(400, 'Rapid sale must have kind sale.');
    }
    assertRapidSaleLineItems(payload.lineItems);
  } else {
    isValidObjectIdOrThrow(payload.clientId, 'clientId');
  }

  const hasProductId = Boolean(payload.productId);
  if (hasProductId) {
    isValidObjectIdOrThrow(payload.productId, 'productId');
  }
  assertSalePayload(payload.quantity, payload.salePrice);

  const [client, product, manager, master, issuedBy] = await Promise.all([
    isRapidSale
      ? getOrCreateRapidSaleClient()
      : Client.findById(payload.clientId).lean<ClientDocument | null>(),
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
    throw new HttpError(404, isRapidSale ? 'Rapid sale client could not be resolved.' : 'Client not found.');
  }
  if (!isRapidSale && client.status === 'blacklist') {
    throw new HttpError(400, 'Sales are blocked for blacklist clients.');
  }
  if (normalizedKind === 'sale' && hasProductId && !product && !catalogProduct) {
    throw new HttpError(404, 'Product not found.');
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
    lineItems.find((item) => item.kind === 'product')?.name?.trim() ??
    lineItems.find((item) => item.kind === 'service')?.name?.trim() ??
    '';
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

  await assertSerialNumbersNotBoundToOtherSales('', lineItems);
  await assertSerializedLineItemsAreAtomic(lineItems);
  await assertLineItemCatalogProductIds(lineItems);

  const result = await withOptionalMongoSession(async (session) => {
    let stockDeltasApplied = false;
    try {
      await applyStockDeltas(stockDeltas, session);
      stockDeltasApplied = true;
      const updatedProduct = product
        ? await Product.findById(product._id).lean<ProductDocument | null>()
        : null;
      const existingVisits = await Sale.countDocuments({ client: client._id });
      const visitCountAfterSale = existingVisits + 1;

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
        isRapidSale,
        note: payload.note,
        userNote: payload.userNote,
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
        clientSnapshot: buildClientSnapshot(client, visitCountAfterSale),
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
      await sale.save({ session });

      return {
        sale: formatSale(sale.toObject<SaleDocument>()),
        product: updatedProduct ? formatProduct(updatedProduct) : null,
        lineItems: sale.lineItems,
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
    normalizedKind === 'sale' ? 'sales-flow' : 'order-card',
    result.lineItems,
  );

  return {
    sale: result.sale,
    product: result.product,
  };
};
