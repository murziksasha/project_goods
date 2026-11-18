import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../../../../entities/client';
import type { Sale } from '../../../../entities/sale';
import { getOrderLink } from '../../../../pages/dashboard/model/dashboard-navigation';
import { ClientCardOverlay } from './ClientCardOverlay';
import { clearClientOrderTabs } from './client-order-tab';

const { idleQuery, historySales } = vi.hoisted(() => ({
  idleQuery: () => ({
    data: [] as unknown[],
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  historySales: { current: [] as Sale[] },
}));

vi.mock('../../../../entities/client', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../entities/client')
  >();
  return {
    ...actual,
    getClientHistory: vi.fn(async () => ({
      client: historyClient,
      sales: historySales.current,
      stats: { totalSales: 2, totalRevenue: 100, totalItemsSold: 1 },
    })),
  };
});

vi.mock('../../../../entities/product', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../entities/product')
  >();
  return { ...actual, useProductsQuery: () => idleQuery() };
});

vi.mock('../../../../entities/warehouse-settings', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../entities/warehouse-settings')
  >();
  return {
    ...actual,
    useWarehouseSettingsQuery: () => ({
      ...idleQuery(),
      data: { warehouses: [] },
    }),
  };
});

vi.mock('../../../../entities/supplier-order', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../entities/supplier-order')
  >();
  return { ...actual, useSupplierOrdersQuery: () => idleQuery() };
});

vi.mock('../../../../entities/sale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/sale')>();
  return {
    ...actual,
    getOccupiedSerialNumbers: vi.fn(async () => ({ occupied: [] as string[] })),
  };
});

const historyClient: Client = {
  id: 'client-1',
  phone: '+380501111111',
  phones: ['+380501111111'],
  name: 'Ivan Petrenko',
  email: '',
  address: '',
  registrationId: '',
  iban: '',
  note: '',
  status: '',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

const sale = (patch: Partial<Sale>): Sale => ({
  id: 'sale-1',
  recordNumber: 'r000001',
  saleDate: '2026-07-15T10:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'repair',
  status: 'paid',
  paidAmount: 100,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: historyClient.id,
    name: historyClient.name,
    phone: historyClient.phone,
    status: 'new',
  },
  product: null,
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-07-15T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
  ...patch,
});

const repair = sale({
  id: 'sale-repair-1',
  recordNumber: 'r000770',
  kind: 'repair',
  product: {
    id: 'device-1',
    article: '',
    name: 'Dell monitor',
    serialNumber: 'SN-1',
  },
});

const otherRepair = sale({
  id: 'sale-repair-2',
  recordNumber: 'r000771',
  kind: 'repair',
  product: {
    id: 'device-2',
    article: '',
    name: 'Old radio',
    serialNumber: '',
  },
});

const productSale = sale({
  id: 'sale-sale-1',
  recordNumber: 's000533',
  kind: 'sale',
  lineItems: [
    {
      id: 'line-product',
      kind: 'product',
      name: 'Phone case',
      price: 400,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: ['S000533'],
    },
  ],
});

const fakeOrderTab = () => {
  const tab = {
    closed: false,
    opener: window,
    focus: vi.fn(),
  };
  return tab as unknown as Window & {
    closed: boolean;
    focus: ReturnType<typeof vi.fn>;
  };
};

const renderOverlay = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientCardOverlay
        clientId={historyClient.id}
        client={historyClient}
        currentEmployee={null}
        sales={[repair, otherRepair, productSale]}
        clientDevices={[]}
        isSaving={false}
        onClose={vi.fn()}
        onOpenClientList={vi.fn()}
        onUpdateClient={vi.fn(async () => true)}
        onUpdateClientDevice={vi.fn(async () => true)}
        onDeleteClientDevice={vi.fn(async () => true)}
      />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  clearClientOrderTabs();
  historySales.current = [];
  cleanup();
  vi.restoreAllMocks();
});

describe('ClientCardOverlay order links', () => {
  it('opens Orders and Sales numbers in remembered tabs and keeps the overlay', async () => {
    historySales.current = [repair, otherRepair, productSale];
    const repairTab = fakeOrderTab();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(repairTab);
    renderOverlay();

    fireEvent.click(await screen.findByRole('tab', { name: 'Orders' }));
    const repairLink = await screen.findByRole('link', { name: 'r000770' });
    fireEvent.click(repairLink);
    fireEvent.click(repairLink);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(getOrderLink(repair.id, 'repair'), '_blank');
    expect(repairTab.focus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Ivan Petrenko' })).toBeVisible();

    repairTab.closed = true;
    const reopened = fakeOrderTab();
    openSpy.mockReturnValue(reopened);
    fireEvent.click(repairLink);
    expect(openSpy).toHaveBeenCalledTimes(2);

    const otherTab = fakeOrderTab();
    openSpy.mockReturnValue(otherTab);
    fireEvent.click(screen.getByRole('link', { name: 'r000771' }));
    expect(openSpy).toHaveBeenLastCalledWith(
      getOrderLink(otherRepair.id, 'repair'),
      '_blank',
    );

    fireEvent.click(repairLink, { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'S/N: SN-1' }));
    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('dialog', { name: 'Dell monitor' })).toBeVisible();

    const saleTab = fakeOrderTab();
    openSpy.mockReturnValue(saleTab);
    fireEvent.click(screen.getByRole('tab', { name: 'Sales' }));
    const saleLink = await screen.findByRole('link', { name: 's000533' });
    fireEvent.click(saleLink);
    fireEvent.click(saleLink);
    expect(openSpy).toHaveBeenCalledTimes(4);
    expect(openSpy).toHaveBeenLastCalledWith(getOrderLink(productSale.id, 'sale'), '_blank');
    expect(saleTab.focus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Ivan Petrenko' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'S/N: S000533' }));
    expect(openSpy).toHaveBeenCalledTimes(4);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Phone case' })).toBeVisible();
    });
  });
});
