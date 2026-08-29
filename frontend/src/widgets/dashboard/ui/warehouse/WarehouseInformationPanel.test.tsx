import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import type { Product } from '../../../../entities/product/model/types';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import i18n from '../../../../shared/i18n/config';
import type { WarehouseItem } from '../../model/warehouse-panel';
import { WarehouseInformationPanel } from './WarehouseInformationPanel';

afterEach(() => {
  cleanup();
});

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Patchcord 1m',
  article: 'PC-1',
  serialNumber: 'S-1',
  price: 100,
  salePriceOptions: [],
  note: '',
  quantity: 4,
  reservedQuantity: 0,
  freeQuantity: 4,
  isInStock: true,
  purchasePlace: '',
  warehouseId: 'w-1',
  locationId: 'l-1',
  supplierOrderId: 'so-1',
  supplierOrderItemIndex: 0,
  purchaseDate: '2026-01-01T00:00:00.000Z',
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const warehouses: WarehouseItem[] = [
  {
    id: 'w-1',
    name: 'Main',
    isActive: true,
    serviceCenterId: 'sc-1',
    receiptAddress: '',
    receiptPhone: '',
    locations: [{ id: 'l-1', name: 'A1' }],
  },
  {
    id: 'w-2',
    name: 'Old',
    isActive: false,
    serviceCenterId: 'sc-1',
    receiptAddress: '',
    receiptPhone: '',
    locations: [{ id: 'l-2', name: 'Archive' }],
  },
];

const supplierOrders: SupplierOrder[] = [
  {
    id: 'so-1',
    orderBaseId: 'SO-1',
    supplierId: 'supplier-1',
    supplierName: 'Cable Supplier',
    deliveryDate: '2026-01-01T00:00:00.000Z',
    supplyType: 'Local',
    number: 'SO-1',
    note: '',
    createdBy: 'Owner',
    status: 'stocked',
    paymentStatus: 'pending',
    receiptStatus: 'received',
    total: 100,
    paid: 0,
    isFavorite: false,
    items: [
      {
        lineId: 'line-1',
        itemIndex: 0,
        productName: 'Patchcord 1m',
        quantity: 4,
        price: 100,
        receiptStatus: 'received',
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const renderPanel = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <WarehouseInformationPanel
        products={[
          product(),
          product({
            id: 'p-2',
            name: 'Router',
            article: '',
            quantity: 2,
            price: 300,
            warehouseId: 'w-2',
            locationId: 'l-2',
            supplierOrderId: undefined,
            supplierOrderItemIndex: undefined,
            purchasePlace: 'Legacy Supplier',
          }),
        ]}
        sales={[]}
        warehouses={warehouses}
        supplierOrders={supplierOrders}
      />
    </I18nextProvider>,
  );

describe('WarehouseInformationPanel', () => {
  it('renders overview header, kpi cards, charts and product rows', () => {
    renderPanel();

    expect(screen.getByText(i18n.t('warehouse.information.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('warehouse.information.charts.topShare'))).toBeTruthy();
    expect(screen.getByText(i18n.t('warehouse.information.charts.topThree'))).toBeTruthy();
    expect(screen.getAllByText('Patchcord 1m').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Router').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.finance-distribution-row').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.bar-chart-item').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.warehouse-info-chip').length).toBeGreaterThan(0);
  });

  it('switches views without losing charts', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('warehouse.information.views.locations') }));
    expect(screen.getAllByText('Main').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Archive').length).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t('warehouse.information.charts.topShare'))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('warehouse.information.views.suppliers') }));
    expect(screen.getAllByText('Cable Supplier').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Legacy Supplier').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.bar-chart-item').length).toBeGreaterThan(0);
  });
});
