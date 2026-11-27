import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../../../entities/product';
import type { Sale } from '../../../../../entities/sale';
import type { SupplierOrder } from '../../../../../entities/supplier-order';
import { getStockOrderLinks } from '../../../../../entities/sale';
import type { StockOrderLink } from '../../../../../entities/sale';
import { getOrderLink } from '../../../../../shared/config/routing';
import { defaultPrintForms } from '../../../../../entities/settings';
import i18n from '../../../../../shared/i18n/config';
import * as clipboard from '../../../../../shared/lib/clipboard';
import { formatCurrency, formatDate } from '../../../../../shared/lib/format';
import * as ordersWorkspaceShared from '../workspace/orders-workspace-shared';
import { ProductModelModal } from './ProductModelModal';

vi.mock('../../../../../entities/sale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../entities/sale')>();
  return {
    ...actual,
  getStockOrderLinks: vi.fn(async () => ({ links: [] as StockOrderLink[] })),
  };
});

const getStockOrderLinksMock = vi.mocked(getStockOrderLinks);

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

const createSupplierOrder = (
  patch: Partial<SupplierOrder> = {},
): SupplierOrder => ({
  id: 'so-1',
  orderBaseId: 'SO-1',
  supplierId: 'supplier-1',
  supplierName: 'Linked supplier',
  deliveryDate: '2026-01-01T00:00:00.000Z',
  supplyType: 'Local',
  number: 'SO-1',
  note: '',
  createdBy: 'Owner',
  status: 'stocked',
  paymentStatus: 'pending',
  receiptStatus: 'received',
  total: 200,
  paid: 0,
  isFavorite: false,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      productName: 'БЖ Meanwell 9V 1.66A',
      quantity: 1,
      price: 200,
      receiptStatus: 'received',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const getPrintButton = () =>
  screen.getByRole('button', {
    name: /print|друк|select serial|оберіть серійні/i,
  });

const saleBindingProduct = (
  saleId: string,
  product: Product,
  status = 'new',
): Sale =>
  ({
    id: saleId,
    status,
    product: { id: '', article: '', name: '', serialNumber: '' },
    lineItems: [
      {
        id: `${saleId}-line`,
        kind: 'product',
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        warrantyPeriod: 0,
        serialNumbers: [product.serialNumber],
      },
    ],
  }) as Sale;

afterEach(async () => {
  vi.clearAllMocks();
  getStockOrderLinksMock.mockResolvedValue({ links: [] });
  await i18n.changeLanguage('en');
});

describe('ProductModelModal selected historical serial', () => {
  it('shows sold-unit purchase provenance without adding it to active stock or latest batch', () => {
    const sold = createProduct({
      id: 'sold-unit',
      serialNumber: 'S-SOLD',
      quantity: 0,
      freeQuantity: 0,
      isInStock: false,
      price: 175,
      purchaseDate: '2026-11-12',
      supplierOrderId: 'so-1',
      supplierOrderItemIndex: 0,
    });
    const active = createProduct({
      id: 'active-unit',
      serialNumber: 'S-ACTIVE',
      price: 220,
      purchaseDate: '2026-10-01',
    });

    render(
      <ProductModelModal
        name={sold.name}
        products={[sold, active]}
        sales={[saleBindingProduct('issued-sale', sold, 'issued')]}
        supplierOrders={[createSupplierOrder()]}
        warehouses={[]}
        printForms={defaultPrintForms}
        selectedSerial={{ serialNumber: sold.serialNumber, product: sold }}
        readOnly
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    const selected = screen.getByRole('region', {
      name: i18n.t('catalog.productModel.selectedSerialTitle'),
    });
    expect(within(selected).getByText(sold.serialNumber)).toBeVisible();
    expect(within(selected).getByText(formatCurrency(sold.price), { normalizer: (text) => text })).toBeVisible();
    expect(within(selected).getByText(formatDate(sold.purchaseDate))).toBeVisible();
    expect(within(selected).getByText('SO-1')).toBeVisible();
    const purchases = document.querySelector('.product-model-serial-purchases-table') as HTMLElement;
    expect(purchases).not.toBeNull();
    expect(within(purchases).queryByText(sold.serialNumber)).toBeNull();
    expect(within(purchases).getByText(active.serialNumber)).toBeVisible();
    expect(within(purchases).getByText(i18n.t('catalog.productModel.latestBatchBadge'))).toBeVisible();
    expect(screen.getByText(i18n.t('catalog.productModel.latestBatchSummary', {
      price: formatCurrency(active.price),
      date: formatDate(active.purchaseDate),
    }), { normalizer: (text) => text })).toBeVisible();
    expect(screen.queryByRole('button', { name: i18n.t('catalog.productModel.saveModel') })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('catalog.productModel.sections.stock') }));
    const summary = document.querySelector('.product-model-summary') as HTMLElement;
    expect(within(summary).getByText(i18n.t('catalog.productModel.total')).parentElement).toHaveTextContent('1');
    expect(within(summary).getByText(i18n.t('catalog.productModel.free')).parentElement).toHaveTextContent('1');
    expect(within(summary).getByText(i18n.t('catalog.productModel.reserved')).parentElement).toHaveTextContent('0');
  });

  it('keeps purchase details available when all units are sold and falls back to receipt creation date', () => {
    const sold = createProduct({
      id: 'last-sold-unit',
      serialNumber: 'S-LAST',
      quantity: 0,
      freeQuantity: 0,
      isInStock: false,
      purchaseDate: null,
      createdAt: '2026-01-18T11:30:00.000Z',
    });
    render(
      <ProductModelModal
        name={sold.name}
        products={[sold]}
        sales={[saleBindingProduct('issued-sale', sold, 'issued')]}
        warehouses={[]}
        printForms={defaultPrintForms}
        selectedSerial={{ serialNumber: sold.serialNumber, product: sold }}
        readOnly
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    const selected = screen.getByRole('region', {
      name: i18n.t('catalog.productModel.selectedSerialTitle'),
    });
    expect(within(selected).getByText(sold.serialNumber)).toBeVisible();
    expect(within(selected).getByText(formatCurrency(sold.price), { normalizer: (text) => text })).toBeVisible();
    expect(within(selected).getByText(formatDate(sold.createdAt))).toBeVisible();
    expect(screen.getByText(i18n.t('catalog.productModel.noStockRows'))).toBeVisible();
    expect(document.querySelector('.product-model-serial-purchases-table')).toBeNull();
    expect(screen.queryByText(i18n.t('catalog.productModel.latestBatchBadge'))).toBeNull();
  });

  it('preserves an unknown serial and explicitly reports unavailable purchase information', () => {
    render(
      <ProductModelModal
        name='Historical product'
        products={[]}
        warehouses={[]}
        printForms={defaultPrintForms}
        selectedSerial={{ serialNumber: 'S-MISSING', product: null }}
        readOnly
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    const selected = screen.getByRole('region', {
      name: i18n.t('catalog.productModel.selectedSerialTitle'),
    });
    expect(within(selected).getByText('S-MISSING')).toBeVisible();
    expect(within(selected).getByText('Purchase information is unavailable for this serial number.')).toBeVisible();
    expect(screen.queryByRole('button', { name: i18n.t('catalog.productModel.saveModel') })).toBeNull();
  });
});

describe('ProductModelModal serial printing', () => {
  it('hides save and locks prices when read-only', () => {
    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[createProduct({ salePriceOptions: [250, 180] })]}
        warehouses={[]}
        printForms={defaultPrintForms}
        readOnly
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Save model' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('250')).toBeDisabled();
    expect(screen.getByDisplayValue('180')).toBeDisabled();
  });

  it('pre-selects the clicked serial and prints it by default', () => {
    const printSpy = vi
      .spyOn(ordersWorkspaceShared, 'printWarehouseSerialLabels')
      .mockResolvedValue('printed');

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
      .mockResolvedValue('printed');

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
      screen.getByText(i18n.t('catalog.productModel.supplierOrder')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('catalog.productModel.clientOrder')),
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

  it('marks serials bound on other orders as reserved', () => {
    const { clickedProduct, products } = serialPurchaseProducts();
    const reservedProduct = products[0];

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={products}
        sales={[saleBindingProduct('sale-other', reservedProduct)]}
        currentSaleId='sale-current'
        warehouses={[]}
        printForms={defaultPrintForms}
        printProduct={clickedProduct}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(
      screen.getByText(i18n.t('catalog.productModel.reservedBadge')),
    ).toBeInTheDocument();
    expect(
      document.querySelector('.product-model-serial-row-reserved'),
    ).not.toBeNull();
    expect(
      document.querySelector('.product-model-serial-row-reserved'),
    ).toHaveTextContent('R0000001');
  });

  it('does not mark serials bound only on the opened order as reserved', () => {
    const { clickedProduct, products } = serialPurchaseProducts();

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={products}
        sales={[saleBindingProduct('sale-current', clickedProduct)]}
        currentSaleId='sale-current'
        warehouses={[]}
        printForms={defaultPrintForms}
        printProduct={clickedProduct}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(
      screen.queryByText(i18n.t('catalog.productModel.reservedBadge')),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('.product-model-serial-row-reserved'),
    ).toBeNull();
  });

  it('marks a non-issued binding from stock-links as reserved', async () => {
    const { clickedProduct, products } = serialPurchaseProducts();
    getStockOrderLinksMock.mockResolvedValue({
      links: [
        {
          productId: 'old-batch',
          serialNumber: 'R0000001',
          saleId: 'sale-outside-list',
          recordNumber: 'r000088',
          kind: 'sale',
          status: 'reserved',
        },
      ],
    });

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

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('catalog.productModel.reservedBadge')),
      ).toBeInTheDocument();
    });
    expect(
      document.querySelector('.product-model-serial-row-reserved'),
    ).toHaveTextContent('R0000001');
    expect(screen.getByRole('link', { name: 'r000088' })).toBeInTheDocument();
    expect(getStockOrderLinksMock).toHaveBeenCalledWith({
      productIds: expect.arrayContaining(['old-batch', 'new-batch']),
      serials: expect.arrayContaining(['R0000001', 'R0000002']),
    });
  });

  it('shows latest and reserved badges on the same serial', () => {
    const { products } = serialPurchaseProducts();
    const latestProduct = products[1];

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={products}
        sales={[saleBindingProduct('sale-other', latestProduct)]}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    const reservedRow = document.querySelector(
      '.product-model-serial-row-reserved',
    );
    expect(reservedRow).not.toBeNull();
    expect(reservedRow).toHaveTextContent('R0000002');
    expect(reservedRow).toHaveTextContent(
      i18n.t('catalog.productModel.latestBatchBadge'),
    );
    expect(reservedRow).toHaveTextContent(
      i18n.t('catalog.productModel.reservedBadge'),
    );
  });

  it('shows receipt date and a clickable copyable supplier order number', () => {
    const onOpenSupplierOrder = vi.fn();
    const { clickedProduct, products } = serialPurchaseProducts();
    const linkedProducts = products.map((product, index) =>
      index === 0
        ? {
            ...product,
            supplierOrderId: 'so-1',
            supplierOrderItemIndex: 0,
          }
        : product,
    );

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={linkedProducts}
        supplierOrders={[createSupplierOrder()]}
        warehouses={[]}
        printForms={defaultPrintForms}
        printProduct={clickedProduct}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
        onOpenSupplierOrder={onOpenSupplierOrder}
      />,
    );

    expect(screen.getByText('10.01.2026')).toBeInTheDocument();
    expect(screen.getByText('15.03.2026')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'SO-1' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: i18n.t('common.copy') }),
    ).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'SO-1' }));
    expect(onOpenSupplierOrder).toHaveBeenCalledWith('so-1', 0);
  });

  it('renders an empty supplier order cell without copy or click', () => {
    const onOpenSupplierOrder = vi.fn();
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
        onOpenSupplierOrder={onOpenSupplierOrder}
      />,
    );

    expect(screen.getAllByText('\u2014').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'SO-1' })).toBeNull();
    expect(
      screen.getAllByRole('button', { name: i18n.t('common.copy') }),
    ).toHaveLength(2);
    expect(onOpenSupplierOrder).not.toHaveBeenCalled();
  });

  it('copies serial from the hover icon', async () => {
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
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

    const copyButtons = screen.getAllByRole('button', {
      name: i18n.t('common.copy'),
    });
    expect(copyButtons).toHaveLength(2);

    fireEvent.click(copyButtons[0]);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('R0000002');
    });

    fireEvent.click(copyButtons[1]);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('R0000001');
    });

    copySpy.mockRestore();
  });

  it('keeps the purchase-by-serial header sticky inside the table scroller', () => {
    const products = Array.from({ length: 8 }, (_, index) =>
      createProduct({
        id: `serial-${index}`,
        serialNumber: `S00010${index}`,
        purchaseDate: `2026-01-${String(index + 1).padStart(2, '0')}`,
        createdAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      }),
    );

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={products}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    const wrap = document.querySelector(
      '.product-model-serial-purchases-table-wrap',
    );
    const head = wrap?.querySelector('thead');
    expect(head).not.toBeNull();
    expect(head?.querySelectorAll('.product-model-serial-purchases-sticky-head')).toHaveLength(6);
    expect(wrap?.contains(head ?? null)).toBe(true);
    if (wrap instanceof HTMLElement) {
      wrap.scrollTop = 48;
      expect(wrap.querySelector('thead th')).toHaveClass(
        'product-model-serial-purchases-sticky-head',
      );
    }
  });

  it('shows every bound order, opens it, and copies the visible number', async () => {
    const onOpenSaleCard = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    const { products } = serialPurchaseProducts();
    getStockOrderLinksMock.mockResolvedValue({
      links: [
        {
          productId: 'old-batch',
          serialNumber: 'R0000001',
          saleId: 'sale-current',
          recordNumber: 'r000010',
          kind: 'repair',
          status: 'new',
        },
        {
          productId: 'old-batch',
          serialNumber: 'R0000001',
          saleId: 'sale-other',
          recordNumber: 'r000088',
          kind: 'sale',
          status: 'reserved',
        },
        {
          productId: 'new-batch',
          serialNumber: 'R0000002',
          saleId: 'sale-second',
          recordNumber: 'r000099',
          kind: 'sale',
          status: 'paid',
        },
      ],
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={products}
        currentSaleId='sale-current'
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
        onOpenSaleCard={onOpenSaleCard}
      />,
    );

    const currentLink = await screen.findByRole('link', { name: 'r000010' });
    const otherLink = screen.getByRole('link', { name: 'r000088' });
    expect(currentLink).toHaveAttribute(
      'href',
      getOrderLink('sale-current', 'repair'),
    );
    expect(otherLink).toHaveAttribute('href', getOrderLink('sale-other', 'sale'));
    expect(screen.getByRole('link', { name: 'r000099' })).toBeInTheDocument();
    const reservedRow = currentLink.closest('tr');
    expect(reservedRow).toHaveClass('product-model-serial-row-reserved');
    expect(reservedRow).toHaveTextContent('R0000001');
    expect(reservedRow).toHaveTextContent('r000010');
    expect(reservedRow).toHaveTextContent('r000088');

    fireEvent.click(currentLink);
    expect(onOpenSaleCard).toHaveBeenCalledWith({
      id: 'sale-current',
      kind: 'repair',
    });
    fireEvent.click(otherLink, { ctrlKey: true });
    expect(onOpenSaleCard).toHaveBeenCalledTimes(1);

    const copyButton = currentLink
      .closest('.copyable-value')
      ?.querySelector('button');
    expect(copyButton).not.toBeNull();
    fireEvent.click(copyButton as HTMLButtonElement);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('r000010');
    });
    expect(onOpenSaleCard).toHaveBeenCalledTimes(1);
    copySpy.mockRestore();
  });

  it('drops an issued serial from outside the loaded sales and keeps a returned serial', async () => {
    const issued = createProduct({
      id: 'issued-unit',
      serialNumber: 'S000113',
      quantity: 1,
      purchaseDate: '2026-01-02',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    const returned = createProduct({
      id: 'returned-unit',
      serialNumber: 'S000114',
      quantity: 1,
      purchaseDate: '2026-02-02',
      createdAt: '2026-02-02T00:00:00.000Z',
    });
    getStockOrderLinksMock.mockResolvedValue({
      links: [
        {
          productId: issued.id,
          serialNumber: 'S000113',
          saleId: 'sale-issued',
          recordNumber: 'r000255',
          kind: 'sale',
          status: 'issued',
        },
        {
          productId: returned.id,
          serialNumber: 'S000114',
          saleId: 'sale-returned',
          recordNumber: 'r000256',
          kind: 'sale',
          status: 'returned',
        },
      ],
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[issued, returned]}
        sales={[]}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(await screen.findByRole('link', { name: 'r000256' })).toBeInTheDocument();
    expect(screen.getByText('S000114')).toBeInTheDocument();
    expect(screen.queryByText('S000113')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'r000255' })).not.toBeInTheDocument();
    expect(issued.quantity).toBe(1);
    expect(returned.quantity).toBe(1);
    expect(
      document.querySelector('.product-model-serial-row-reserved'),
    ).toHaveTextContent('S000114');
  });

  it('copies initial and edited article draft from the field label icon', async () => {
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    const products = [createProduct({ article: '  Art-123  ' })];

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={products}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('catalog.productModel.sections.main'),
      }),
    );

    const articleField = document.querySelector('.product-model-article-field');
    expect(articleField).not.toBeNull();
    const copyButton = articleField?.querySelector('.copyable-value-copy');
    expect(copyButton).not.toBeNull();

    fireEvent.click(copyButton as HTMLButtonElement);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('Art-123');
    });

    const input = articleField?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  New-Draft-45  ' } });

    fireEvent.click(
      articleField?.querySelector('.copyable-value-copy') as HTMLButtonElement,
    );
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('New-Draft-45');
    });

    fireEvent.change(input, { target: { value: '   ' } });
    expect(articleField?.querySelector('.copyable-value-copy')).toBeNull();

    copySpy.mockRestore();
  });

  it('copies article from the field label icon in read-only mode', async () => {
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    const products = [createProduct({ article: 'RO-900' })];

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={products}
        warehouses={[]}
        printForms={defaultPrintForms}
        readOnly
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('catalog.productModel.sections.main'),
      }),
    );

    const articleField = document.querySelector('.product-model-article-field');
    const copyButton = articleField?.querySelector('.copyable-value-copy');
    expect(copyButton).not.toBeNull();

    fireEvent.click(copyButton as HTMLButtonElement);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('RO-900');
    });

    copySpy.mockRestore();
  });

  it('shows sold serials when opened from Stock balances with Sold chip active', async () => {
    const sold = createProduct({
      id: 'sold-unit',
      serialNumber: 'S000113',
      quantity: 1,
      purchaseDate: '2026-01-02',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    getStockOrderLinksMock.mockResolvedValue({
      links: [
        {
          productId: sold.id,
          serialNumber: 'S000113',
          saleId: 'sale-issued',
          recordNumber: 'r000255',
          kind: 'sale',
          status: 'issued',
        },
      ],
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[sold]}
        sales={[]}
        stockStatuses={['free', 'in_order', 'sold']}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(await screen.findByRole('link', { name: 'r000255' })).toBeInTheDocument();
    expect(screen.getByText('S000113')).toBeInTheDocument();
  });

  it('keeps latest batch header and badge on on-hand units when opened from Stock balances with Sold active', async () => {
    const onHand = createProduct({
      id: 'onhand-unit',
      serialNumber: 'S-ONHAND',
      price: 200,
      purchaseDate: '2026-02-01',
      createdAt: '2026-02-01T00:00:00.000Z',
    });
    const soldSibling = createProduct({
      id: 'sold-sibling',
      serialNumber: 'S-SOLD-SIBLING',
      price: 200,
      purchaseDate: '2026-02-01',
      createdAt: '2026-02-01T01:00:00.000Z',
    });
    const soldNewer = createProduct({
      id: 'sold-newer',
      serialNumber: 'S-SOLD-NEW',
      price: 350,
      purchaseDate: '2026-04-01',
      createdAt: '2026-04-01T00:00:00.000Z',
    });
    getStockOrderLinksMock.mockResolvedValue({
      links: [
        {
          productId: soldSibling.id,
          serialNumber: soldSibling.serialNumber,
          saleId: 'sale-issued-1',
          recordNumber: 'r000301',
          kind: 'sale',
          status: 'issued',
        },
        {
          productId: soldNewer.id,
          serialNumber: soldNewer.serialNumber,
          saleId: 'sale-issued-2',
          recordNumber: 'r000302',
          kind: 'sale',
          status: 'issued',
        },
      ],
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[onHand, soldSibling, soldNewer]}
        sales={[]}
        stockStatuses={['free', 'in_order', 'sold']}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(await screen.findByRole('link', { name: 'r000302' })).toBeInTheDocument();
    expect(screen.getByText('S-SOLD-NEW')).toBeInTheDocument();
    expect(screen.getByText('S-SOLD-SIBLING')).toBeInTheDocument();
    expect(screen.getByText('S-ONHAND')).toBeInTheDocument();

    expect(
      screen.getByText(
        i18n.t('catalog.productModel.latestBatchSummary', {
          price: formatCurrency(onHand.price),
          date: formatDate(onHand.purchaseDate),
        }),
        { normalizer: (text) => text },
      ),
    ).toBeInTheDocument();

    const latestBadge = i18n.t('catalog.productModel.latestBatchBadge');
    expect(screen.getAllByText(latestBadge)).toHaveLength(1);
    expect(screen.getByText('S-ONHAND').closest('tr')).toHaveTextContent(latestBadge);
    expect(screen.getByText('S-SOLD-NEW').closest('tr')).not.toHaveTextContent(latestBadge);
    expect(screen.getByText('S-SOLD-SIBLING').closest('tr')).not.toHaveTextContent(latestBadge);
  });

  it('shows on-hand latest batch summary without badging sold rows when only Sold chip is active', async () => {
    const onHand = createProduct({
      id: 'onhand-unit',
      serialNumber: 'S-ONHAND',
      price: 200,
      purchaseDate: '2026-02-01',
      createdAt: '2026-02-01T00:00:00.000Z',
    });
    const soldNewer = createProduct({
      id: 'sold-newer',
      serialNumber: 'S-SOLD-NEW',
      price: 350,
      purchaseDate: '2026-04-01',
      createdAt: '2026-04-01T00:00:00.000Z',
    });
    getStockOrderLinksMock.mockResolvedValue({
      links: [
        {
          productId: soldNewer.id,
          serialNumber: soldNewer.serialNumber,
          saleId: 'sale-issued-2',
          recordNumber: 'r000302',
          kind: 'sale',
          status: 'issued',
        },
      ],
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[onHand, soldNewer]}
        sales={[]}
        stockStatuses={['sold']}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(await screen.findByRole('link', { name: 'r000302' })).toBeInTheDocument();
    expect(screen.getByText('S-SOLD-NEW')).toBeInTheDocument();
    expect(screen.queryByText('S-ONHAND')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        i18n.t('catalog.productModel.latestBatchSummary', {
          price: formatCurrency(onHand.price),
          date: formatDate(onHand.purchaseDate),
        }),
        { normalizer: (text) => text },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('catalog.productModel.latestBatchBadge')),
    ).not.toBeInTheDocument();
  });

  it('omits latest batch summary and badges when no on-hand unit exists', async () => {
    const sold = createProduct({
      id: 'sold-only',
      serialNumber: 'S-SOLD-ONLY',
      price: 350,
      purchaseDate: '2026-04-01',
      createdAt: '2026-04-01T00:00:00.000Z',
    });
    getStockOrderLinksMock.mockResolvedValue({
      links: [
        {
          productId: sold.id,
          serialNumber: sold.serialNumber,
          saleId: 'sale-issued-only',
          recordNumber: 'r000303',
          kind: 'sale',
          status: 'issued',
        },
      ],
    });

    render(
      <ProductModelModal
        name='БЖ Meanwell 9V 1.66A'
        products={[sold]}
        sales={[]}
        stockStatuses={['free', 'in_order', 'sold']}
        warehouses={[]}
        printForms={defaultPrintForms}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    expect(await screen.findByRole('link', { name: 'r000303' })).toBeInTheDocument();
    expect(screen.getByText('S-SOLD-ONLY')).toBeInTheDocument();
    expect(document.querySelector('.product-model-purchase-meta')).toBeNull();
    expect(
      screen.queryByText(i18n.t('catalog.productModel.latestBatchBadge')),
    ).not.toBeInTheDocument();
  });
});

describe('ProductModelModal stock label print without loaded settings', () => {
  it('does not print and shows that settings are loading', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const unit = createProduct({ id: 'unit-1', serialNumber: 'S000101' });

    render(
      <ProductModelModal
        name={unit.name}
        products={[unit]}
        warehouses={[]}
        printForms={null}
        printProduct={unit}
        onClose={vi.fn()}
        onSave={vi.fn(async () => true)}
      />,
    );

    fireEvent.click(getPrintButton());

    expect(await screen.findByRole('status')).toHaveTextContent(
      i18n.t('warehouse.print.settingsLoading'),
    );
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});

