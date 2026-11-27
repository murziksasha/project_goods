import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrintForm } from '../../../../entities/settings';
import { defaultPrintForms } from '../../../../entities/settings';
import { SupplierOrdersWorkspace } from './SupplierOrdersWorkspace';

const { modalPrintForms } = vi.hoisted(() => ({
  modalPrintForms: [] as Array<PrintForm[] | null | undefined>,
}));

vi.mock('../orders/modals/SupplierOrderModal', () => ({
  SupplierOrderModal: ({ printForms }: { printForms: PrintForm[] | null }) => {
    modalPrintForms.push(printForms);
    return null;
  },
}));

vi.mock('../../../../entities/supplier-order', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../entities/supplier-order')>();
  return {
    ...actual,
    useSupplierOrdersQuery: () => ({ data: [], isLoading: false, isError: false }),
  };
});

vi.mock('../../../../entities/saved-filter', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../entities/saved-filter')>();
  return { ...actual, listSavedFilters: vi.fn(async () => []) };
});

vi.mock('../../../../entities/warehouse-settings', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../entities/warehouse-settings')>();
  return {
    ...actual,
    getWarehouseSettings: vi.fn(async () => ({ warehouses: [], serviceCenters: [] })),
  };
});

const renderWorkspace = (printForms: PrintForm[] | null) => {
  const props: ComponentProps<typeof SupplierOrdersWorkspace> = {
    printForms,
    activeTab: 'supplierOrders',
    onActiveTabChange: vi.fn(),
    visibleTabs: ['supplierOrders'],
    suppliers: [],
    catalogProducts: [],
    currentEmployeeName: 'Admin',
    currentEmployeeId: 'employee-1',
    canViewSupplierOrders: true,
    canManageSupplierOrders: true,
    onCreateSupplier: vi.fn(async () => true),
    onUpdateSupplier: vi.fn(async () => true),
    onUpdateCatalogProduct: vi.fn(async () => true),
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SupplierOrdersWorkspace {...props} />
    </QueryClientProvider>,
  );
};

describe('SupplierOrdersWorkspace stock label print forms', () => {
  afterEach(() => {
    cleanup();
    modalPrintForms.length = 0;
  });

  it('passes the saved print forms to the receipt modal', async () => {
    const savedForms = defaultPrintForms.map((form) => ({ ...form }));
    renderWorkspace(savedForms);

    await waitFor(() => expect(modalPrintForms.length).toBeGreaterThan(0));
    expect(modalPrintForms.every((forms) => forms === savedForms)).toBe(true);
  });

  it('passes null while settings are loading (no built-in fallback)', async () => {
    renderWorkspace(null);

    await waitFor(() => expect(modalPrintForms.length).toBeGreaterThan(0));
    expect(modalPrintForms.every((forms) => forms === null)).toBe(true);
  });
});
