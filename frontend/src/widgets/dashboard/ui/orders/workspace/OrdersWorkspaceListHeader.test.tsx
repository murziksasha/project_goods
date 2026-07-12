import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersWorkspaceListHeader } from './OrdersWorkspaceListHeader';
import type { OrdersColumnKey, OrdersTab } from './orders-workspace-shared';

const baseProps = {
  activeTab: 'orders' as const,
  visibleTabs: ['orders', 'sales', 'supplierOrders'] as OrdersTab[],
  searchValue: '',
  createOrderHref: '/dashboard?createOrder=orders',
  canCreateOrders: true,
  filteredOrdersCount: 42,
  currentPage: 1,
  currentPageSize: 30,
  activeFiltersCount: 0,
  isFilterPanelOpen: false,
  isColumnsMenuOpen: false,
  favoritesOnly: false,
  visibleColumnKeys: ['recordNumber', 'client'] as OrdersColumnKey[],
  columnsMenuRef: { current: null },
  onActiveTabChange: vi.fn(),
  onSearchChange: vi.fn(),
  onCreateOrder: vi.fn(),
  onPageChange: vi.fn(),
  onToggleFilterPanel: vi.fn(),
  onToggleColumnsMenu: vi.fn(),
  onToggleColumnVisibility: vi.fn(),
  onToggleFavoritesOnly: vi.fn(),
};

describe('OrdersWorkspaceListHeader', () => {
  it('renders tabs and forwards tab changes', () => {
    const onActiveTabChange = vi.fn();

    render(
      <OrdersWorkspaceListHeader
        {...baseProps}
        onActiveTabChange={onActiveTabChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /sales/i }));
    expect(onActiveTabChange).toHaveBeenCalledWith('sales');
  });

  it('forwards search input changes', () => {
    const onSearchChange = vi.fn();

    render(
      <OrdersWorkspaceListHeader
        {...baseProps}
        onSearchChange={onSearchChange}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText(/search by order/i),
      {
        target: { value: 'iphone' },
      },
    );

    expect(onSearchChange).toHaveBeenCalledWith('iphone');
  });
});