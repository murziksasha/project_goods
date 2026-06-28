import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Client,
  ClientHistory,
} from '../../../../entities/client/model/types';
import type { Employee } from '../../../../entities/employee/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import type { ClientDevice } from '../../../../entities/client-device/model/types';
import { ClientsWorkspace } from './ClientsWorkspace';
import {
  clientsSuppliersSavedFiltersStorageKey,
  emptyFilters,
  mapClientDraftToPayload,
  type ClientDraft,
} from '../../model/clients-workspace';
import { getClientPhones, getPrimaryClientPhone } from '../../../../entities/client/model/forms';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const createClient = (overrides: Partial<Client>): Client => {
  const basePhone = overrides.phone ?? '+380501111111';
  const basePhones = overrides.phones ?? [basePhone];
  return {
    id: 'client-1',
    phone: basePhone,
    phones: basePhones,
    name: 'Ivan Petrenko',
    email: '',
    address: '',
    registrationId: '',
    iban: '',
    note: '',
    status: '',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
};

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

const createSale = (
  client: Client,
  overrides: Partial<Sale> = {},
): Sale => ({
  id: 'sale-1',
  recordNumber: 'r000001',
  saleDate: '2026-01-03T10:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'paid',
  paidAmount: 100,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [
    {
      id: 'line-1',
      kind: 'product',
      name: 'Phone case',
      price: 100,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
  client: {
    id: client.id,
    name: client.name,
    phone: client.phone,
    status: client.status,
  },
  product: {
    id: 'product-1',
    article: 'A-1',
    name: 'Phone case',
    serialNumber: '',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-01-03T10:00:00.000Z',
  updatedAt: '2026-01-03T10:00:00.000Z',
  ...overrides,
});

const renderWorkspace = ({
  clients = [],
  history = null,
  onOpenSaleCard = vi.fn(),
  onSelectClient = vi.fn(),
  sales = [],
  selectedClientId = null,
  clientDevices = [],
  onDeleteClientDevice = vi.fn().mockResolvedValue(true),
}: {
  clients?: Client[];
  history?: ClientHistory | null;
  onOpenSaleCard?: (sale: Sale) => void;
  onSelectClient?: (clientId: string | null) => void;
  sales?: Sale[];
  selectedClientId?: string | null;
  clientDevices?: ClientDevice[];
  onDeleteClientDevice?: (deviceId: string) => Promise<boolean>;
} = {}) =>
  render(
    <ClientsWorkspace
      currentEmployee={employee}
      clients={clients}
      sales={sales}
      selectedClientId={selectedClientId}
      history={history}
      isClientsLoading={false}
      isHistoryLoading={false}
      isSaving={false}
      isClientImporting={false}
      isClientExporting={false}
      onSelectClient={onSelectClient}
      onDeleteClient={vi.fn()}
      onCreateClient={vi.fn().mockResolvedValue(true)}
      onImportClients={vi.fn().mockResolvedValue(true)}
      onExportClients={vi.fn().mockResolvedValue(undefined)}
      onMergeClients={vi.fn().mockResolvedValue(true)}
      onUpdateClient={vi.fn().mockResolvedValue(true)}
      onOpenSaleCard={onOpenSaleCard}
      clientDevices={clientDevices}
      onUpdateClientDevice={vi.fn().mockResolvedValue(true)}
      onDeleteClientDevice={onDeleteClientDevice}
    />,
  );

describe('ClientsWorkspace', () => {
  it('uses one create-client form without person/company tabs', () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

    expect(screen.queryByRole('button', { name: 'Individual' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Company' })).not.toBeInTheDocument();
    expect(screen.getByText('Company ID or tax ID')).toBeInTheDocument();
    expect(screen.getByText('IBAN')).toBeInTheDocument();
  });

  it('blocks create while client requisites are invalid', () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Ivan Petrenko' },
    });
    fireEvent.change(screen.getByLabelText('IBAN'), {
      target: { value: 'bad-iban' },
    });

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('search clear resets the applied query', () => {
    const ivan = createClient({ id: 'client-ivan', name: 'Ivan Petrenko' });
    const olena = createClient({ id: 'client-olena', name: 'Olena Kovalenko' });
    renderWorkspace({ clients: [ivan, olena] });

    fireEvent.change(screen.getByLabelText('Search client'), {
      target: { value: 'Ivan' },
    });

    expect(screen.getByText('Ivan Petrenko')).toBeInTheDocument();
    expect(screen.queryByText('Olena Kovalenko')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Clear search text'));

    expect(screen.getByText('Ivan Petrenko')).toBeInTheDocument();
    expect(screen.getByText('Olena Kovalenko')).toBeInTheDocument();
  });

  it('marks blacklist clients in the clients table', () => {
    const riskClient = createClient({
      id: 'client-risk',
      name: 'Risk Client',
      status: 'blacklist',
    });
    const regularClient = createClient({
      id: 'client-regular',
      name: 'Regular Client',
      status: 'new',
      createdAt: '2026-01-02T10:00:00.000Z',
    });

    renderWorkspace({ clients: [riskClient, regularClient] });

    const blacklistRow = screen.getByLabelText(
      'Risk Client. Client is in blacklist',
    );
    expect(blacklistRow).toHaveClass('clients-table-row-blacklist');
    expect(
      within(blacklistRow).getByText('Blacklist'),
    ).toHaveClass('status-blacklist');
    expect(screen.getByText('Regular Client').closest('tr')).not.toHaveClass(
      'clients-table-row-blacklist',
    );
  });

  it('applies and clears advanced filters', () => {
    const ivan = createClient({
      id: 'client-ivan',
      name: 'Ivan Petrenko',
      phone: '+380501111111',
  phones: ['+380501111111'],
    });
    const olena = createClient({
      id: 'client-olena',
      name: 'Olena Kovalenko',
      phone: '+380502222222',
      phones: ['+380502222222'],
    });
    renderWorkspace({ clients: [ivan, olena] });

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByPlaceholderText('+380..., Ivan'), {
      target: { value: 'Olena' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.queryByText('Ivan Petrenko')).not.toBeInTheDocument();
    expect(screen.getByText('Olena Kovalenko')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(screen.getByText('Ivan Petrenko')).toBeInTheDocument();
    expect(screen.getByText('Olena Kovalenko')).toBeInTheDocument();
  });

  it('saves and reapplies client filters for the current employee only', () => {
    window.localStorage.setItem(
      clientsSuppliersSavedFiltersStorageKey,
      JSON.stringify([
        {
          id: 'other-filter',
          employeeId: 'other-employee',
          name: 'Other employee',
          icon: '?',
          tab: 'clients',
          filters: { ...emptyFilters, query: 'Hidden' },
          createdAt: '2026-06-01T00:00:00.000Z',
        },
      ]),
    );
    const ivan = createClient({ id: 'client-ivan', name: 'Ivan Petrenko' });
    const olena = createClient({ id: 'client-olena', name: 'Olena Kovalenko' });
    renderWorkspace({ clients: [ivan, olena] });

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(
      screen.queryByRole('button', { name: /Other employee/ }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('+380..., Ivan'), {
      target: { value: 'Olena' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));
    fireEvent.change(screen.getByPlaceholderText('My filter'), {
      target: { value: 'Olena filter' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(screen.getByText('Ivan Petrenko')).toBeInTheDocument();
    expect(screen.getByText('Olena Kovalenko')).toBeInTheDocument();

    fireEvent.click(
      screen
        .getAllByRole('button', { name: /Olena filter/ })
        .find((button) => button.className === 'orders-filter-saved-button')!,
    );

    expect(screen.queryByText('Ivan Petrenko')).not.toBeInTheDocument();
    expect(screen.getByText('Olena Kovalenko')).toBeInTheDocument();
  });

  it('enables merge only after two different clients are selected', () => {
    const ivan = createClient({ id: 'client-ivan', name: 'Ivan Petrenko' });
    const olena = createClient({ id: 'client-olena', name: 'Olena Kovalenko' });
    renderWorkspace({ clients: [ivan, olena] });

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    const mergeButton = screen.getByRole('button', {
      name: 'Merge clients',
    });
    expect(mergeButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Client 1'), {
      target: { value: 'Ivan' },
    });
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /Ivan Petrenko/ })
        .find((button) => button.className === 'suggestion-item')!,
    );
    expect(mergeButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Client 2'), {
      target: { value: 'Olena' },
    });
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /Olena Kovalenko/ })
        .find((button) => button.className === 'suggestion-item')!,
    );

    expect(mergeButton).not.toBeDisabled();
  });

  it('keeps primary phone edits in the client card modal', () => {
    const client = createClient({
      id: 'client-ivan',
      phone: '+380501111111',
      phones: ['+380501111111', '+380502222222'],
    });
    const { rerender } = renderWorkspace({ clients: [client] });

    fireEvent.click(screen.getByText('Ivan Petrenko'));
    const phoneInputs = screen.getAllByRole('textbox');
    fireEvent.change(phoneInputs[3], {
      target: { value: '+380509999999' },
    });

    expect(phoneInputs[3]).toHaveValue('+380509999999');

    rerender(
      <ClientsWorkspace
        currentEmployee={employee}
        clients={[
          {
            ...client,
            updatedAt: client.updatedAt,
          },
        ]}
        sales={[]}
        selectedClientId={client.id}
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
        onUpdateClient={vi.fn().mockResolvedValue(true)}
        onOpenSaleCard={vi.fn()}
        clientDevices={[]}
        onUpdateClientDevice={vi.fn().mockResolvedValue(true)}
        onDeleteClientDevice={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getAllByRole('textbox')[3]).toHaveValue('+380509999999');
  });

  it('opens a sale from the client card history', () => {
    const client = createClient({ id: 'client-ivan' });
    const sale = createSale(client);
    const onOpenSaleCard = vi.fn();
    const onSelectClient = vi.fn();

    renderWorkspace({
      clients: [client],
      history: {
        client,
        sales: [sale],
        stats: {
          totalItemsSold: 1,
          totalRevenue: 100,
          totalSales: 1,
        },
      },
      onOpenSaleCard,
      onSelectClient,
      sales: [sale],
      selectedClientId: client.id,
    });

    fireEvent.click(screen.getByText('Ivan Petrenko'));
    fireEvent.click(screen.getByRole('button', { name: 'Sales' }));
    fireEvent.click(screen.getByRole('button', { name: 'r000001' }));

    expect(onOpenSaleCard).toHaveBeenCalledWith(sale);
    expect(onSelectClient).toHaveBeenLastCalledWith(null);
  });

  it('shows client devices tab and unbinds a removable device', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const client = createClient({ id: 'client-ivan' });
    const onDeleteClientDevice = vi.fn().mockResolvedValue(true);
    const device: ClientDevice = {
      id: 'device-1',
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      name: 'Coffee machine',
      serialNumber: '',
      note: 'Kitchen',
      source: 'repairOrder',
      isActive: true,
      canRemove: true,
      usageCount: 0,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-02T10:00:00.000Z',
    };

    renderWorkspace({
      clients: [client],
      selectedClientId: client.id,
      clientDevices: [device],
      onDeleteClientDevice,
    });

    fireEvent.click(screen.getByText('Ivan Petrenko'));
    fireEvent.click(screen.getByRole('button', { name: 'Client devices' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unbind' }));

    await vi.waitFor(() => {
      expect(onDeleteClientDevice).toHaveBeenCalledWith('device-1');
    });
    confirmSpy.mockRestore();
  });
});

describe('client phones model helpers', () => {
  it('mapClientDraftToPayload always returns phones array and primary phone', () => {
    const draft: ClientDraft = {
      phone: '+380501234567',
      phones: ['+380501234567', '+380501234568'],
      name: 'Test',
      address: '',
      email: '',
      registrationId: '',
      iban: '',
      note: '',
    };
    const payload = mapClientDraftToPayload(draft);
    expect(payload.phone).toBe('+380501234567');
    expect(payload.phones).toEqual(['+380501234567', '+380501234568']);
    expect(payload.name).toBe('Test');
  });

  it('mapClientDraftToPayload falls back to phone when phones empty, keeps primary first, removes empties and dups', () => {
    const draft: ClientDraft = {
      phone: '  +380991112233  ',
      phones: ['', ' +380991112233 ', ' +380991112244 ', ''],
      name: 'Dup',
      address: '',
      email: '',
      registrationId: '',
      iban: '',
      note: '',
    };
    const payload = mapClientDraftToPayload(draft);
    expect(payload.phone).toBe('+380991112233');
    expect(payload.phones).toEqual(['+380991112233', '+380991112244']);
  });

  it('getClientPhones and getPrimaryClientPhone fallback for clients without phones array', () => {
    const oldClient = {
      id: 'c1',
      phone: '+380123456789',
      phones: [] as string[],
      name: 'Old',
      email: '',
      address: '',
      registrationId: '',
      iban: '',
      note: '',
      status: 'new' as const,
      createdAt: '',
      updatedAt: '',
    };
    expect(getClientPhones(oldClient)).toEqual(['+380123456789']);
    expect(getPrimaryClientPhone(oldClient)).toBe('+380123456789');

    const noPhone = { ...oldClient, phone: '', phones: [] as string[] };
    expect(getClientPhones(noPhone)).toEqual([]);
    expect(getPrimaryClientPhone(noPhone)).toBe('');
  });

  it('duplicate phones are rejected in form save logic (hasDuplicatePhones behavior)', () => {
    // The duplicate check is used in disabled state in ClientCardModal
    // Here we just verify the normalization prevents dups in map
    const draftWithDups: ClientDraft = {
      phone: '+380111',
      phones: ['+380111', '+380111', '+380222'],
      name: 'D',
      address: '',
      email: '',
      registrationId: '',
      iban: '',
      note: '',
    };
    const p = mapClientDraftToPayload(draftWithDups);
    expect(p.phones).toEqual(['+380111', '+380222']);
  });
});
