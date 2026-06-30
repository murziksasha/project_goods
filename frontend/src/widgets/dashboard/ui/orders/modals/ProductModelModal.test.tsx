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

  it('shows per-serial purchase rows and highlights the clicked serial', () => {
    const clickedProduct = createProduct({
      id: 'old-batch',
      serialNumber: 'R0000001',
      price: 200,
      purchaseDate: '2026-01-10',
      createdAt: '2026-01-10T10:00:00.000Z',
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[
          clickedProduct,
          createProduct({
            id: 'new-batch',
            serialNumber: 'R0000002',
            price: 250,
            purchaseDate: '2026-03-15',
            createdAt: '2026-03-15T09:00:00.000Z',
          }),
        ]}
        warehouses={[]}
        printForms={defaultPrintForms}
        printProduct={clickedProduct}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(screen.getByText('Purchase by serial')).toBeInTheDocument();
    expect(screen.getByText('Latest batch: 250,00 ₴ · 15.03.2026')).toBeInTheDocument();
    expect(screen.getByText('R0000001')).toBeInTheDocument();
    expect(screen.getByText('R0000002')).toBeInTheDocument();
    expect(screen.getAllByText('Latest')).toHaveLength(1);
    expect(document.querySelector('.product-model-serial-row-selected')).not.toBeNull();
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
