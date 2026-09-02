import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../../../../entities/client/model/types';
import * as clipboard from '../../../../shared/lib/clipboard';
import { ClientsTable } from './ClientsTable';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const client: Client = {
  id: 'client-abc123',
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

describe('ClientsTable', () => {
  it('opens the client card from the row, but not from the phone link', () => {
    const onOpenClientCard = vi.fn();

    render(
      <ClientsTable
        filteredClientsCount={1}
        isLoading={false}
        clients={[client]}
        selectedClientId={null}
        statsByClient={new Map()}
        onDeleteClient={vi.fn()}
        onOpenClientCard={onOpenClientCard}
      />,
    );

    fireEvent.click(screen.getByRole('link'));
    expect(onOpenClientCard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Ivan Petrenko'));
    expect(onOpenClientCard).toHaveBeenCalledWith('client-abc123');
  });

  it('copies name and phone from the hover icon without opening the card', async () => {
    const onOpenClientCard = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    render(
      <ClientsTable
        filteredClientsCount={1}
        isLoading={false}
        clients={[client]}
        selectedClientId={null}
        statsByClient={new Map()}
        onDeleteClient={vi.fn()}
        onOpenClientCard={onOpenClientCard}
      />,
    );

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    expect(copyButtons).toHaveLength(2);

    fireEvent.click(copyButtons[0]);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('Ivan Petrenko');
    });

    fireEvent.click(copyButtons[1]);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('+380501111111');
    });
    expect(onOpenClientCard).not.toHaveBeenCalled();
  });
});