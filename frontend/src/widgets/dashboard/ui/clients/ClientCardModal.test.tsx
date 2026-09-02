import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clipboard from '../../../../shared/lib/clipboard';
import type { Client } from '../../../../entities/client/model/types';
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
});
