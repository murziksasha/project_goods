import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clipboard from '../../../../shared/lib/clipboard';
import type { Client } from '../../../../entities/client/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import type { ClientMainForm } from '../../model/clients-workspace';
import { ClientCardModal } from './ClientCardModal';

afterEach(() => {
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
      onOpenSaleCard={vi.fn()}
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

  it('shows Device instead of services on Orders and opens in-app on left click', () => {
    const onOpenSaleCard = vi.fn();
    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [repairSale],
      onOpenSaleCard,
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
    expect(numberLink).toHaveAttribute(
      'href',
      expect.stringContaining('page=orders'),
    );
    expect(numberLink).toHaveAttribute(
      'href',
      expect.stringContaining('ordersTab=orders'),
    );
    expect(numberLink).toHaveAttribute(
      'href',
      expect.stringContaining('saleId=sale-repair-1'),
    );

    fireEvent.click(numberLink);
    expect(onOpenSaleCard).toHaveBeenCalledWith(repairSale);
  });

  it('does not open in-app when the order number is Ctrl+clicked', () => {
    const onOpenSaleCard = vi.fn();
    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [repairSale],
      onOpenSaleCard,
    });

    fireEvent.click(screen.getByRole('link', { name: 'r000770' }), {
      ctrlKey: true,
    });
    expect(onOpenSaleCard).not.toHaveBeenCalled();
  });

  it('uses a sales deep link on the Sales tab number', () => {
    const onOpenSaleCard = vi.fn();
    renderCard({
      clientCardTab: 'sales',
      activeHistoryRows: [productSale],
      onOpenSaleCard,
    });

    expect(screen.getByRole('columnheader', { name: 'Sale' })).toBeInTheDocument();
    expect(screen.getByText('Phone case x1')).toBeInTheDocument();

    const numberLink = screen.getByRole('link', { name: 's000533' });
    expect(numberLink).toHaveAttribute(
      'href',
      expect.stringContaining('ordersTab=sales'),
    );
    expect(numberLink).toHaveAttribute(
      'href',
      expect.stringContaining('saleId=sale-sale-1'),
    );

    fireEvent.click(numberLink);
    expect(onOpenSaleCard).toHaveBeenCalledWith(productSale);
  });

  it('copies the history order number from the hover icon without opening the card', async () => {
    const onOpenSaleCard = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [repairSale],
      onOpenSaleCard,
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
    expect(onOpenSaleCard).not.toHaveBeenCalled();
  });

  it('copies history serials from the hover icon without opening the card', async () => {
    const onOpenSaleCard = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    renderCard({
      clientCardTab: 'orders',
      activeHistoryRows: [repairSale],
      onOpenSaleCard,
    });

    const serialCopy = within(
      screen.getByText('S/N: SN-1').closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(serialCopy);

    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('SN-1');
    });
    expect(onOpenSaleCard).not.toHaveBeenCalled();
  });

  it('copies bound sale serials on the Sales tab', async () => {
    const onOpenSaleCard = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    renderCard({
      clientCardTab: 'sales',
      activeHistoryRows: [productSale],
      onOpenSaleCard,
    });

    expect(screen.getByText('S/N: S000533')).toBeInTheDocument();
    const serialCopy = within(
      screen.getByText('S/N: S000533').closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(serialCopy);

    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('S000533');
    });
    expect(onOpenSaleCard).not.toHaveBeenCalled();
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
});

