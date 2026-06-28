import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../../../entities/product/model/types';
import { defaultPrintForms } from '../../../../../entities/settings/model/printForms';
import * as ordersWorkspaceShared from '../workspace/orders-workspace-shared';
import { ProductModelModal } from './ProductModelModal';
const createProduct = (patch: Partial<Product>): Product => ({
  id: 'product-1',
  name: 'БЖ Meanwell 9V 1.66A',
  article: 'ART-1',
  serialNumber: 'R0035759',
  price: 200,
  salePriceOptions: [],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  purchaseDate: '2026-06-12',
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-06-12T00:00:00.000Z',
  updatedAt: '2026-06-12T00:00:00.000Z',
  ...patch,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProductModelModal serial printing', () => {
  it('prints only the clicked serial product', () => {
    const printSpy = vi
      .spyOn(ordersWorkspaceShared, 'printWarehouseSerialLabels')
      .mockResolvedValue();

    const clickedProduct = createProduct({
      id: 'clicked-product',
      serialNumber: 'R0035759',
    });
    const otherProduct = createProduct({
      id: 'other-product',
      article: 'ART-2',
      serialNumber: 'R0035758',
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[clickedProduct, otherProduct]}
        warehouses={[]}
        printForms={defaultPrintForms}
        printProduct={clickedProduct}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Print serial number' }));

    expect(printSpy).toHaveBeenCalledWith(
      [
        {
          name: clickedProduct.name,
          article: clickedProduct.article,
          serialNumber: clickedProduct.serialNumber,
        },
      ],
      defaultPrintForms,
      'Warehouse serial number',
    );

    printSpy.mockRestore();
  });

  it('hides the serial print action without a clicked product', () => {
    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[createProduct({})]}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Print serial number' }),
    ).not.toBeInTheDocument();
  });
});
