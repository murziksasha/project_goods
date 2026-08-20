import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersWorkspaceTabList } from './OrdersWorkspaceTabList';
import type { OrdersTab } from './orders-workspace-shared';

const permittedTabs: OrdersTab[] = [
  'orders',
  'kanban',
  'sales',
  'supplierOrders',
  'supplierInformation',
];

describe('OrdersWorkspaceTabList', () => {
  it('renders only visible tabs and opens permitted checkboxes', () => {
    const onToggleTabVisibility = vi.fn();

    render(
      <OrdersWorkspaceTabList
        activeTab="orders"
        visibleTabs={['orders', 'sales']}
        permittedTabs={permittedTabs}
        onActiveTabChange={vi.fn()}
        onToggleTabVisibility={onToggleTabVisibility}
      />,
    );

    expect(
      screen.getByRole('tab', { name: /^(orders|замовлення)$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /^(kanban|канбан)$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /choose visible tabs|видимі вкладки/i,
      }),
    );

    const kanban = screen.getByRole('checkbox', {
      name: /^(kanban|канбан)$/i,
    });
    expect(kanban).not.toBeChecked();
    fireEvent.click(kanban);
    expect(onToggleTabVisibility).toHaveBeenCalledWith('kanban');
  });

  it('disables the last remaining visible tab checkbox', () => {
    render(
      <OrdersWorkspaceTabList
        activeTab="orders"
        visibleTabs={['orders']}
        permittedTabs={['orders', 'sales']}
        onActiveTabChange={vi.fn()}
        onToggleTabVisibility={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /choose visible tabs|видимі вкладки/i,
      }),
    );

    expect(
      screen.getByRole('checkbox', { name: /^(orders|замовлення)$/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: /^(sales|продажі)$/i }),
    ).not.toBeDisabled();
    expect(
      screen.queryByRole('checkbox', {
        name: /^(information|інформація)$/i,
      }),
    ).not.toBeInTheDocument();
  });
});
