import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import * as financeApi from '../../../../../entities/finance/api/financeApi';
import * as saleApi from '../../../../../entities/sale/api/saleApi';
import * as supplierOrderApi from '../../../../../entities/supplier-order/api/supplierOrderApi';
import type { Employee } from '../../../../../entities/employee/model/types';
import type { Sale } from '../../../../../entities/sale/model/types';
import type { Cashbox } from '../../../../../entities/finance/model/types';
import type { PrintForm } from '../../../../../entities/settings/model/types';
import { OrdersWorkspace } from './OrdersWorkspace';

const {
  getSupplierOrdersMock,
  acceptSalePaymentMock,
  refundSalePaymentMock,
  updateSaleFavoriteMock,
  updateSaleWorkspaceMock,
  createFinanceTransactionMock,
  getCashboxesMock,
} = vi.hoisted(() => ({
  getSupplierOrdersMock: vi.fn(async (_query?: string) => []),
  acceptSalePaymentMock: vi.fn(),
  refundSalePaymentMock: vi.fn(),
  updateSaleFavoriteMock: vi.fn(),
  updateSaleWorkspaceMock: vi.fn(),
  createFinanceTransactionMock: vi.fn(),
  getCashboxesMock: vi.fn(
    async (_options?: { includeArchived?: boolean }): Promise<Cashbox[]> => [],
  ),
}));

vi.mock('../../../../../entities/supplier-order/api/supplierOrderApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../../entities/supplier-order/api/supplierOrderApi')
  >();
  return { ...actual, getSupplierOrders: getSupplierOrdersMock };
});
vi.mock('../../../../../entities/sale/api/saleApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../../entities/sale/api/saleApi')
  >();
  return {
    ...actual,
    acceptSalePayment: acceptSalePaymentMock,
    refundSalePayment: refundSalePaymentMock,
    updateSaleFavorite: updateSaleFavoriteMock,
    updateSaleWorkspace: updateSaleWorkspaceMock,
  };
});
vi.mock('../../../../../entities/finance/api/financeApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../../entities/finance/api/financeApi')
  >();
  return {
    ...actual,
    createFinanceTransaction: createFinanceTransactionMock,
    getCashboxes: getCashboxesMock,
  };
});

const restoreApiMocks = () => {
  getSupplierOrdersMock.mockImplementation(async () => []);
  getCashboxesMock.mockImplementation(async (): Promise<Cashbox[]> => []);

  vi.spyOn(supplierOrderApi, 'getSupplierOrders').mockImplementation(getSupplierOrdersMock);
  vi.spyOn(saleApi, 'acceptSalePayment').mockImplementation(acceptSalePaymentMock);
  vi.spyOn(saleApi, 'refundSalePayment').mockImplementation(refundSalePaymentMock);
  vi.spyOn(saleApi, 'updateSaleFavorite').mockImplementation(updateSaleFavoriteMock);
  vi.spyOn(saleApi, 'updateSaleWorkspace').mockImplementation(updateSaleWorkspaceMock);
  vi.spyOn(financeApi, 'createFinanceTransaction').mockImplementation(createFinanceTransactionMock);
  vi.spyOn(financeApi, 'getCashboxes').mockImplementation(getCashboxesMock);
};

beforeEach(() => {
  vi.restoreAllMocks();
  acceptSalePaymentMock.mockReset();
  refundSalePaymentMock.mockReset();
  updateSaleFavoriteMock.mockReset();
  updateSaleWorkspaceMock.mockReset();
  createFinanceTransactionMock.mockReset();
  getSupplierOrdersMock.mockReset();
  getCashboxesMock.mockReset();
  restoreApiMocks();
});

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
  isFavorite: false,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'ok',
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

const cashbox = {
  id: 'cashbox-1',
  name: 'Основная',
  balances: { UAH: 5000, USD: 0 },
  enabledCurrencies: { UAH: true, USD: false },
  isDefault: true,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const printForm: PrintForm = {
  id: 'receipt',
  title: 'Receipt',
  type: 'receipt',
  content: '<p>{{orderNumber}}</p>',
  contentFormat: 'html',
  pageSize: 'A4',
  orientation: 'portrait',
  isActive: true,
  sortOrder: 10,
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
      getCreateOrderHref={(tab) =>
        `/?page=orders&ordersTab=${tab}&createOrder=${tab === 'sales' ? 'sale' : 'repair'}`
      }
      onSaleUpdate={vi.fn()}
      onError={vi.fn()}
      onSuccess={vi.fn()}
      onOpenClientCard={vi.fn()}
      products={[]}
      clientDevices={[]}
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
      onCreateClientDevice={vi.fn(async () => true)}
      onUpdateClientDevice={vi.fn(async () => true)}
      onDeleteClientDevice={vi.fn(async () => true)}
      onUpdateProductModel={vi.fn(async () => true)}
      {...props}
    />,
  );

describe('OrdersWorkspace', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.clearAllMocks();
  });
  it('does not load supplier orders when mounting the regular orders tab', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(getSupplierOrdersMock).not.toHaveBeenCalled();
    });
  });

  it('reports selected sale id when opening and closing an order card', async () => {
    const onSelectedSaleIdChange = vi.fn();
    renderWorkspace({
      sales: [sale],
      onSelectedSaleIdChange,
    });

    const orderLink = screen.getByRole('link', { name: /r000001/i });
    expect(orderLink).toHaveAttribute(
      'href',
      '/?page=orders&ordersTab=orders&saleId=sale-1',
    );
    fireEvent.click(orderLink);

    expect(onSelectedSaleIdChange).toHaveBeenCalledWith('sale-1');
    expect(await screen.findByLabelText('Order card')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close order card'));

    expect(onSelectedSaleIdChange).toHaveBeenCalledWith(null);
  });

  it('scrolls the order card into view when opening from the order number link', async () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(
      scrollIntoView,
    );

    renderWorkspace({
      sales: [sale],
    });

    fireEvent.click(screen.getByRole('link', { name: /r000001/i }));

    expect(await screen.findByLabelText('Order card')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });

  it('scrolls the order card into view when opening from the device serial button', async () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(
      scrollIntoView,
    );

    renderWorkspace({
      sales: [
        {
          ...sale,
          product: {
            ...sale.product!,
            serialNumber: 'R0035759',
          },
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /s\/n: r0035759/i }));

    expect(await screen.findByLabelText('Order card')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });

  it('does not scroll when closing the order card', async () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(
      scrollIntoView,
    );

    renderWorkspace({
      sales: [sale],
    });

    fireEvent.click(screen.getByRole('link', { name: /r000001/i }));
    expect(await screen.findByLabelText('Order card')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Close order card'));

    expect(screen.queryByLabelText('Order card')).not.toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
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

    fireEvent.click(screen.getByRole('link', { name: /r000001/i }));

    const commentInput = await screen.findByPlaceholderText('Comment');
    expect(commentInput).not.toBeDisabled();
    fireEvent.change(commentInput, { target: { value: 'Ready for diagnostics' } });
    expect(screen.getByRole('button', { name: 'Add' })).not.toBeDisabled();
  });

  it('shows an error when order status update fails', async () => {
    const onError = vi.fn();
    const onSaleUpdate = vi.fn();
    updateSaleWorkspaceMock.mockRejectedValueOnce(
      new Error('Backend API is unavailable.'),
    );

    renderWorkspace({
      sales: [sale],
      onError,
      onSaleUpdate,
    });

    fireEvent.click(screen.getByRole('button', { name: 'New repair' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Diagnostics' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Backend API is unavailable.');
    });
    expect(onSaleUpdate).not.toHaveBeenCalled();
  });

  it('updates order status when crypto.randomUUID is unavailable on LAN HTTP', async () => {
    const randomUuidDescriptor = Object.getOwnPropertyDescriptor(
      crypto,
      'randomUUID',
    );
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    });
    const onSaleUpdate = vi.fn();
    const updatedSale: Sale = {
      ...sale,
      status: 'diagnostics',
      timeline: [
        {
          id: 'fallback-id',
          author: 'Manager',
          message: 'Status changed.',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    updateSaleWorkspaceMock.mockResolvedValueOnce(updatedSale);

    try {
      renderWorkspace({
        sales: [sale],
        onSaleUpdate,
      });

      fireEvent.click(screen.getByRole('button', { name: 'New repair' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Diagnostics' }));

      await waitFor(() => {
        expect(onSaleUpdate).toHaveBeenCalledWith(updatedSale);
      });
    } finally {
      if (randomUuidDescriptor) {
        Object.defineProperty(crypto, 'randomUUID', randomUuidDescriptor);
      }
    }
  });

  it('does not replace an order when status update returns an invalid response', async () => {
    const onError = vi.fn();
    const onSaleUpdate = vi.fn();
    updateSaleWorkspaceMock.mockResolvedValueOnce({
      sale,
    } as unknown as Sale);

    renderWorkspace({
      sales: [sale],
      onError,
      onSaleUpdate,
    });

    fireEvent.click(screen.getByRole('button', { name: 'New repair' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Diagnostics' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'Unexpected sale workspace update response from API.',
      );
    });
    expect(onSaleUpdate).not.toHaveBeenCalled();
  });

  it('keeps rendering after a status update returns a sale without product snapshot', async () => {
    const onSaleUpdate = vi.fn();
    const updatedSale: Sale = {
      ...sale,
      status: 'diagnostics',
      product: null,
      lineItems: [
        {
          id: 'line-1',
          kind: 'product',
          name: 'Fallback device',
          price: 0,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: [],
        },
      ],
      timeline: [
        {
          id: 'timeline-1',
          author: 'Manager',
          message: 'Status changed.',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    updateSaleWorkspaceMock.mockResolvedValueOnce(updatedSale);

    const { rerender } = renderWorkspace({
      sales: [sale],
      onSaleUpdate,
    });

    fireEvent.click(screen.getByRole('button', { name: 'New repair' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Diagnostics' }));

    await waitFor(() => {
      expect(onSaleUpdate).toHaveBeenCalledWith(updatedSale);
    });

    rerender(
      <OrdersWorkspace
        sales={[updatedSale]}
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
        getCreateOrderHref={(tab) =>
          `/?page=orders&ordersTab=${tab}&createOrder=${tab === 'sales' ? 'sale' : 'repair'}`
        }
        onSaleUpdate={onSaleUpdate}
        onError={vi.fn()}
        onSuccess={vi.fn()}
        onOpenClientCard={vi.fn()}
        products={[]}
        clientDevices={[]}
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
        onCreateClientDevice={vi.fn(async () => true)}
        onUpdateClientDevice={vi.fn(async () => true)}
        onDeleteClientDevice={vi.fn(async () => true)}
        onUpdateProductModel={vi.fn(async () => true)}
      />,
    );

    expect(screen.getByRole('button', { name: 'Diagnostics' })).toBeInTheDocument();
    expect(screen.getByText('Fallback device')).toBeInTheDocument();
  });

  it('saves a replacement repair device through the workspace API', async () => {
    const onSaleUpdate = vi.fn();
    const updatedSale: Sale = {
      ...sale,
      product: {
        ...sale.product!,
        name: 'Replacement device',
      },
      timeline: [
        {
          id: 'timeline-1',
          author: 'Manager',
          message: 'Manager updated order main information.',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    updateSaleWorkspaceMock.mockResolvedValueOnce(updatedSale);

    renderWorkspace({
      sales: [sale],
      onSaleUpdate,
      clientDevices: [
        {
          id: 'device-2',
          clientId: 'client-1',
          clientName: 'Client',
          clientPhone: '+380000000000',
          name: 'Replacement device',
          serialNumber: '',
          note: '',
          source: 'repairOrder',
          isActive: true,
          canRemove: true,
          usageCount: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('link', { name: /r000001/i }));
    fireEvent.click(await screen.findByLabelText('Change device'));
    fireEvent.click(screen.getByRole('button', { name: /Replacement device/ }));
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => {
      expect(updateSaleWorkspaceMock).toHaveBeenCalledWith(
        'sale-1',
        expect.objectContaining({
          deviceName: 'Replacement device',
          serialNumber: '',
        }),
      );
      expect(onSaleUpdate).toHaveBeenCalledWith(updatedSale);
    });
  });

  it('accepts sale payment through sale API instead of raw finance transaction API', async () => {
    const onSaleUpdate = vi.fn();
    const paidSale: Sale = {
      ...sale,
      paidAmount: 290,
      status: 'paid',
      paymentHistory: [
        {
          id: 'payment-1',
          type: 'deposit',
          paymentMethod: 'cash',
          amount: 290,
          cashboxId: 'cashbox-1',
          cashboxName: 'Основная',
          author: 'Manager',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    getCashboxesMock.mockResolvedValue([
      {
        id: 'cashbox-1',
        name: 'Основная',
        balances: { UAH: 500, USD: 0 },
        enabledCurrencies: { UAH: true, USD: false },
        isDefault: true,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    acceptSalePaymentMock.mockResolvedValue(paidSale);
    renderWorkspace({
      activeTab: 'sales',
      sales: [
        {
          ...sale,
          kind: 'sale',
          status: 'reserved',
          salePrice: 290,
          lineItems: [
            {
              id: 'li-1',
              kind: 'product',
              productId: 'product-1',
              name: 'Wireless Mouse',
              price: 290,
              quantity: 1,
              warrantyPeriod: 0,
              serialNumbers: [],
            },
          ],
        },
      ],
      currentEmployee: {
        ...employee,
        permissions: [
          'orders.view',
          'orders.manage',
          'finance.transactions.deposit',
          'finance.transactions.withdraw',
        ],
      },
      onSaleUpdate,
    });

    fireEvent.click(screen.getByRole('link', { name: /r000001/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept payment' }));
    let cashboxSelect: HTMLElement | undefined;
    await waitFor(() => {
      cashboxSelect = screen
        .getAllByRole('combobox')
        .find((select) =>
          Array.from(select.querySelectorAll('option')).some(
            (option) => option.value === 'cashbox-1',
          ),
        );
      expect(cashboxSelect).toBeTruthy();
    });
    fireEvent.change(cashboxSelect as HTMLSelectElement, {
      target: { value: 'cashbox-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept to cashbox' }));

    await waitFor(() => {
      expect(acceptSalePaymentMock).toHaveBeenCalledWith('sale-1', {
        cashboxId: 'cashbox-1',
        amount: '290',
        paymentMethod: 'cash',
        action: 'deposit',
        targetStatus: 'issued',
        author: 'Manager',
        issuedById: '',
      });
    });
    expect(createFinanceTransactionMock).not.toHaveBeenCalled();
    expect(refundSalePaymentMock).not.toHaveBeenCalled();
    expect(onSaleUpdate).toHaveBeenCalledWith(paidSale);
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Accept to cashbox' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText('Sale card')).toBeInTheDocument();
  });

  it('opens repair card payment as issue flow from Accept payment', async () => {
    const onSaleUpdate = vi.fn();
    const onSelectedSaleIdChange = vi.fn();
    const issuedSale: Sale = {
      ...sale,
      status: 'issued',
      paidAmount: 1250,
    };
    getCashboxesMock.mockResolvedValue([
      {
        id: 'cashbox-1',
        name: 'Основная',
        balances: { UAH: 5000, USD: 0 },
        enabledCurrencies: { UAH: true, USD: false },
        isDefault: true,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    acceptSalePaymentMock.mockResolvedValue(issuedSale);

    renderWorkspace({
      sales: [
        {
          ...sale,
          lineItems: [
            {
              id: 'service-1',
              kind: 'service',
              name: 'Diagnostics',
              price: 1250,
              quantity: 1,
              warrantyPeriod: 0,
            },
          ],
        },
      ],
      currentEmployee: {
        ...employee,
        permissions: [
          'orders.view',
          'orders.manage',
          'finance.transactions.deposit',
        ],
      },
      onSaleUpdate,
      onSelectedSaleIdChange,
    });

    const orderLink = screen.getByRole('link', { name: /r000001/i });
    expect(orderLink).toHaveAttribute(
      'href',
      '/?page=orders&ordersTab=orders&saleId=sale-1',
    );
    fireEvent.click(orderLink);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept payment' }));
    expect(
      await screen.findByRole('button', { name: 'Accept and issue' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept and issue' }));

    await waitFor(() => {
      expect(acceptSalePaymentMock).toHaveBeenCalledWith('sale-1', {
        cashboxId: 'cashbox-1',
        amount: '1250',
        paymentMethod: 'cash',
        action: 'depositAndIssue',
        targetStatus: 'issued',
        author: 'Manager',
        issuedById: 'manager-1',
      });
    });
    expect(onSaleUpdate).toHaveBeenCalledWith(issuedSale);
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Accept and issue' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Order card')).not.toBeInTheDocument();
    expect(onSelectedSaleIdChange).toHaveBeenCalledWith(null);
  });

  it('closes payment modal after successful issue without payment', async () => {
    const onSaleUpdate = vi.fn();
    const onSelectedSaleIdChange = vi.fn();
    const issuedSale: Sale = {
      ...sale,
      status: 'issued',
      paidAmount: 0,
    };
    getCashboxesMock.mockResolvedValue([cashbox]);
    acceptSalePaymentMock.mockResolvedValue(issuedSale);

    renderWorkspace({
      sales: [
        {
          ...sale,
          lineItems: [
            {
              id: 'service-1',
              kind: 'service',
              name: 'Diagnostics',
              price: 1250,
              quantity: 1,
              warrantyPeriod: 0,
            },
          ],
        },
      ],
      currentEmployee: {
        ...employee,
        permissions: [
          'orders.view',
          'orders.manage',
          'finance.transactions.deposit',
        ],
      },
      onSaleUpdate,
      onSelectedSaleIdChange,
    });

    fireEvent.click(screen.getByRole('link', { name: /r000001/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept payment' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Issue without payment' }),
    );

    await waitFor(() => {
      expect(acceptSalePaymentMock).toHaveBeenCalledWith('sale-1', {
        cashboxId: undefined,
        amount: '1250',
        paymentMethod: 'cash',
        action: 'issueWithoutPayment',
        targetStatus: 'issued',
        author: 'Manager',
        issuedById: 'manager-1',
      });
    });
    expect(onSaleUpdate).toHaveBeenCalledWith(issuedSale);
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Issue without payment' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Order card')).not.toBeInTheDocument();
    expect(onSelectedSaleIdChange).toHaveBeenCalledWith(null);
  });

  it('matches top search by normalized client phone digits', () => {
    renderWorkspace({
      sales: [
        {
          ...sale,
          client: {
            ...sale.client,
            phone: '095 289 82 07',
          },
        },
      ],
      searchValue: '0952898207',
    });

    expect(screen.getByRole('link', { name: /r000001/i })).toBeInTheDocument();
    expect(screen.queryByText('Orders not found.')).not.toBeInTheDocument();
  });

  it('matches top search by additional phone in client snapshot', () => {
    renderWorkspace({
      sales: [
        {
          ...sale,
          client: {
            ...sale.client,
            phone: '+380671112233',
            phones: ['+380671112233', '+380952898207'],
          },
        },
      ],
      searchValue: '0952898207',
    });

    expect(screen.getByRole('link', { name: /r000001/i })).toBeInTheDocument();
    expect(screen.queryByText('Orders not found.')).not.toBeInTheDocument();
  });

  it('matches client filter by normalized client phone digits', () => {
    renderWorkspace({
      sales: [
        {
          ...sale,
          client: {
            ...sale.client,
            phone: '+380952898207',
          },
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /Filter/i }));
    fireEvent.change(screen.getByPlaceholderText('Client name or phone'), {
      target: { value: '095 289 82 07' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByRole('link', { name: /r000001/i })).toBeInTheDocument();
    expect(screen.queryByText('Orders not found.')).not.toBeInTheDocument();
  });

  it('keeps payment modal open when opening print from payment modal', async () => {
    getCashboxesMock.mockResolvedValue([cashbox]);

    renderWorkspace({
      sales: [
        {
          ...sale,
          lineItems: [
            {
              id: 'service-1',
              kind: 'service',
              name: 'Diagnostics',
              price: 1250,
              quantity: 1,
              warrantyPeriod: 0,
            },
          ],
        },
      ],
      currentEmployee: {
        ...employee,
        permissions: [
          'orders.view',
          'orders.manage',
          'finance.transactions.deposit',
        ],
      },
      printForms: [printForm],
    });

    fireEvent.click(screen.getByRole('link', { name: /r000001/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Print' }));

    expect(await screen.findByRole('dialog', { name: 'Print order' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Accept to cashbox' }),
    ).toBeInTheDocument();
  });

  it('defaults orders and sales page size to 30 rows', () => {
    const repairSales = Array.from({ length: 31 }, (_, index) => ({
      ...sale,
      id: `repair-${index + 1}`,
      recordNumber: `R${String(index + 1).padStart(6, '0')}`,
      saleDate: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    }));
    const { unmount } = renderWorkspace({
      activeTab: 'orders',
      sales: repairSales,
    });

    expect(screen.getByLabelText('Rows per page')).toHaveValue('30');
    expect(screen.getAllByRole('link', { name: /^R\d{6}$/ })).toHaveLength(30);
    unmount();

    const productSales = repairSales.map((item, index) => ({
      ...item,
      id: `sale-${index + 1}`,
      kind: 'sale' as const,
      recordNumber: `S${String(index + 1).padStart(6, '0')}`,
    }));
    renderWorkspace({
      activeTab: 'sales',
      sales: productSales,
    });

    expect(screen.getByLabelText('Rows per page')).toHaveValue('30');
    expect(screen.getAllByRole('link', { name: /^S\d{6}$/ })).toHaveLength(30);
  });

  it('filters and updates starred repair orders', async () => {
    const onSaleUpdate = vi.fn();
    updateSaleFavoriteMock.mockResolvedValue({
      ...sale,
      isFavorite: true,
    });
    renderWorkspace({
      sales: [
        sale,
        {
          ...sale,
          id: 'sale-2',
          recordNumber: 'R000002',
          isFavorite: true,
        },
      ],
      onSaleUpdate,
    });

    expect(screen.getByRole('link', { name: 'R000001' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'R000002' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show starred orders' }));

    expect(screen.queryByRole('link', { name: 'R000001' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'R000002' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all orders' }));
    fireEvent.click(screen.getByRole('button', { name: 'Star R000001' }));

    expect(updateSaleFavoriteMock).toHaveBeenCalledWith('sale-1', {
      isFavorite: true,
    });
    expect(onSaleUpdate).toHaveBeenCalledWith({
      ...sale,
      isFavorite: true,
    });
    await waitFor(() => {
      expect(onSaleUpdate).toHaveBeenCalledWith({
        ...sale,
        isFavorite: true,
      });
    });
  });

  it('shows rapid sale label instead of client name in sales list', () => {
    renderWorkspace({
      activeTab: 'sales',
      sales: [
        {
          ...sale,
          kind: 'sale',
          isRapidSale: true,
          lineItems: [
            {
              id: 'li-1',
              kind: 'product',
              productId: 'product-1',
              name: 'Mouse',
              price: 100,
              quantity: 1,
              warrantyPeriod: 0,
            },
          ],
        },
      ],
    });

    expect(screen.getByText('Rapid sale')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rapid sale' })).not.toBeInTheDocument();
  });

  it('opens payment modal when pendingPaymentSale is provided', async () => {
    const onPendingPaymentSaleHandled = vi.fn();
    getCashboxesMock.mockResolvedValue([cashbox]);
    renderWorkspace({
      activeTab: 'sales',
      sales: [
        {
          ...sale,
          kind: 'sale',
          isRapidSale: true,
          salePrice: 100,
          lineItems: [
            {
              id: 'li-1',
              kind: 'product',
              productId: 'product-1',
              name: 'Mouse',
              price: 100,
              quantity: 1,
              warrantyPeriod: 0,
            },
          ],
        },
      ],
      currentEmployee: {
        ...employee,
        permissions: [
          'orders.view',
          'orders.manage',
          'finance.transactions.deposit',
        ],
      },
      pendingPaymentSale: {
        ...sale,
        kind: 'sale',
        isRapidSale: true,
        salePrice: 100,
        lineItems: [
          {
            id: 'li-1',
            kind: 'product',
            productId: 'product-1',
            name: 'Mouse',
            price: 100,
            quantity: 1,
            warrantyPeriod: 0,
          },
        ],
      },
      onPendingPaymentSaleHandled,
    });

    await waitFor(() => {
      expect(
        screen.getByRole('dialog', { name: 'Accept payment' }),
      ).toBeInTheDocument();
      expect(onPendingPaymentSaleHandled).toHaveBeenCalledTimes(1);
    });
  });
});
