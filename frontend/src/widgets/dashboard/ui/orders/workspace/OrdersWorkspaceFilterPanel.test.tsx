import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emptyOrdersFilters, saleStatuses } from './orders-workspace-shared';
import { OrdersWorkspaceFilterPanel } from './OrdersWorkspaceFilterPanel';

const baseProps = {
  isFilterPanelOpen: true,
  isStatusFilterOpen: false,
  isSaveFilterDrawerOpen: false,
  canManageSavedFilters: true,
  visibleSavedFilters: [],
  employeeSavedFilters: [],
  draftFilters: emptyOrdersFilters,
  statusOptionsForActiveTab: saleStatuses,
  assigneeOptions: [{ id: 'manager-1', label: 'Olexandr' }],
  newFilterName: '',
  newFilterIcon: '⭐',
  statusFilterRef: { current: null },
  setDraftFilters: vi.fn(),
  setIsStatusFilterOpen: vi.fn(),
  setIsSaveFilterDrawerOpen: vi.fn(),
  setNewFilterName: vi.fn(),
  setNewFilterIcon: vi.fn(),
  onToggleStatusFilter: vi.fn(),
  onToggleAllStatuses: vi.fn(),
  onApplyFilters: vi.fn(),
  onResetFilters: vi.fn(),
  onSaveCurrentFilter: vi.fn(),
  onApplySavedFilter: vi.fn(),
  onRemoveSavedFilter: vi.fn(),
};

describe('OrdersWorkspaceFilterPanel', () => {
  it('hides repair type and shows sale type on the sales variant', () => {
    render(
      <OrdersWorkspaceFilterPanel {...baseProps} variant="sales" />,
    );

    expect(screen.getByText('Sale type')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.queryByText('Repair type')).not.toBeInTheDocument();
  });

  it('keeps repair type on the orders variant', () => {
    render(<OrdersWorkspaceFilterPanel {...baseProps} variant="full" />);

    expect(screen.getByText('Repair type')).toBeInTheDocument();
    expect(screen.queryByText('Sale type')).not.toBeInTheDocument();
  });

  it('updates sale type on the sales variant', () => {
    const setDraftFilters = vi.fn();
    render(
      <OrdersWorkspaceFilterPanel
        {...baseProps}
        variant="sales"
        setDraftFilters={setDraftFilters}
      />,
    );

    const saleTypeSelect = screen.getByText('Sale type').parentElement
      ?.querySelector('select') as HTMLSelectElement;
    fireEvent.change(saleTypeSelect, { target: { value: 'rapid' } });
    expect(setDraftFilters).toHaveBeenCalled();
  });
});
