import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Employee } from '../../../../entities/employee';
import type { Supplier } from '../../../../entities/supplier';
import { ClientsSuppliersWorkspace } from './ClientsSuppliersWorkspace';

const savedFiltersStore: Array<Record<string, unknown>> = [];

vi.mock(
  '../../../../entities/saved-filter',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../entities/saved-filter')
      >();
    return {
      ...actual,
      listSavedFilters: vi.fn(async () =>
        savedFiltersStore.filter((item) => item.scope === 'clients'),
      ),
      createSavedFilter: vi.fn(
        async (payload: Record<string, unknown>) => {
          const created = {
            id: `sf-${savedFiltersStore.length + 1}`,
            employeeId: 'employee-1',
            scope: payload.scope,
            tab: payload.tab,
            name: payload.name,
            icon: payload.icon,
            filters: payload.filters,
            createdAt: new Date().toISOString(),
          };
          savedFiltersStore.unshift(created);
          return created;
        },
      ),
      deleteSavedFilter: vi.fn(async (filterId: string) => {
        const index = savedFiltersStore.findIndex(
          (item) => item.id === filterId,
        );
        if (index >= 0) savedFiltersStore.splice(index, 1);
        return { id: filterId, deleted: true as const };
      }),
    };
  },
);

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
      onImportSuppliers={vi.fn().mockResolvedValue(true)}
      onExportSuppliers={vi.fn().mockResolvedValue(undefined)}
      onMergeClients={vi.fn().mockResolvedValue(true)}
      onMergeSuppliers={vi.fn().mockResolvedValue(true)}
      onUpdateClient={vi.fn().mockResolvedValue(true)}
      onCreateSupplier={vi.fn().mockResolvedValue(true)}
      onUpdateSupplier={vi.fn().mockResolvedValue(true)}
      onOpenSaleCard={vi.fn()}
      clientDevices={[]}
      onUpdateClientDevice={vi.fn().mockResolvedValue(true)}
      onDeleteClientDevice={vi.fn().mockResolvedValue(true)}
    />,
  );

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  savedFiltersStore.length = 0;
});

describe('ClientsSuppliersWorkspace suppliers filters', () => {
  it('does not show supplier order in the suppliers table', () => {
    renderWorkspace([supplier()]);

    fireEvent.click(screen.getByRole('tab', { name: /Suppliers/ }));

    expect(
      screen.queryByRole('columnheader', { name: 'Supplier order' }),
    ).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('tab', { name: /Suppliers/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'active' },
    });
    fireEvent.change(screen.getByLabelText('Date from'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText('Fresh Supplier')).toBeInTheDocument();
    expect(
      screen.queryByText('Old Supplier'),
    ).not.toBeInTheDocument();
  });

  it('keeps primary phone edits in the supplier editor modal', () => {
    renderWorkspace([
      supplier({
        phones: ['+380501111111', '+380502222222'],
      }),
    ]);

    fireEvent.click(screen.getByRole('tab', { name: /Suppliers/ }));
    fireEvent.click(screen.getByText('Main Parts'));

    const phoneInputs = screen.getAllByRole('textbox');
    fireEvent.change(phoneInputs[1], {
      target: { value: '+380509999999' },
    });

    expect(phoneInputs[1]).toHaveValue('+380509999999');
  });

  it('allows promoting an additional supplier phone to primary', () => {
    renderWorkspace([
      supplier({
        phones: ['+380501111111', '+380502222222'],
      }),
    ]);

    fireEvent.click(screen.getByRole('tab', { name: /Suppliers/ }));
    fireEvent.click(screen.getByText('Main Parts'));

    const phonesField = screen.getByText('Phones')
      .parentElement as HTMLElement;
    fireEvent.click(
      within(phonesField).getByRole('button', {
        name: 'Set as primary phone',
      }),
    );

    const phoneInputs = within(phonesField).getAllByRole('textbox');
    expect(phoneInputs[0]).toHaveValue('+380502222222');
    expect(phoneInputs[1]).toHaveValue('+380501111111');
  });

  it('allows adding additional phones in supplier editor modal', () => {
    renderWorkspace([supplier()]);

    fireEvent.click(screen.getByRole('tab', { name: /Suppliers/ }));
    fireEvent.click(screen.getByText('Main Parts'));
    fireEvent.click(
      screen.getByRole('button', { name: '+ Add phone' }),
    );

    const phonesField = screen.getByText('Phones')
      .parentElement as HTMLElement;
    expect(within(phonesField).getAllByRole('textbox')).toHaveLength(
      2,
    );
    expect(screen.getByText('Additional phone')).toBeInTheDocument();
  });

  it('keeps saved supplier filters on the suppliers tab', async () => {
    renderWorkspace([
      supplier({ id: 'supplier-main', name: 'Main Parts' }),
      supplier({ id: 'supplier-alt', name: 'Alt Parts' }),
    ]);

    fireEvent.click(screen.getByRole('tab', { name: /Suppliers/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(
      screen.getByPlaceholderText('Supplier name or phone'),
      {
        target: { value: 'Alt' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Save filter' }),
    );
    fireEvent.change(screen.getByPlaceholderText('My filter'), {
      target: { value: 'Alt suppliers' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('button', { name: /Alt suppliers/ })
          .some(
            (button) =>
              button.className === 'orders-filter-saved-button',
          ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('tab', { name: /Clients/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(
      screen
        .queryAllByRole('button', { name: /Alt suppliers/ })
        .some(
          (button) =>
            button.className === 'orders-filter-saved-button',
        ),
    ).toBe(false);
  });

  it('renders Import XLS and Export XLS buttons on the suppliers tab and triggers actions', async () => {
    const onExportSuppliers = vi.fn().mockResolvedValue(undefined);
    const onImportSuppliers = vi.fn().mockResolvedValue(true);

    render(
      <ClientsSuppliersWorkspace
        currentEmployee={employee}
        clients={[]}
        sales={[]}
        suppliers={[supplier()]}
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
        onImportSuppliers={onImportSuppliers}
        onExportSuppliers={onExportSuppliers}
        onMergeClients={vi.fn().mockResolvedValue(true)}
        onMergeSuppliers={vi.fn().mockResolvedValue(true)}
        onUpdateClient={vi.fn().mockResolvedValue(true)}
        onCreateSupplier={vi.fn().mockResolvedValue(true)}
        onUpdateSupplier={vi.fn().mockResolvedValue(true)}
        onOpenSaleCard={vi.fn()}
        clientDevices={[]}
        onUpdateClientDevice={vi.fn().mockResolvedValue(true)}
        onDeleteClientDevice={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Suppliers/ }));

    const importButton = screen.getByRole('button', {
      name: 'Import XLS',
    });
    const exportButton = screen.getByRole('button', {
      name: 'Export XLS',
    });

    expect(importButton).toBeInTheDocument();
    expect(exportButton).toBeInTheDocument();

    fireEvent.click(exportButton);
    expect(onExportSuppliers).toHaveBeenCalledTimes(1);

    const fileInput = document.querySelector(
      'input[type="file"].clients-import-input',
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const testFile = new File(['dummy content'], 'suppliers.xls', {
      type: 'application/vnd.ms-excel',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(onImportSuppliers).toHaveBeenCalledWith(testFile);
    });
  });
});
