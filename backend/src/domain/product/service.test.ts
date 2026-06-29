import { describe, expect, it } from 'vitest';
import type { ProductDocument } from './model';
import {
  applyProductModelUpdate,
  normalizeProductModelName,
} from './service';

const product = {
  name: 'Mi Box S Gen 3',
  article: 'A1',
  price: 100,
  salePriceOptions: [150, 140, 130],
  note: 'old',
  quantity: 1,
  reservedQuantity: 0,
} as ProductDocument;

describe('product model updates', () => {
  it('uses exact normalized names without fuzzy matching similar products', () => {
    expect(normalizeProductModelName(' Mi Box S Gen 3 ')).toBe('mi box s gen 3');
    expect(normalizeProductModelName('Mi Box S Gen 3 Pro')).not.toBe(
      normalizeProductModelName('Mi Box S Gen 3'),
    );
  });

  it('maps shared fields to stock rows and preserves extra sale price options', () => {
    const updated = applyProductModelUpdate(product, {
      name: 'Mi Box S Gen 3',
      article: 'a2',
      note: 'new',
      retailPrice: '170',
      wholesalePrice: '160',
    });

    expect(updated.article).toBe('A2');
    expect(updated.note).toBe('new');
    expect(updated.price).toBe(100);
    expect(updated.salePriceOptions).toEqual([170, 160, 130]);
  });

  it('ignores purchase price updates from the product model modal payload', () => {
    const updated = applyProductModelUpdate(product, {
      name: 'Mi Box S Gen 3',
      purchasePrice: '999',
    });

    expect(updated.price).toBe(100);
  });
});
