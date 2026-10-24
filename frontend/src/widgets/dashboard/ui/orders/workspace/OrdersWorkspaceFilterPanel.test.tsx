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

  describe('kanban master filter', () => {
    it('renders closed field text for All, Without master, single coworker, and selected count', () => {
      const { rerender } = render(
        <OrdersWorkspaceFilterPanel
          {...baseProps}
          variant="kanban"
          assigneeOptions={[
            { id: 'm1', label: 'Kostiantyn' },
            { id: 'm2', label: 'Petro' },
          ]}
          draftFilters={{
            ...emptyOrdersFilters,
            masterIds: [],
            includeUnassignedMaster: false,
          }}
        />,
      );

      // Default All
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();

      // Without master only
      rerender(
        <OrdersWorkspaceFilterPanel
          {...baseProps}
          variant="kanban"
          assigneeOptions={[
            { id: 'm1', label: 'Kostiantyn' },
            { id: 'm2', label: 'Petro' },
          ]}
          draftFilters={{
            ...emptyOrdersFilters,
            masterIds: [],
            includeUnassignedMaster: true,
          }}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Without master' }),
      ).toBeInTheDocument();

      // One coworker only
      rerender(
        <OrdersWorkspaceFilterPanel
          {...baseProps}
          variant="kanban"
          assigneeOptions={[
            { id: 'm1', label: 'Kostiantyn' },
            { id: 'm2', label: 'Petro' },
          ]}
          draftFilters={{
            ...emptyOrdersFilters,
            masterIds: ['m1'],
            includeUnassignedMaster: false,
          }}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Kostiantyn' }),
      ).toBeInTheDocument();

      // 2 selected (Without master + 1 coworker)
      rerender(
        <OrdersWorkspaceFilterPanel
          {...baseProps}
          variant="kanban"
          assigneeOptions={[
            { id: 'm1', label: 'Kostiantyn' },
            { id: 'm2', label: 'Petro' },
          ]}
          draftFilters={{
            ...emptyOrdersFilters,
            masterIds: ['m1'],
            includeUnassignedMaster: true,
          }}
        />,
      );
      expect(
        screen.getByRole('button', { name: '2 selected' }),
      ).toBeInTheDocument();

      // 2 coworkers selected
      rerender(
        <OrdersWorkspaceFilterPanel
          {...baseProps}
          variant="kanban"
          assigneeOptions={[
            { id: 'm1', label: 'Kostiantyn' },
            { id: 'm2', label: 'Petro' },
          ]}
          draftFilters={{
            ...emptyOrdersFilters,
            masterIds: ['m1', 'm2'],
            includeUnassignedMaster: false,
          }}
        />,
      );
      expect(
        screen.getByRole('button', { name: '2 selected' }),
      ).toBeInTheDocument();

      // 3 selected (Without master + 2 coworkers)
      rerender(
        <OrdersWorkspaceFilterPanel
          {...baseProps}
          variant="kanban"
          assigneeOptions={[
            { id: 'm1', label: 'Kostiantyn' },
            { id: 'm2', label: 'Petro' },
          ]}
          draftFilters={{
            ...emptyOrdersFilters,
            masterIds: ['m1', 'm2'],
            includeUnassignedMaster: true,
          }}
        />,
      );
      expect(
        screen.getByRole('button', { name: '3 selected' }),
      ).toBeInTheDocument();
    });

    it('opens master menu, toggles Without master, coworker, and All button', () => {
      const setDraftFilters = vi.fn();
      render(
        <OrdersWorkspaceFilterPanel
          {...baseProps}
          variant="kanban"
          assigneeOptions={[
            { id: 'm1', label: 'Kostiantyn' },
            { id: 'm2', label: 'Petro' },
          ]}
          draftFilters={{
            ...emptyOrdersFilters,
            masterIds: [],
            includeUnassignedMaster: false,
          }}
          setDraftFilters={setDraftFilters}
        />,
      );

      const toggleButton = screen.getByRole('button', { name: 'All' });
      fireEvent.click(toggleButton);

      // Checkboxes appear
      const withoutMasterCheckbox = screen.getByLabelText('Without master');
      const kostiantynCheckbox = screen.getByLabelText('Kostiantyn');
      const allOptionButton = document.querySelector(
        '.orders-filter-master-all-button',
      ) as HTMLButtonElement;

      expect(withoutMasterCheckbox).toBeInTheDocument();
      expect(kostiantynCheckbox).toBeInTheDocument();
      expect(allOptionButton).toBeInTheDocument();

      // Toggle Without master
      fireEvent.click(withoutMasterCheckbox);
      expect(setDraftFilters).toHaveBeenCalled();

      // Toggle coworker
      fireEvent.click(kostiantynCheckbox);
      expect(setDraftFilters).toHaveBeenCalled();

      // Click All button
      fireEvent.click(allOptionButton);
      expect(setDraftFilters).toHaveBeenCalled();
    });
  });
});
