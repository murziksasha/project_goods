import { describe, expect, it } from 'vitest';
import type { Client } from '../model/types';
import type { Sale } from '../../sale/model/types';
import {
  clientMatchesPhoneQuery,
  formatClientPhonesLabel,
  getSaleClientPhones,
  saleMatchesPhoneQuery,
} from './phone-match';

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

describe('client phone match helpers', () => {
  it('matches clients by additional phone and normalized digits', () => {
    const multiPhoneClient = client({
      id: 'client-1',
      name: 'Ivan',
      phone: '+380671112233',
      phones: ['+380671112233', '+380502223344'],
    });

    expect(clientMatchesPhoneQuery(multiPhoneClient, '0502223344')).toBe(true);
    expect(clientMatchesPhoneQuery(multiPhoneClient, '+380502223344')).toBe(true);
    expect(clientMatchesPhoneQuery(multiPhoneClient, 'Anna')).toBe(false);
  });

  it('formats primary phone with compact additional label', () => {
    expect(
      formatClientPhonesLabel(
        client({
          id: 'client-1',
          name: 'Ivan',
          phone: '+380671112233',
          phones: ['+380671112233', '+380502223344', '+380633334455'],
        }),
      ),
    ).toBe('+380671112233 (+ 2 more)');
  });

  it('matches sale snapshots by additional phones with legacy fallback', () => {
    const saleWithPhones: Sale['client'] = {
      id: 'client-1',
      name: 'Ivan',
      phone: '+380671112233',
      phones: ['+380671112233', '+380502223344'],
      status: 'new',
    };
    const legacySale: Sale['client'] = {
      id: 'client-2',
      name: 'Anna',
      phone: '+380671112233',
      status: 'new',
    };

    expect(getSaleClientPhones({ client: saleWithPhones })).toEqual([
      '+380671112233',
      '+380502223344',
    ]);
    expect(getSaleClientPhones({ client: legacySale })).toEqual(['+380671112233']);
    expect(saleMatchesPhoneQuery({ client: saleWithPhones }, '0502223344')).toBe(true);
    expect(saleMatchesPhoneQuery({ client: legacySale }, '0502223344')).toBe(false);
    expect(saleMatchesPhoneQuery({ client: legacySale }, '671112233')).toBe(true);
  });
});