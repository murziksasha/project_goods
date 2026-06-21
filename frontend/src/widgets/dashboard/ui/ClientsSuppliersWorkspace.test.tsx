import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Employee } from '../../../entities/employee/model/types';
import type { Supplier } from '../../../entities/supplier/model/types';
import { ClientsSuppliersWorkspace } from './ClientsSuppliersWorkspace';

const employee: Employee = {
  id: 'employee-1',
  name: 'Tester',
  phone: '',
  email: '',
  role: 'owner',
  username: 'tester',
  permissions: [],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const supplier = (patch: Partial<Supplier> = {}): Supplier => ({
  id: 'supplier-1',
  name: 'Main Parts',
  phone: '+380501111111',
  phones: ['+380501111111'],
  supplierOrder: 'SO-1',
  note: '',
  isActive: true,
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  ...patch,
});

const renderWorkspace = (suppliers: Supplier[]) =>
  render(
    <ClientsSuppliersWorkspace
      currentEmployee={employee}
      clients={[]}
      sales={[]}
      suppliers={suppliers}
      selectedClientId={null}
      history={null}
      isClientsLoading={false}
      isHistoryLoading={false}
      isSaving={false}
      isClientImporting={false}
      isClientExporting={false}
      onSelectClient={vi.fn()}
      onDeleteClient={vi.fn()}
      onCreateClient={vi.fn().mockResolvedValue(true)}
      onImportClients={vi.fn().mockResolvedValue(true)}
      onExportClients={vi.fn().mockResolvedValue(undefined)}
      onMergeClients={vi.fn().mockResolvedValue(true)}
      onMergeSuppliers={vi.fn().mockResolvedValue(true)}
      onUpdateClient={vi.fn().mockResolvedValue(true)}
      onCreateSupplier={vi.fn().mockResolvedValue(true)}
      onUpdateSupplier={vi.fn().mockResolvedValue(true)}
      onOpenSaleCard={vi.fn()}
    />,
  );

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('ClientsSuppliersWorkspace suppliers filters', () => {
  it('does not show supplier order in the suppliers table', () => {
    renderWorkspace([supplier()]);

    fireEvent.click(screen.getByRole('button', { name: 'Suppliers' }));

    expect(screen.queryByRole('columnheader', { name: 'Supplier order' })).not.toBeInTheDocument();
    expect(screen.queryByText('SO-1')).not.toBeInTheDocument();
  });

  it('filters suppliers by status and date', () => {
    renderWorkspace([
      supplier({
        id: 'supplier-active',
        name: 'Fresh Supplier',
        isActive: true,
        createdAt: '2026-06-14T00:00:00.000Z',
      }),
      supplier({
        id: 'supplier-inactive',
        name: 'Old Supplier',
        isActive: false,
        createdAt: '2026-05-01T00:00:00.000Z',
      }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Suppliers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'active' },
    });
    fireEvent.change(screen.getByLabelText('Date from'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText('Fresh Supplier')).toBeInTheDocument();
    expect(screen.queryByText('Old Supplier')).not.toBeInTheDocument();
  });

  it('allows adding additional phones in supplier editor modal', () => {
    renderWorkspace([supplier()]);

    fireEvent.click(screen.getByRole('button', { name: 'Suppliers' }));
    fireEvent.click(screen.getByText('Main Parts'));
    fireEvent.click(screen.getByRole('button', { name: '+ Add phone' }));

    const phonesField = screen.getByText('Phones').parentElement as HTMLElement;
    expect(within(phonesField).getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByText('Additional phone')).toBeInTheDocument();
  });

  it('keeps saved supplier filters on the suppliers tab', () => {
    renderWorkspace([
      supplier({ id: 'supplier-main', name: 'Main Parts' }),
      supplier({ id: 'supplier-alt', name: 'Alt Parts' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Suppliers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByPlaceholderText('Supplier name or phone'), {
      target: { value: 'Alt' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));
    fireEvent.change(screen.getByPlaceholderText('My filter'), {
      target: { value: 'Alt suppliers' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      screen
        .getAllByRole('button', { name: /Alt suppliers/ })
        .some((button) => button.className === 'orders-filter-saved-button'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Clients' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(
      screen
        .queryAllByRole('button', { name: /Alt suppliers/ })
        .some((button) => button.className === 'orders-filter-saved-button'),
    ).toBe(false);
  });
});
