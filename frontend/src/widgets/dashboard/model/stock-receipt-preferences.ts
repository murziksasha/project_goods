export const STOCK_RECEIPT_STORAGE_KEY = 'project-goods.stock-receipt';

export interface StockReceiptPreferences {
  autoGenerateSerialNumbers?: boolean;
  autoGenerateArticles?: boolean;
  printSerialNumbers?: boolean;
  warehouseId?: string;
  locationId?: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isString = (value: unknown): value is string =>
  typeof value === 'string';

const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

export const readStockReceiptPreferences = (): StockReceiptPreferences => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const preferences: StockReceiptPreferences = {};

    if (isBoolean(parsed.autoGenerateSerialNumbers)) {
      preferences.autoGenerateSerialNumbers = parsed.autoGenerateSerialNumbers;
    }
    if (isBoolean(parsed.autoGenerateArticles)) {
      preferences.autoGenerateArticles = parsed.autoGenerateArticles;
    }
    if (isBoolean(parsed.printSerialNumbers)) {
      preferences.printSerialNumbers = parsed.printSerialNumbers;
    }
    if (isNonEmptyString(parsed.warehouseId)) {
      preferences.warehouseId = parsed.warehouseId.trim();
    }
    if (isString(parsed.locationId)) {
      preferences.locationId = parsed.locationId;
    }

    return preferences;
  } catch {
    return {};
  }
};

export const writeStockReceiptPreferences = (
  updates: StockReceiptPreferences,
): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const current = readStockReceiptPreferences();
    const merged: StockReceiptPreferences = { ...current };

    if (isBoolean(updates.autoGenerateSerialNumbers)) {
      merged.autoGenerateSerialNumbers = updates.autoGenerateSerialNumbers;
    }
    if (isBoolean(updates.autoGenerateArticles)) {
      merged.autoGenerateArticles = updates.autoGenerateArticles;
    }
    if (isBoolean(updates.printSerialNumbers)) {
      merged.printSerialNumbers = updates.printSerialNumbers;
    }
    if (isNonEmptyString(updates.warehouseId)) {
      merged.warehouseId = updates.warehouseId.trim();
    }
    if (isString(updates.locationId)) {
      merged.locationId = updates.locationId;
    }

    window.localStorage.setItem(
      STOCK_RECEIPT_STORAGE_KEY,
      JSON.stringify(merged),
    );
  } catch {
    // Read/write failures are ignored.
  }
};

