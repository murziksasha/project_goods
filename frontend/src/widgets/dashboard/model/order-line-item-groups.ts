import { normalizeProductLookupValue } from '../ui/orders/workspace/orders-workspace-shared';

export type ProductLineItemGroupInput = {
  catalogProductId?: string;
  name: string;
  quantity: number;
};

export type ProductLineItemGroup<T extends ProductLineItemGroupInput> = {
  key: string;
  name: string;
  items: T[];
  totalQuantity: number;
};

export const getProductLineItemGroupKey = (
  item: ProductLineItemGroupInput,
) => {
  const catalogId = item.catalogProductId?.trim();
  if (catalogId) return `catalog:${catalogId}`;
  return `name:${normalizeProductLookupValue(item.name)}`;
};

export const groupProductLineItems = <T extends ProductLineItemGroupInput>(
  items: T[],
): ProductLineItemGroup<T>[] => {
  const groups: ProductLineItemGroup<T>[] = [];
  const indexByKey = new Map<string, number>();

  items.forEach((item) => {
    const key = getProductLineItemGroupKey(item);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        name: item.name,
        items: [item],
        totalQuantity: item.quantity,
      });
      return;
    }

    const group = groups[existingIndex];
    group.items.push(item);
    group.totalQuantity += item.quantity;
  });

  return groups;
};
