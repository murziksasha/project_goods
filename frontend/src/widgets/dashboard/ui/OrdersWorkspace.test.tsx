import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Employee } from '../../../entities/employee/model/types';
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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('OrdersWorkspace', () => {
  it('does not load supplier orders when mounting the regular orders tab', async () => {
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
      />,
    );

    await waitFor(() => {
      expect(getSupplierOrders).not.toHaveBeenCalled();
    });
  });
});
