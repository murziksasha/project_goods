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
  onResetColumns: vi.fn(),
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

    fireEvent.click(screen.getByRole('tab', { name: /sales/i }));
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
      screen.getByPlaceholderText(/order, client, phone or device/i),
      {
        target: { value: 'iphone' },
      },
    );

    expect(onSearchChange).toHaveBeenCalledWith('iphone');
  });

  it('shows the visible kanban orders count without pagination', () => {
    render(
      <OrdersWorkspaceListHeader
        {...baseProps}
        activeTab="kanban"
        visibleTabs={['orders', 'kanban']}
        filteredOrdersCount={18}
      />,
    );

    expect(screen.getByLabelText('Orders: 18')).toBeInTheDocument();
    expect(screen.getByText('Orders: 18')).toBeInTheDocument();
    expect(screen.getByLabelText('Orders: 18').tagName).toBe('SPAN');
  });

  it('makes the orders count clickable when search matches one order', () => {
    const onOpenSingleMatch = vi.fn();

    render(
      <OrdersWorkspaceListHeader
        {...baseProps}
        activeTab="kanban"
        visibleTabs={['orders', 'kanban']}
        searchValue="r000588"
        filteredOrdersCount={1}
        onOpenSingleMatch={onOpenSingleMatch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Orders: 1' }));
    expect(onOpenSingleMatch).toHaveBeenCalledTimes(1);
  });

  it('opens the single search match from Enter in the search field', () => {
    const onOpenSingleMatch = vi.fn();

    render(
      <OrdersWorkspaceListHeader
        {...baseProps}
        searchValue="r000588"
        filteredOrdersCount={1}
        onOpenSingleMatch={onOpenSingleMatch}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText(/order, client, phone/i), {
      key: 'Enter',
    });
    expect(onOpenSingleMatch).toHaveBeenCalledTimes(1);
  });

  it('resets visible columns from the columns menu', () => {
    const onResetColumns = vi.fn();

    render(
      <OrdersWorkspaceListHeader
        {...baseProps}
        isColumnsMenuOpen
        onResetColumns={onResetColumns}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /reset columns/i }));
    expect(onResetColumns).toHaveBeenCalledTimes(1);
  });

  it('uses the sales search placeholder on the sales tab', () => {
    render(
      <OrdersWorkspaceListHeader
        {...baseProps}
        activeTab="sales"
      />,
    );

    expect(
      screen.getByPlaceholderText(
        /order, client, phone, product or manager/i,
      ),
    ).toBeInTheDocument();
  });
});