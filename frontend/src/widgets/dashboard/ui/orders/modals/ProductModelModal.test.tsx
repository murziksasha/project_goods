import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../../../entities/product/model/types';
import { defaultPrintForms } from '../../../../../entities/settings/model/printForms';
import i18n from '../../../../../shared/i18n/config';
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

const serialPurchaseProducts = () => {
  const clickedProduct = createProduct({
    id: 'old-batch',
    serialNumber: 'R0000001',
    price: 200,
    purchaseDate: '2026-01-10',
    createdAt: '2026-01-10T10:00:00.000Z',
  });

  return {
    clickedProduct,
    products: [
      clickedProduct,
      createProduct({
        id: 'new-batch',
        serialNumber: 'R0000002',
        price: 250,
        purchaseDate: '2026-03-15',
        createdAt: '2026-03-15T09:00:00.000Z',
      }),
    ],
  };
};

const getPrintButton = () =>
  screen.getByRole('button', {
    name: /print|друк|select serial|оберіть серійні/i,
  });

afterEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('ProductModelModal serial printing', () => {
  it('pre-selects the clicked serial and prints it by default', () => {
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

    expect(
      screen.getByRole('checkbox', {
        name: i18n.t('catalog.productModel.selectSerialRow', {
          serial: 'R0035759',
        }),
      }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {
        name: i18n.t('catalog.productModel.selectSerialRow', {
          serial: 'R0035758',
        }),
      }),
    ).not.toBeChecked();
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(getPrintButton());

    expect(printSpy).toHaveBeenCalledWith(
      [
        {
          name: clickedProduct.name,
          article: clickedProduct.article,
          serialNumber: clickedProduct.serialNumber,
        },
      ],
      defaultPrintForms,
      i18n.t('catalog.productModel.printSerialTitle'),
    );

    printSpy.mockRestore();
  });

  it('prints all checked serials and updates badge count', () => {
    const printSpy = vi
      .spyOn(ordersWorkspaceShared, 'printWarehouseSerialLabels')
      .mockResolvedValue();

    const first = createProduct({
      id: 'product-a',
      serialNumber: 'SN-A',
      article: 'ART-A',
    });
    const second = createProduct({
      id: 'product-b',
      serialNumber: 'SN-B',
      article: 'ART-B',
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[first, second]}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    const printButton = getPrintButton();
    expect(printButton).toBeDisabled();
    expect(
      document.querySelector('.product-model-print-badge'),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: i18n.t('catalog.productModel.selectSerialRow', {
          serial: 'SN-A',
        }),
      }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: i18n.t('catalog.productModel.selectSerialRow', {
          serial: 'SN-B',
        }),
      }),
    );

    const badge = document.querySelector('.product-model-print-badge');
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent('2');
    expect(printButton).toBeEnabled();

    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalledWith(
      [
        {
          name: first.name,
          article: first.article,
          serialNumber: first.serialNumber,
        },
        {
          name: second.name,
          article: second.article,
          serialNumber: second.serialNumber,
        },
      ],
      defaultPrintForms,
      i18n.t('catalog.productModel.printSerialTitle'),
    );

    printSpy.mockRestore();
  });

  it('select-all checkbox toggles every printable serial', () => {
    const first = createProduct({
      id: 'product-a',
      serialNumber: 'SN-A',
    });
    const second = createProduct({
      id: 'product-b',
      serialNumber: 'SN-B',
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[first, second]}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    const selectAll = screen.getByRole('checkbox', {
      name: i18n.t('catalog.productModel.selectAllSerials'),
    });

    fireEvent.click(selectAll);

    expect(
      screen.getByRole('checkbox', {
        name: i18n.t('catalog.productModel.selectSerialRow', {
          serial: 'SN-A',
        }),
      }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', {
        name: i18n.t('catalog.productModel.selectSerialRow', {
          serial: 'SN-B',
        }),
      }),
    ).toBeChecked();
    expect(
      within(getPrintButton()).getByText('2'),
    ).toBeInTheDocument();

    fireEvent.click(selectAll);

    expect(
      screen.getByRole('checkbox', {
        name: i18n.t('catalog.productModel.selectSerialRow', {
          serial: 'SN-A',
        }),
      }),
    ).not.toBeChecked();
    expect(getPrintButton()).toBeDisabled();
  });

  it('shows per-serial purchase rows and highlights the clicked serial', () => {
    const { clickedProduct, products } = serialPurchaseProducts();

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={products}
        warehouses={[]}
        printForms={defaultPrintForms}
        printProduct={clickedProduct}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(
      screen.getByText(i18n.t('catalog.productModel.serialPurchasesTitle')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        i18n.t('catalog.productModel.latestBatchSummary', {
          price: '250,00 ₴',
          date: '15.03.2026',
        }),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('R0000001')).toBeInTheDocument();
    expect(screen.getByText('R0000002')).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('catalog.productModel.latestBatchBadge')),
    ).toHaveLength(1);
    expect(document.querySelector('.product-model-serial-row-selected')).not.toBeNull();
  });

  it('renders Ukrainian price-section labels when language is uk', async () => {
    await i18n.changeLanguage('uk');

    const { clickedProduct, products } = serialPurchaseProducts();

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={products}
        warehouses={[]}
        printForms={defaultPrintForms}
        printProduct={clickedProduct}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(
      screen.getByText(i18n.t('catalog.productModel.serialPurchasesTitle')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('catalog.productModel.serialNumber')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('catalog.productModel.purchaseDate')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        i18n.t('catalog.productModel.latestBatchSummary', {
          price: '250,00 ₴',
          date: '15.03.2026',
        }),
      ),
    ).toBeInTheDocument();
  });

  it('shows the serial print action without a clicked product when serials exist', () => {
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

    const printButton = getPrintButton();
    expect(printButton).toBeInTheDocument();
    expect(printButton).toBeDisabled();
  });

  it('hides the serial print action when there are no printable serials', () => {
    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[createProduct({ serialNumber: '   ' })]}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(
      screen.queryByRole('button', {
        name: /print|друк|select serial|оберіть серійні/i,
      }),
    ).not.toBeInTheDocument();
  });
});
