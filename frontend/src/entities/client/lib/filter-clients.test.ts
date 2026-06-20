import { describe, expect, it } from 'vitest';
import type { Client } from '../model/types';
import { filterClientsByQuery } from './filter-clients';

const client = (patch: Partial<Client> & Pick<Client, 'id' | 'name' | 'phone'>): Client => ({
  phones: [patch.phone],
  email: '',
  address: '',
  registrationId: '',
  iban: '',
  note: '',
  status: 'new',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('filterClientsByQuery', () => {
  it('finds clients by additional phone', () => {
    const clients = [
      client({
        id: 'client-1',
        name: 'Ivan',
        phone: '+380671112233',
        phones: ['+380671112233', '+380502223344'],
      }),
    ];

    expect(filterClientsByQuery(clients, '0502223344')).toHaveLength(1);
    expect(filterClientsByQuery(clients, 'Anna')).toHaveLength(0);
  });
});