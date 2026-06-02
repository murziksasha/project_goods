import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../../../entities/client/model/types';
import { ClientsWorkspace } from './ClientsWorkspace';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const renderWorkspace = (clients: Client[] = []) =>
  render(
    <ClientsWorkspace
      clients={clients}
      sales={[]}
      selectedClientId={null}
      history={null}
      isClientsLoading={false}
      isHistoryLoading={false}
      isSaving={false}
      onSelectClient={vi.fn()}
      onDeleteClient={vi.fn()}
      onCreateClient={vi.fn().mockResolvedValue(true)}
      onMergeClients={vi.fn().mockResolvedValue(true)}
      onUpdateClient={vi.fn().mockResolvedValue(true)}
      onOpenSaleCard={vi.fn()}
    />,
  );

describe('ClientsWorkspace', () => {
  it('uses one create-client form without person/company tabs', () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Створити клієнта' }));

    expect(screen.queryByRole('button', { name: 'Фіз. ос.' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Юр. ос.' })).not.toBeInTheDocument();
    expect(screen.getByText('ЄДРПОУ або ІПН')).toBeInTheDocument();
    expect(screen.getByText('IBAN')).toBeInTheDocument();
  });

  it('blocks create while client requisites are invalid', () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Створити клієнта' }));
    fireEvent.change(screen.getByLabelText('ПІБ'), {
      target: { value: 'Ivan Petrenko' },
    });
    fireEvent.change(screen.getByLabelText('IBAN'), {
      target: { value: 'bad-iban' },
    });

    expect(screen.getByRole('button', { name: 'Додати' })).toBeDisabled();
  });
});
