import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clipboard from '../../../../shared/lib/clipboard';
import type { Client } from '../../../../entities/client';
import type { Sale } from '../../../../entities/sale';
import { getOrderLink } from '../../../../pages/dashboard/model/dashboard-navigation';
import i18n from '../../../../shared/i18n/config';
import type { ClientMainForm } from '../../model/clients-workspace';
import { ClientCardModal } from './ClientCardModal';
import { clearClientOrderTabs } from './client-order-tab';

const { idleQuery } = vi.hoisted(() => ({
  idleQuery: () => ({
    data: [] as unknown[],
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

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

afterEach(() => {
  clearClientOrderTabs();
  cleanup();
  vi.restoreAllMocks();
});

const client: Client = {
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

const historySale = (patch: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  recordNumber: 'r000001',
  saleDate: '2026-07-15T10:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'issued',
  paidAmount: 100,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: client.id,
    name: client.name,
    phone: client.phone,
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

const repairSale = historySale({
  id: 'sale-repair-1',
  recordNumber: 'r000770',
  kind: 'repair',
  status: 'paid',
  product: {
    id: 'device-1',
    article: '',
    name: 'Dell monitor',
    serialNumber: 'SN-1',
  },
  lineItems: [
    {
      id: 'line-device',
      kind: 'product',
      name: 'Dell monitor',
      price: 0,
      quantity: 1,
      warrantyPeriod: 0,
    },
    {
      id: 'line-service',
      kind: 'service',
      name: 'BIOS flash',
      price: 400,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
});

const secondRepair = historySale({
  id: 'sale-repair-2',
  recordNumber: 'r000771',
  kind: 'repair',
  status: 'new',
  product: {
    id: 'device-2',
    article: '',
    name: 'Old radio',
    serialNumber: '',
  },
});

const productSale = historySale({
  id: 'sale-sale-1',
  recordNumber: 's000533',
  kind: 'sale',
  product: {
    id: 'product-1',
    article: 'A-1',
    name: 'Phone case',
    serialNumber: '',
  },
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

const mainTabForm: ClientMainForm = {
  phone: '+380501111111',
  phones: ['+380501111111'],
  name: 'Ivan Petrenko',
  email: '',
  address: '',
  registrationId: '',
  iban: '',
  note: '',
  status: '',
};

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

const renderCard = (
  patch: Partial<Parameters<typeof ClientCardModal>[0]> = {},
) =>
  render(
    <ClientCardModal
      activeHistoryRows={[]}
      clientCardTab='main'
      historyClient={client}
      isHistoryLoading={false}
      isSaving={false}
      mainTabForm={mainTabForm}
      mainTabPhoneError={null}
      selectedClient={client}
      selectedClientId={client.id}
      clientVisitCount={1}
      onClose={vi.fn()}
      onMainTabFormChange={vi.fn()}
      onSaveMainTab={vi.fn()}
      onTabChange={vi.fn()}
      onValidatePhone={() => true}
      onClearPhoneError={vi.fn()}
      clientDevices={[]}
      onUpdateClientDevice={vi.fn(async () => true)}
      onDeleteClientDevice={vi.fn(async () => true)}
      {...patch}
    />,
  );

describe('ClientCardModal', () => {
  it('keeps Save in the footer and uses auto status instead of effective New', () => {
    renderCard();

    expect(
      screen.getByRole('button', { name: 'Save client' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Status/ })).toHaveValue('');
    expect(screen.getByText('Auto: New')).toBeInTheDocument();
  });

  it('writes stored status from the select, not effective status', () => {
    const onMainTabFormChange = vi.fn();
    renderCard({ onMainTabFormChange });

    fireEvent.change(screen.getByRole('combobox', { name: /Status/ }), {
      target: { value: 'ok' },
    });

    const updater = onMainTabFormChange.mock.calls[0][0] as (
      current: ClientMainForm,
    ) => ClientMainForm;
    expect(updater(mainTabForm).status).toBe('ok');
  });

  it('copies the header phone from the hover icon and keeps the tel link', async () => {
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    renderCard();

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'tel:+380501111111',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });
    expect(copySpy).toHaveBeenCalledWith('+380501111111');
  });

  it('shows Device instead of services on Orders and opens the order in a new tab', () => {
    const opened = fakeOrderTab();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(opened);
    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [repairSale, secondRepair],
    });

    expect(screen.getByRole('columnheader', { name: 'Device' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Service' })).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search by number, device, serial, status'),
    ).toBeInTheDocument();
    expect(screen.getByText('Dell monitor')).toBeInTheDocument();
    expect(screen.getByText('S/N: SN-1')).toBeInTheDocument();
    expect(screen.queryByText(/BIOS flash/)).not.toBeInTheDocument();

    const numberLink = screen.getByRole('link', { name: 'r000770' });
    expect(numberLink).toHaveAttribute('href', getOrderLink(repairSale.id, 'repair'));

    fireEvent.click(numberLink);
    fireEvent.click(numberLink);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(getOrderLink(repairSale.id, 'repair'), '_blank');
    expect(opened.focus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Ivan Petrenko' })).toBeVisible();

    opened.closed = true;
    const reopened = fakeOrderTab();
    openSpy.mockReturnValue(reopened);
    fireEvent.click(numberLink);
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(reopened.focus).not.toHaveBeenCalled();

    const other = fakeOrderTab();
    openSpy.mockReturnValue(other);
    fireEvent.click(screen.getByRole('link', { name: 'r000771' }));
    expect(openSpy).toHaveBeenLastCalledWith(
      getOrderLink(secondRepair.id, 'repair'),
      '_blank',
    );
    expect(screen.getByRole('dialog', { name: 'Ivan Petrenko' })).toBeVisible();
  });

  it('leaves modified order-number clicks to the browser', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeOrderTab());
    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [repairSale],
    });

    const numberLink = screen.getByRole('link', { name: 'r000770' });
    fireEvent.click(numberLink, { ctrlKey: true });
    fireEvent.click(numberLink, { metaKey: true });
    fireEvent.click(numberLink, { shiftKey: true });
    fireEvent.click(numberLink, { altKey: true });
    fireEvent.click(numberLink, { button: 1 });
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Ivan Petrenko' })).toBeVisible();
  });

  it('uses a sales deep link and a separate tab on the Sales tab', () => {
    const opened = fakeOrderTab();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(opened);
    renderCard({
      clientCardTab: 'sales',
      activeHistoryRows: [productSale],
    });

    expect(screen.getByRole('columnheader', { name: 'Sale' })).toBeInTheDocument();
    expect(screen.getByText('Phone case x1')).toBeInTheDocument();

    const numberLink = screen.getByRole('link', { name: 's000533' });
    expect(numberLink).toHaveAttribute('href', getOrderLink(productSale.id, 'sale'));

    fireEvent.click(numberLink);
    fireEvent.click(numberLink);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(getOrderLink(productSale.id, 'sale'), '_blank');
    expect(opened.focus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Ivan Petrenko' })).toBeVisible();
  });

  it('copies the history order number from the hover icon without opening the card', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeOrderTab());
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [repairSale],
    });

    const numberCopy = within(
      screen.getByRole('link', { name: 'r000770' }).closest(
        '.copyable-value',
      ) as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(numberCopy);

    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('r000770');
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('copies history serials from the hover icon without opening the card', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeOrderTab());
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [repairSale],
    });

    const serialCopy = within(
      screen.getByText('S/N: SN-1').closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(serialCopy);

    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('SN-1');
    });
    expect(openSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'S/N: SN-1' }));
    expect(screen.getByRole('dialog', { name: 'Dell monitor' })).toBeVisible();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('copies bound sale serials on the Sales tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeOrderTab());
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    renderCard({
      clientCardTab: 'sales',
      activeHistoryRows: [productSale],
    });

    expect(screen.getByText('S/N: S000533')).toBeInTheDocument();
    const serialCopy = within(
      screen.getByText('S/N: S000533').closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(serialCopy);

    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('S000533');
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('hides the serial copy control when the serial is empty', () => {
    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [
        historySale({
          id: 'sale-repair-empty',
          recordNumber: 'r000771',
          kind: 'repair',
          product: {
            id: 'device-2',
            article: '',
            name: 'Old TV',
            serialNumber: '',
          },
        }),
      ],
    });

    expect(screen.getByText('Old TV')).toBeInTheDocument();
    expect(screen.queryByText(/S\/N:/)).not.toBeInTheDocument();
  });

  it('hides Client list unless the orders overlay asks for it', () => {
    renderCard();
    expect(
      screen.queryByRole('button', { name: 'Client list' }),
    ).not.toBeInTheDocument();
  });

  it('shows Client list on a non-main tab and calls onOpenClientList', () => {
    const onOpenClientList = vi.fn();
    renderCard({
      clientCardTab: 'orders',
      showClientListButton: true,
      onOpenClientList,
      activeHistoryRows: [repairSale],
    });

    expect(
      screen.queryByRole('button', { name: 'Save client' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Client list' }));
    expect(onOpenClientList).toHaveBeenCalledTimes(1);
  });

  it('does not open a tab from the device, status, or expand control', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeOrderTab());
    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [repairSale],
    });

    fireEvent.click(screen.getByText('Dell monitor'));
    fireEvent.click(screen.getByText('paid'));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle contents of r000770' }));
    expect(openSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Toggle contents of r000770' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

});

const toggleFor = (number: string) =>
  screen.getByRole('button', { name: `Toggle contents of ${number}` });

const contentsFor = (number: string) => {
  const id = toggleFor(number).getAttribute('aria-controls');
  const contents = id ? document.getElementById(id) : null;
  expect(contents).not.toBeNull();
  return contents as HTMLElement;
};

const detailedRepair = historySale({
  id: 'sale-repair-detail',
  recordNumber: 'r000780',
  kind: 'repair',
  status: 'paid',
  product: {
    id: 'device-1',
    article: '',
    name: 'Dell monitor',
    serialNumber: 'SN-1',
  },
  lineItems: [
    {
      id: 'line-part',
      kind: 'product',
      name: 'Power board',
      price: 125,
      quantity: 2,
      warrantyPeriod: 0,
      serialNumbers: ['  S000111  '],
    },
    {
      id: 'line-service',
      kind: 'service',
      name: 'BIOS flash',
      price: 400,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
});

const bundledSale = historySale({
  id: 'sale-bundle',
  recordNumber: 's000540',
  kind: 'sale',
  status: 'issued',
  lineItems: [
    {
      id: 'line-case',
      kind: 'product',
      name: 'Phone case',
      price: 400,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: ['S000533'],
    },
    {
      id: 'line-cable',
      kind: 'product',
      name: 'Cable',
      price: 80,
      quantity: 2,
      warrantyPeriod: 0,
      serialNumbers: ['S000900'],
    },
  ],
});

describe('ClientCardModal history details', () => {
  it('keeps several rows open through search, filter, and pagination, and resets on client or tab change', () => {
    const second = historySale({
      ...repairSale,
      id: 'sale-repair-2',
      recordNumber: 'r000772',
      status: 'new',
    });
    const pageRows = [
      repairSale,
      second,
      ...Array.from({ length: 9 }, (_, index) =>
        historySale({
          id: `sale-page-${index}`,
          recordNumber: `r0009${index}`,
          kind: 'repair',
          status: 'paid',
          product: {
            id: `device-page-${index}`,
            article: '',
            name: `Paged device ${index}`,
            serialNumber: '',
          },
        }),
      ),
    ];
    const view = renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: pageRows,
    });

    fireEvent.click(toggleFor('r000770'));
    fireEvent.click(toggleFor('r000772'));
    expect(toggleFor('r000770')).toHaveAttribute('aria-expanded', 'true');
    expect(toggleFor('r000772')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.change(
      screen.getByPlaceholderText('Search by number, device, serial, status'),
      { target: { value: 'r000770' } },
    );
    expect(
      screen.queryByRole('button', { name: 'Toggle contents of r000772' }),
    ).toBeNull();
    fireEvent.change(
      screen.getByPlaceholderText('Search by number, device, serial, status'),
      { target: { value: '' } },
    );
    expect(toggleFor('r000770')).toHaveAttribute('aria-expanded', 'true');
    expect(toggleFor('r000772')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'paid' },
    });
    expect(
      screen.queryByRole('button', { name: 'Toggle contents of r000772' }),
    ).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'all' },
    });
    expect(toggleFor('r000772')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(
      screen.queryByRole('button', { name: 'Toggle contents of r000770' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(toggleFor('r000770')).toHaveAttribute('aria-expanded', 'true');

    view.rerender(
      <ClientCardModal
        activeHistoryRows={pageRows}
        clientCardTab='sales'
        historyClient={client}
        isHistoryLoading={false}
        isSaving={false}
        mainTabForm={mainTabForm}
        mainTabPhoneError={null}
        selectedClient={client}
        selectedClientId={client.id}
        clientVisitCount={1}
        onClose={vi.fn()}
        onMainTabFormChange={vi.fn()}
        onSaveMainTab={vi.fn()}
        onTabChange={vi.fn()}
        onValidatePhone={() => true}
        onClearPhoneError={vi.fn()}
        clientDevices={[]}
        onUpdateClientDevice={vi.fn(async () => true)}
        onDeleteClientDevice={vi.fn(async () => true)}
      />,
    );
    view.rerender(
      <ClientCardModal
        activeHistoryRows={pageRows}
        clientCardTab='orders'
        historyClient={client}
        isHistoryLoading={false}
        isSaving={false}
        mainTabForm={mainTabForm}
        mainTabPhoneError={null}
        selectedClient={client}
        selectedClientId={client.id}
        clientVisitCount={1}
        onClose={vi.fn()}
        onMainTabFormChange={vi.fn()}
        onSaveMainTab={vi.fn()}
        onTabChange={vi.fn()}
        onValidatePhone={() => true}
        onClearPhoneError={vi.fn()}
        clientDevices={[]}
        onUpdateClientDevice={vi.fn(async () => true)}
        onDeleteClientDevice={vi.fn(async () => true)}
      />,
    );
    expect(toggleFor('r000770')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleFor('r000770'));
    view.rerender(
      <ClientCardModal
        activeHistoryRows={pageRows}
        clientCardTab='orders'
        historyClient={client}
        isHistoryLoading={false}
        isSaving={false}
        mainTabForm={mainTabForm}
        mainTabPhoneError={null}
        selectedClient={client}
        selectedClientId='client-2'
        clientVisitCount={1}
        onClose={vi.fn()}
        onMainTabFormChange={vi.fn()}
        onSaveMainTab={vi.fn()}
        onTabChange={vi.fn()}
        onValidatePhone={() => true}
        onClearPhoneError={vi.fn()}
        clientDevices={[]}
        onUpdateClientDevice={vi.fn(async () => true)}
        onDeleteClientDevice={vi.fn(async () => true)}
      />,
    );
    expect(toggleFor('r000770')).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows saved order and sale composition and does not invent snapshot rows', () => {
    const emptyRepair = historySale({
      id: 'sale-empty',
      recordNumber: 'r000781',
      kind: 'repair',
      product: {
        id: '',
        article: 'REPAIR',
        name: 'Old radio',
        serialNumber: '',
      },
      lineItems: [],
    });
    const { rerender } = renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [detailedRepair, emptyRepair],
    });

    fireEvent.click(screen.getByText('paid'));
    expect(screen.queryByText('Power board')).toBeNull();

    fireEvent.click(toggleFor('r000780'));
    const details = contentsFor('r000780');
    expect(within(details).getByText('Power board')).toBeVisible();
    expect(within(details).getByText('BIOS flash')).toBeVisible();
    expect(within(details).getByText('2')).toBeVisible();
    expect(within(details).getByRole('button', { name: 'S000111' })).toBeVisible();
    expect(within(details).queryByText(/S\/N:/)).toBeNull();

    fireEvent.click(toggleFor('r000781'));
    const emptyDetails = contentsFor('r000781');
    expect(
      within(emptyDetails).getByText(i18n.t('orders.create.sidePanel.noItems')),
    ).toBeVisible();
    expect(within(emptyDetails).queryByText('Old radio')).toBeNull();
    expect(screen.getByText('Old radio')).toBeVisible();

    rerender(
      <ClientCardModal
        activeHistoryRows={[bundledSale]}
        clientCardTab='sales'
        historyClient={client}
        isHistoryLoading={false}
        isSaving={false}
        mainTabForm={mainTabForm}
        mainTabPhoneError={null}
        selectedClient={client}
        selectedClientId={client.id}
        clientVisitCount={1}
        onClose={vi.fn()}
        onMainTabFormChange={vi.fn()}
        onSaveMainTab={vi.fn()}
        onTabChange={vi.fn()}
        onValidatePhone={() => true}
        onClearPhoneError={vi.fn()}
        clientDevices={[]}
        onUpdateClientDevice={vi.fn(async () => true)}
        onDeleteClientDevice={vi.fn(async () => true)}
      />,
    );
    fireEvent.click(toggleFor('s000540'));
    const saleDetails = contentsFor('s000540');
    expect(within(saleDetails).getByText('Phone case')).toBeVisible();
    expect(within(saleDetails).getByText('Cable')).toBeVisible();
    expect(within(saleDetails).queryByRole('heading', { name: 'Services' })).toBeNull();
  });

  it('opens only from the number and copies the device name or each sale name', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeOrderTab());
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    const { rerender } = renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [detailedRepair],
    });

    fireEvent.click(screen.getByText('paid'));
    fireEvent.click(screen.getByText('Dell monitor'));
    expect(openSpy).not.toHaveBeenCalled();

    const deviceCopy = within(
      screen.getByText('Dell monitor').closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(deviceCopy);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('Dell monitor');
    });
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: 'r000780' }));
    expect(openSpy).toHaveBeenCalledWith(
      getOrderLink(detailedRepair.id, 'repair'),
      '_blank',
    );

    rerender(
      <ClientCardModal
        activeHistoryRows={[bundledSale]}
        clientCardTab='sales'
        historyClient={client}
        isHistoryLoading={false}
        isSaving={false}
        mainTabForm={mainTabForm}
        mainTabPhoneError={null}
        selectedClient={client}
        selectedClientId={client.id}
        clientVisitCount={1}
        onClose={vi.fn()}
        onMainTabFormChange={vi.fn()}
        onSaveMainTab={vi.fn()}
        onTabChange={vi.fn()}
        onValidatePhone={() => true}
        onClearPhoneError={vi.fn()}
        clientDevices={[]}
        onUpdateClientDevice={vi.fn(async () => true)}
        onDeleteClientDevice={vi.fn(async () => true)}
      />,
    );
    expect(document.querySelector('.clients-history-sale-line')).toHaveTextContent(
      'Phone case x1, Cable x2',
    );
    const caseCopy = within(
      screen.getByText('Phone case x1').closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(caseCopy);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('Phone case');
    });
    const cableCopy = within(
      screen.getByText('Cable x2').closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(cableCopy);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('Cable');
    });
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('opens the product model from row and expanded serials without opening it from the copy icon', async () => {
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [detailedRepair],
    });

    const rowSerial = screen.getByRole('button', { name: 'S/N: SN-1' });
    const rowCopy = within(
      rowSerial.closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(rowCopy);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('SN-1');
    });
    expect(screen.queryByRole('dialog', { name: 'Dell monitor' })).toBeNull();

    fireEvent.click(rowSerial);
    expect(screen.getByRole('dialog', { name: 'Dell monitor' })).toBeVisible();
    expect(
      screen.getByText('Purchase information is unavailable for this serial number.'),
    ).toBeVisible();

    fireEvent.click(toggleFor('r000780'));
    const expandedSerial = within(contentsFor('r000780')).getByRole('button', {
      name: 'S000111',
    });
    const expandedCopy = within(
      expandedSerial.closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(expandedCopy);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('S000111');
    });
    expect(screen.queryByRole('dialog', { name: 'Power board' })).toBeNull();

    fireEvent.click(expandedSerial);
    const partDialog = screen.getByRole('dialog', { name: 'Power board' });
    expect(
      within(partDialog).getByText(
        'Purchase information is unavailable for this serial number.',
      ),
    ).toBeVisible();
  });

  it('binds each sales serial to its product line', () => {
    renderCard({
      clientCardTab: 'sales',
      activeHistoryRows: [bundledSale],
    });

    fireEvent.click(screen.getByRole('button', { name: 'S/N: S000900' }));
    expect(screen.getByRole('dialog', { name: 'Cable' })).toBeVisible();
    expect(
      screen.getByText('Purchase information is unavailable for this serial number.'),
    ).toBeVisible();
  });
});

