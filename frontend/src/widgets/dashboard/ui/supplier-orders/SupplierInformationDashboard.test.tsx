import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import { buildSupplierOrderAnalytics } from '../../model/supplier-order-utils';
import { SupplierInformationDashboard } from './SupplierInformationDashboard';

const makeOrder = (patch: Partial<SupplierOrder> = {}): SupplierOrder => ({
  id: 'so-1',
  orderBaseId: 'SO-1',
  supplierId: 'sup-1',
  supplierName: 'Parts Hub',
  deliveryDate: '2026-05-22',
  supplyType: 'local',
  number: 'SO-1',
  note: '',
  createdBy: 'Admin',
  status: 'approved',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  total: 1200,
  paid: 200,
  isFavorite: false,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      catalogProductId: 'cat-1',
      productName: 'Type C cable',
      quantity: 6,
      price: 200,
    },
  ],
  createdAt: '2026-05-19T10:00:00.000Z',
  updatedAt: '2026-05-19T10:00:00.000Z',
  ...patch,
});

describe('SupplierInformationDashboard', () => {
  it('shows an empty state when there are no filtered orders', () => {
    render(
      <SupplierInformationDashboard
        filteredOrdersCount={0}
        isLoading={false}
        supplierInformation={buildSupplierOrderAnalytics([])}
      />,
    );

    expect(
      screen.getByText(/No supplier-order information/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Open pipeline/i)).toBeNull();
  });

  it('renders KPIs, charts, and ranking tabs for supplier orders', () => {
    const analytics = buildSupplierOrderAnalytics(
      [
        makeOrder(),
        makeOrder({
          id: 'so-2',
          number: 'SO-2',
          supplierId: 'sup-2',
          supplierName: 'Cable World',
          total: 800,
          paid: 800,
          paymentStatus: 'paid',
          items: [
            {
              lineId: 'line-2',
              itemIndex: 0,
              productName: 'HDMI cable',
              quantity: 4,
              price: 200,
            },
          ],
        }),
      ],
      new Date('2026-05-20T00:00:00.000Z'),
    );

    render(
      <SupplierInformationDashboard
        filteredOrdersCount={2}
        isLoading={false}
        supplierInformation={analytics}
      />,
    );

    expect(screen.getByText(/Open pipeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Spend over time/i)).toBeInTheDocument();
    expect(screen.getByText(/Order status mix/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment mix/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Frequency/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Outstanding/i }));
    expect(screen.getByRole('tab', { name: /Outstanding/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
