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

const saleKitSeparatorPattern = /[,;\n|]/;

/** Split free text such as "charger, bag" into kit items. */
export const splitSaleKitText = (value: string) =>
  normalizeSaleKit(value.split(saleKitSeparatorPattern));

/**
 * Normalize and split items that still contain separators (legacy single
 * string such as "charger, bag" stored as one item).
 */
export const expandSaleKitItems = (items: readonly unknown[] | undefined | null) =>
  normalizeSaleKit(
    Array.isArray(items)
      ? items.flatMap((item) => (typeof item === 'string' ? item.split(saleKitSeparatorPattern) : []))
      : [],
  );

/**
 * Add the items typed in `text` (comma separated allowed) to `kit`.
 * Empty and case-insensitive duplicate items are ignored; the limit is kept.
 */
export const addSaleKitItems = (kit: readonly string[], text: string) => {
  const current = expandSaleKitItems([...kit]);
  const existing = new Set(current.map((item) => item.toLocaleLowerCase()));
  const added: string[] = [];
  for (const item of splitSaleKitText(text)) {
    if (current.length + added.length >= saleKitMaxItems) break;
    const key = item.toLocaleLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    added.push(item.slice(0, saleKitMaxItemLength));
  }
  return { kit: [...current, ...added], added };
};

/** Remove the item at `index`; returns the removed item (or `undefined`). */
export const removeSaleKitItem = (kit: readonly string[], index: number) => {
  const removed = kit[index];
  return {
    kit: removed === undefined ? [...kit] : kit.filter((_, itemIndex) => itemIndex !== index),
    removed,
  };
};

/** Legacy orders stored the kit as `(kits: charger, bag)` inside the system note. */
export const parseLegacySaleKitFromNote = (note: string | undefined | null) => {
  const match = legacyKitNotePattern.exec(note ?? '');
  return match ? splitSaleKitText(match[1] ?? '') : [];
};

/** Kit of an order: the `kit` field, or the legacy note fallback for old orders. */
export const getSaleKit = (sale: Pick<Sale, 'kit' | 'note'>) => {
  const kit = expandSaleKitItems(sale.kit);
  return kit.length > 0 ? kit : parseLegacySaleKitFromNote(sale.note);
};

/** Comma-joined kit (`{{kit}}`, acts, card copy). */
export const formatSaleKit = (kit: readonly string[]) => kit.join(', ');

/** Slash-joined kit for compact labels (`{{kitLabel}}`). */
export const formatSaleKitLabel = (kit: readonly string[]) => kit.join(' / ');

export const areSaleKitsEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((item, index) => item === right[index]);
