import type { Supplier } from '../../../entities/supplier/model/types';
import type {
  SupplierOrder,
  SupplierOrderItem,
} from '../../../entities/supplier-order/model/types';

export const getSupplierSuggestions = (
  suppliers: Supplier[],
  searchValue: string,
) => {
  const normalized = searchValue.trim().toLowerCase();
  if (normalized.length < 2) return [];
  return suppliers
    .filter(
      (supplier) =>
        supplier.isActive &&
        [supplier.name, supplier.phone]
          .join(' ')
          .toLowerCase()
          .includes(normalized),
    )
    .slice(0, 8);
};

export const buildSupplierOrderItemNumber = (
  order: SupplierOrder,
  itemIndex: number,
) => {
  const baseNumber = order.number || order.orderBaseId || order.id;
  if (order.items.length <= 1) {
    return baseNumber;
  }
  return `${baseNumber}-${itemIndex + 1}`;
};

export const mergeSupplierOrderItemUpdate = ({
  sourceOrder,
  selectedItemIndex,
  updatedItem,
}: {
  sourceOrder: SupplierOrder;
  selectedItemIndex: number;
  updatedItem: SupplierOrderItem;
}) =>
  sourceOrder.items.map((item) =>
    item.itemIndex === selectedItemIndex
      ? {
          ...item,
          ...updatedItem,
          itemIndex: item.itemIndex,
        }
      : item,
  );

