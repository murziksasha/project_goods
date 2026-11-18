import type { Sale } from '../model/types';

/** Limits mirror backend validation (`backend/src/shared/lib/parse/sale.ts`). */
export const saleKitMaxItems = 20;
export const saleKitMaxItemLength = 80;

const legacyKitNotePattern = /\(kits:\s*([^)]*)\)/i;

/** Trim, drop empty items and case-insensitive duplicates, keep order. */
export const normalizeSaleKit = (items: readonly unknown[] | undefined | null) => {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const item = raw.trim().replace(/\s+/g, ' ');
    if (!item) continue;
    const key = item.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
};

/** Split free text such as "charger, bag" into kit items. */
export const splitSaleKitText = (value: string) =>
  normalizeSaleKit(value.split(/[,;\n|]/));

/** Legacy orders stored the kit as `(kits: charger, bag)` inside the system note. */
export const parseLegacySaleKitFromNote = (note: string | undefined | null) => {
  const match = legacyKitNotePattern.exec(note ?? '');
  return match ? splitSaleKitText(match[1] ?? '') : [];
};

/** Kit of an order: the `kit` field, or the legacy note fallback for old orders. */
export const getSaleKit = (sale: Pick<Sale, 'kit' | 'note'>) => {
  const kit = normalizeSaleKit(sale.kit);
  return kit.length > 0 ? kit : parseLegacySaleKitFromNote(sale.note);
};

export const formatSaleKit = (kit: readonly string[]) => kit.join(', ');

export const areSaleKitsEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((item, index) => item === right[index]);
