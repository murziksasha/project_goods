import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { Employee } from '../../../entities/employee/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { getSupplierOrders } from '../../../entities/supplier-order/api/supplierOrderApi';
import { OrdersWorkspace } from './OrdersWorkspace';

vi.mock('../../../entities/supplier-order/api/supplierOrderApi', () => ({
  getSupplierOrders: vi.fn(async () => []),
}));

const employee: Employee = {
  id: 'manager-1',
  name: 'Manager',
  phone: '',
  email: '',
  username: 'manager',
  role: 'manager',
  permissions: ['orders.view', 'orders.manage'],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const sale: Sale = {
  id: 'sale-1',
  recordNumber: 'R000001',
  saleDate: '2026-01-01T00:00:00.000Z',
  quantity: 1,
  salePrice: 0,
  kind: 'repair',
  status: 'new',
  paidAmount: 0,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'regular',
  },
  product: {
    id: 'product-1',
    article: 'ART-1',
    name: 'Device',
    serialNumber: '',
  },
  manager: {
    id: 'manager-1',
    name: 'Manager',
    role: 'manager',
  },
  master: null,
  issuedBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderWorkspace = (
  props: Partial<ComponentProps<typeof OrdersWorkspace>> = {},
) =>
  render(
    <OrdersWorkspace
      sales={[]}
      employees={[]}
      isLoading={false}
      activeTab="orders"
      visibleTabs={['orders', 'sales']}
      searchValue=""
      currentEmployee={employee}
      canCreateOrders={true}
      onActiveTabChange={vi.fn()}
      onSearchChange={vi.fn()}
      onCreateOrder={vi.fn()}
      createOrderHref="/?page=orders&ordersTab=orders&createOrder=repair"
      onSaleUpdate={vi.fn()}
      onError={vi.fn()}
      onSuccess={vi.fn()}
      onOpenClientCard={vi.fn()}
      products={[]}
      catalogProducts={[]}
      printForms={[]}
      printCompanySettings={{
        serviceName: 'Service CRM',
        company: 'Service CRM',
        companyAddress: '',
        companyId: '',
        companyIban: '',
        companyEmail: '',
        companySite: '',
      }}
      onUpdateProductModel={vi.fn(async () => true)}
      {...props}
    />,
  );

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('OrdersWorkspace', () => {
  it('does not load supplier orders when mounting the regular orders tab', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(getSupplierOrders).not.toHaveBeenCalled();
    });
  });

  it('reports selected sale id when opening and closing an order card', async () => {
    const onSelectedSaleIdChange = vi.fn();
    renderWorkspace({
      sales: [sale],
      onSelectedSaleIdChange,
    });

    fireEvent.click(screen.getByRole('button', { name: /r000001/i }));

    expect(onSelectedSaleIdChange).toHaveBeenCalledWith('sale-1');
    expect(await screen.findByLabelText('Order card')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close order card'));

    expect(onSelectedSaleIdChange).toHaveBeenCalledWith(null);
  });

  it('allows a master with role defaults to use the live feed composer', async () => {
    renderWorkspace({
      sales: [sale],
      currentEmployee: {
        ...employee,
        id: 'master-1',
        role: 'master',
        permissions: [],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /r000001/i }));

    const commentInput = await screen.findByPlaceholderText('Comment');
    expect(commentInput).not.toBeDisabled();
    fireEvent.change(commentInput, { target: { value: 'Ready for diagnostics' } });
    expect(screen.getByRole('button', { name: 'Add' })).not.toBeDisabled();
  });
});
