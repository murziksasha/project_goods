import mongoose from 'mongoose';
import { toNonEmptyString, toNumber } from '../../shared/lib/parsers';
import {
  receiptStatuses,
  supplierOrderStatuses,
  supplierPaymentStatuses,
} from './model';

type SupplierOrderItemPayload = {
  lineId?: unknown;
  itemIndex?: unknown;
  catalogProductId?: unknown;
  productName?: unknown;
  quantity?: unknown;
  price?: unknown;
  receiptStatus?: unknown;
};

export type SupplierOrderPayload = {
  orderBaseId?: unknown;
  supplierId?: unknown;
  deliveryDate?: unknown;
  supplyType?: unknown;
  number?: unknown;
  note?: unknown;
  createdBy?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  items?: unknown;
};

export type SupplierOrderTakeOnChargePayload = {
  autoGenerateSerialNumbers?: unknown;
  serialNumbers?: unknown;
  autoGenerateArticles?: unknown;
  articleBase?: unknown;
  itemIndex?: unknown;
  warehouseId?: unknown;
  locationId?: unknown;
};

export type StockedProductSummary = {
  id: string;
  name: string;
  article: string;
  serialNumber: string;
};

export const toOrderStatus = (value: unknown) =>
  supplierOrderStatuses.includes(String(value ?? '') as (typeof supplierOrderStatuses)[number])
    ? (value as (typeof supplierOrderStatuses)[number])
    : 'request';

export const toPaymentStatus = (value: unknown) =>
  supplierPaymentStatuses.includes(String(value ?? '') as (typeof supplierPaymentStatuses)[number])
    ? (value as (typeof supplierPaymentStatuses)[number])
    : 'pending';

export type NormalizedSupplierOrderItem = {
  lineId: string;
  itemIndex: number;
  catalogProductId?: string;
  productName: string;
  quantity: number;
  price: number;
  receiptStatus: 'new' | 'approved' | 'received';
};

export const toReceiptStatus = (
  value: unknown,
): 'new' | 'approved' | 'received' =>
  receiptStatuses.includes(String(value ?? '') as (typeof receiptStatuses)[number])
    ? (value as 'new' | 'approved' | 'received')
    : 'new';

export const normalizeItems = (
  items: unknown,
  existingItems?: Array<{
    itemIndex: number;
    receiptStatus?: 'new' | 'approved' | 'received';
  }>,
): NormalizedSupplierOrderItem[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const raw = item as SupplierOrderItemPayload;
      const productName = toNonEmptyString(raw.productName);
      const quantity = toNumber(raw.quantity);
      const price = toNumber(raw.price);
      const catalogProductIdRaw = toNonEmptyString(raw.catalogProductId);
      const catalogProductId = mongoose.isValidObjectId(catalogProductIdRaw)
        ? catalogProductIdRaw
        : undefined;
      const lineId = toNonEmptyString(raw.lineId) || `line-${index + 1}`;
      const itemIndex = Number.isFinite(toNumber(raw.itemIndex)) ? Math.max(0, Math.floor(toNumber(raw.itemIndex))) : index;
      const existingItem = existingItems?.find(
        (currentItem) => currentItem.itemIndex === itemIndex,
      );
      const receiptStatus =
        raw && typeof raw === 'object' && 'receiptStatus' in raw
          ? toReceiptStatus(
              (
                raw as SupplierOrderItemPayload & {
                  receiptStatus?: unknown;
                }
              ).receiptStatus,
            )
          : existingItem?.receiptStatus ?? 'new';

      return {
        lineId,
        itemIndex,
        catalogProductId,
        productName,
        quantity,
        price,
        receiptStatus,
      };
    })
    .filter((item) => item.productName.length >= 2 && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.price) && item.price >= 0)
    .sort((a, b) => a.itemIndex - b.itemIndex);
};
