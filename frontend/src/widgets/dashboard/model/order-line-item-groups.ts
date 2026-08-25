const normalizeProductLookupValue = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const toPriceCents = (price: number) => Math.round(price * 100);

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

export type PrintProductLineItemGroupInput = ProductLineItemGroupInput & {
  id?: string;
  kind?: 'product' | 'service';
  price: number;
  serialNumbers?: string[];
};

export type PrintProductLineItemGroup<
  T extends PrintProductLineItemGroupInput,
> = ProductLineItemGroup<T> & {
  price: number;
  serialNumbers: string[];
};

export const getProductLineItemGroupKey = (
  item: ProductLineItemGroupInput,
) => {
  const catalogId = item.catalogProductId?.trim();
  if (catalogId) return `catalog:${catalogId}`;
  return `name:${normalizeProductLookupValue(item.name)}`;
};

export const getPrintProductLineItemGroupKey = (
  item: PrintProductLineItemGroupInput,
  index: number,
) => {
  if (item.kind === 'service') {
    return `service:${item.id ?? index}`;
  }
  return `${getProductLineItemGroupKey(item)}|price:${toPriceCents(item.price)}`;
};

const collectSerialNumbers = (
  items: Array<{ serialNumbers?: string[] }>,
) => {
  const serials: string[] = [];
  const seen = new Set<string>();
  items.forEach((item) => {
    (item.serialNumbers ?? []).forEach((serial) => {
      const trimmed = serial.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      serials.push(trimmed);
    });
  });
  return serials;
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

export const groupPrintProductLineItems = <
  T extends PrintProductLineItemGroupInput,
>(
  items: T[],
): PrintProductLineItemGroup<T>[] => {
  const groups: PrintProductLineItemGroup<T>[] = [];
  const indexByKey = new Map<string, number>();

  items.forEach((item, index) => {
    const key = getPrintProductLineItemGroupKey(item, index);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        name: item.name,
        items: [item],
        totalQuantity: item.quantity,
        price: item.price,
        serialNumbers: collectSerialNumbers([item]),
      });
      return;
    }

    const group = groups[existingIndex];
    group.items.push(item);
    group.totalQuantity += item.quantity;
    group.serialNumbers = collectSerialNumbers(group.items);
  });

  return groups;
};
