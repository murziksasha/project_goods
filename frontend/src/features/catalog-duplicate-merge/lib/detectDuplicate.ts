export const normalizeCatalogName = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const normalizeClientId = (value: unknown): string =>
  String(value ?? '').trim();

export type FindCatalogDuplicateOptions<T> = {
  currentId: string;
  name: string;
  items: T[];
  getName?: (item: T) => string;
  getId?: (item: T) => string;
  scopeByClient?: boolean;
  clientId?: string | null;
  getClientId?: (item: T) => string | null | undefined;
};

export const findCatalogDuplicate = <
  T extends { id?: string; _id?: string; name?: string },
>(
  options: FindCatalogDuplicateOptions<T>,
): T | null => {
  const normalizedInputName = normalizeCatalogName(options.name);
  if (!normalizedInputName) {
    return null;
  }

  const currentId = String(options.currentId ?? '').trim();
  const checkClientId = Boolean(
    options.scopeByClient ||
    options.clientId !== undefined ||
    options.getClientId !== undefined,
  );
  const normalizedInputClientId = normalizeClientId(options.clientId);

  for (const item of options.items) {
    const itemId = options.getId
      ? options.getId(item)
      : String(item.id ?? item._id ?? '');
    if (itemId === currentId) {
      continue;
    }

    const itemName = options.getName
      ? options.getName(item)
      : String(item.name ?? '');
    if (normalizeCatalogName(itemName) !== normalizedInputName) {
      continue;
    }

    if (checkClientId) {
      const itemClientId = options.getClientId
        ? options.getClientId(item)
        : (item as unknown as { clientId?: string | null }).clientId;
      if (
        normalizeClientId(itemClientId) !== normalizedInputClientId
      ) {
        continue;
      }
    }

    return item;
  }

  return null;
};
