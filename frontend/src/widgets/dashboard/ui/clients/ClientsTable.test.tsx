import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../../../../entities/client/model/types';
import { ClientsTable } from './ClientsTable';

afterEach(() => {
  cleanup();
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
  it('opens the client card from the name cell only', () => {
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

    fireEvent.click(screen.getByText('+380501111111'));
    expect(onOpenClientCard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Ivan Petrenko'));
    expect(onOpenClientCard).toHaveBeenCalledWith('client-abc123');
  });
});