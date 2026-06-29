import { describe, expect, it } from 'vitest';
import {
  assertCatalogProductNameFitsWarehouse,
  catalogProductNamesAreEqual,
  matchesCatalogLineItemProductName,
  matchesCatalogSnapshotProductName,
  renameSaleForCatalogProduct,
  renameSupplierOrderItems,
  shouldPropagateCatalogProductRename,
  shouldRenameSupplierOrderItem,
} from './name-propagation';

const catalogProductId = '507f1f77bcf86cd799439011';

describe('catalog product name propagation helpers', () => {
  it('uses exact normalized names without fuzzy matching similar products', () => {
    expect(catalogProductNamesAreEqual(' Mi Box S Gen 3 ', 'mi box s gen 3')).toBe(true);
    expect(catalogProductNamesAreEqual('Mi Box S Gen 3 Pro', 'Mi Box S Gen 3')).toBe(false);
  });

  it('detects when rename propagation is needed', () => {
    expect(shouldPropagateCatalogProductRename('Old name', 'New name')).toBe(true);
    expect(shouldPropagateCatalogProductRename(' Same Name ', 'same name')).toBe(false);
    expect(shouldPropagateCatalogProductRename('', 'New name')).toBe(false);
  });

  it('rejects warehouse names longer than 120 characters', () => {
    expect(() => assertCatalogProductNameFitsWarehouse('A'.repeat(121))).toThrow(
      'Product name must contain no more than 120 characters for warehouse stock.',
    );
  });

  it('renames supplier order items by catalogProductId or exact previous name', () => {
    const nextItems = renameSupplierOrderItems(
      [
        {
          catalogProductId,
          productName: 'Old catalog name',
        },
        {
          catalogProductId: null,
          productName: 'Old catalog name',
        },
        {
          catalogProductId: null,
          productName: 'Old catalog name Pro',
        },
      ],
      catalogProductId,
      'Old catalog name',
      'New catalog name',
    );

    expect(nextItems[0]?.productName).toBe('New catalog name');
    expect(nextItems[1]?.productName).toBe('New catalog name');
    expect(nextItems[2]?.productName).toBe('Old catalog name Pro');
  });

  it('matches snapshot and line item names with optional serial suffix', () => {
    expect(matchesCatalogSnapshotProductName('Old catalog name', 'Old catalog name')).toBe(true);
    expect(
      matchesCatalogLineItemProductName('Old catalog name (S000001)', 'Old catalog name'),
    ).toBe(true);
    expect(matchesCatalogLineItemProductName('Old catalog name Pro', 'Old catalog name')).toBe(
      false,
    );
  });

  it('renames linked sale snapshot and product line items only', () => {
    const result = renameSaleForCatalogProduct(
      {
        productSnapshot: {
          article: 'A1',
          name: 'Old catalog name',
          serialNumber: 'S1',
        },
        lineItems: [
          {
            kind: 'product',
            catalogProductId,
            name: 'Old catalog name',
          },
          {
            kind: 'service',
            name: 'Service',
          },
        ],
      },
      catalogProductId,
      'Old catalog name',
      'New catalog name',
    );

    expect(result.snapshotChanged).toBe(true);
    expect(result.lineItemsChanged).toBe(true);
    expect(result.nextSnapshotName).toBe('New catalog name');
    expect(result.nextLineItems[0]?.name).toBe('New catalog name');
    expect(result.nextLineItems[1]?.name).toBe('Service');
  });

  it('does not rename supplier order items with unrelated names', () => {
    expect(
      shouldRenameSupplierOrderItem(
        {
          catalogProductId: null,
          productName: 'Other product',
        },
        catalogProductId,
        'Old catalog name',
      ),
    ).toBe(false);
  });
});