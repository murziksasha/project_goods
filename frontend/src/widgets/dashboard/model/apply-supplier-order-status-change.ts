import type {
  SupplierOrder,
  SupplierOrderStatus,
} from '../../../entities/supplier-order/model/types';
import {
  getActiveSupplierOrderItems,
  isMultiItemSupplierOrder,
} from './supplier-orders-workspace';
import { resolveSupplierOrderErrorMessage } from './supplier-order-utils';

export const financeVisibilitySupplierOrderStatuses: SupplierOrderStatus[] = [
  'approved',
  'partially_stocked',
  'partially_completed',
  'stocked',
  'cancelled',
];

export type SupplierOrderStatusChangeWarehouse = {
  warehouseId: string;
  locationId: string;
};

export type ApplySupplierOrderStatusChangeParams = {
  order: SupplierOrder;
  nextStatus: SupplierOrderStatus;
  /** null = bulk parent; number = item-scoped; undefined = whole order / single */
  itemIndex?: number | null;
  defaultWarehouse: SupplierOrderStatusChangeWarehouse | null;
  takeOnCharge: (payload: {
    supplierOrderId: string;
    autoGenerateSerialNumbers: boolean;
    serialNumbers: string[];
    autoGenerateArticles: boolean;
    articleBase: string;
    warehouseId: string;
    locationId: string;
    itemIndex?: number;
  }) => Promise<SupplierOrder>;
  updateOrder: (payload: {
    supplierOrderId: string;
    order: SupplierOrder;
    nextStatus: SupplierOrderStatus;
  }) => Promise<void>;
  translate: (key: string) => string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  notifyFinanceUpdated?: () => void;
};

export const isSupplierOrderStatusControlDisabled = (
  order: Pick<SupplierOrder, 'status' | 'paymentStatus'>,
  canManage: boolean,
) =>
  !canManage ||
  order.paymentStatus === 'cancelled' ||
  order.status === 'cancelled' ||
  order.status === 'unavailable';

export const isSupplierOrderModalForceReadOnly = (
  canManage: boolean,
) => !canManage;

/**
 * Shared status change path used by Supplier Order list and order-card related tab.
 * Returns true when a change was applied (or same-status no-op without error).
 */
export const applySupplierOrderStatusChange = async ({
  order,
  nextStatus,
  itemIndex,
  defaultWarehouse,
  takeOnCharge,
  updateOrder,
  translate,
  onSuccess,
  onError,
  notifyFinanceUpdated,
}: ApplySupplierOrderStatusChangeParams): Promise<boolean> => {
  try {
    if (nextStatus === order.status) {
      return true;
    }

    if (nextStatus === 'stocked') {
      if (!defaultWarehouse) {
        onError(
          translate('orders.supplier.messages.errors.defaultWarehouseNotFound'),
        );
        return false;
      }

      const takeOnChargeBase = {
        autoGenerateSerialNumbers: true,
        serialNumbers: [] as string[],
        autoGenerateArticles: false,
        articleBase: '',
        warehouseId: defaultWarehouse.warehouseId,
        locationId: defaultWarehouse.locationId,
      };

      const isBulkParent =
        itemIndex === null && isMultiItemSupplierOrder(order);

      const runTakeOnCharge = (scopedItemIndex?: number) =>
        takeOnCharge({
          supplierOrderId: order.id,
          ...takeOnChargeBase,
          ...(scopedItemIndex === undefined ? {} : { itemIndex: scopedItemIndex }),
        });

      let takeOnChargeResult: SupplierOrder;
      if (isBulkParent) {
        const activeItems = getActiveSupplierOrderItems(order);
        if (activeItems.length === 0) {
          onError(
            translate('orders.supplier.messages.errors.failedUpdateStatus'),
          );
          return false;
        }

        const hasReceivedItems = order.items.some(
          (item) => item.receiptStatus === 'received',
        );

        if (!hasReceivedItems && activeItems.length > 1) {
          takeOnChargeResult = await runTakeOnCharge();
        } else {
          let lastResult: SupplierOrder | undefined;
          for (const item of activeItems) {
            lastResult = await runTakeOnCharge(item.itemIndex);
          }
          if (!lastResult) {
            onError(
              translate('orders.supplier.messages.errors.failedUpdateStatus'),
            );
            return false;
          }
          takeOnChargeResult = lastResult;
        }
      } else {
        takeOnChargeResult = await runTakeOnCharge(
          itemIndex === null || itemIndex === undefined
            ? undefined
            : itemIndex,
        );
      }

      notifyFinanceUpdated?.();
      onSuccess(
        takeOnChargeResult.status === 'partially_stocked'
          ? translate('orders.supplier.messages.success.partiallyStocked')
          : translate('orders.supplier.messages.success.stocked'),
      );
      return true;
    }

    await updateOrder({
      supplierOrderId: order.id,
      order,
      nextStatus,
    });
    if (financeVisibilitySupplierOrderStatuses.includes(nextStatus)) {
      notifyFinanceUpdated?.();
    }
    onSuccess(translate('orders.supplier.messages.success.statusUpdated'));
    return true;
  } catch (error) {
    onError(
      resolveSupplierOrderErrorMessage(
        error,
        translate,
        'orders.supplier.messages.errors.failedUpdateStatus',
      ),
    );
    return false;
  }
};
