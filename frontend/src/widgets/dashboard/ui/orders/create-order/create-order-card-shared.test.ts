import { describe, expect, it } from 'vitest';
import type { ClientDevice } from '../../../../../entities/client-device/model/types';
import {
  filterActiveDevicesByQuery,
  scoreDeviceQueryMatch,
} from './create-order-card-shared';

const device = (patch: Partial<ClientDevice> = {}): ClientDevice => ({
  id: 'device-1',
  clientId: 'client-1',
  clientName: 'Client',
  clientPhone: '+380000000000',
  name: 'Device',
  serialNumber: '',
  note: '',
  source: 'repairOrder',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('filterActiveDevicesByQuery', () => {
  it('does not match devices via polluted clientName', () => {
    const stabilizer = device({
      id: 'stabilizer',
      name: 'Стабілізатор напруги',
      clientName: 'Светлана НВЧ піч Delfa',
    });
    const microwave = device({
      id: 'microwave',
      name: 'НВЧ піч Delfa',
      clientName: 'Светлана',
    });

    const result = filterActiveDevicesByQuery(
      [stabilizer, microwave],
      'НВЧ піч Delfa',
    );

    expect(result.map((item) => item.id)).toEqual(['microwave']);
  });

  it('matches partial device name tokens', () => {
    const coffee = device({
      id: 'coffee',
      name: 'Кавомашина Delonghi',
    });

    expect(filterActiveDevicesByQuery([coffee], 'кавома')).toEqual([coffee]);
  });

  it('matches serial number', () => {
    const laptop = device({
      id: 'laptop',
      name: 'Laptop',
      serialNumber: 'SN-ABC-123',
    });

    expect(filterActiveDevicesByQuery([laptop], 'abc-123')).toEqual([laptop]);
  });

  it('optionally scopes results to clientId when provided', () => {
    const own = device({
      id: 'own',
      clientId: 'client-a',
      name: 'НВЧ піч Delfa',
    });
    const other = device({
      id: 'other',
      clientId: 'client-b',
      name: 'НВЧ піч Delfa Pro',
    });

    // Device #1 create-order path does NOT pass clientId (global Clients goods).
    expect(
      filterActiveDevicesByQuery([own, other], 'НВЧ').map((item) => item.id),
    ).toEqual(['own', 'other']);

    expect(
      filterActiveDevicesByQuery([own, other], 'НВЧ', {
        clientId: 'client-a',
      }).map((item) => item.id),
    ).toEqual(['own']);
  });

  it('matches partial coffee-machine name from Clients goods', () => {
    const coffee = device({
      id: 'coffee',
      clientId: 'client-other',
      name: 'Кавомашина Delonghi',
    });

    expect(filterActiveDevicesByQuery([coffee], 'кавомашина')).toEqual([
      coffee,
    ]);
  });

  it('excludes inactive devices', () => {
    const inactive = device({
      id: 'inactive',
      name: 'НВЧ піч',
      isActive: false,
    });

    expect(filterActiveDevicesByQuery([inactive], 'НВЧ')).toEqual([]);
  });

  it('ranks exact name matches first', () => {
    const exact = device({ id: 'exact', name: 'НВЧ піч Delfa' });
    const partial = device({ id: 'partial', name: 'НВЧ піч Delfa 20L' });

    const result = filterActiveDevicesByQuery([partial, exact], 'НВЧ піч Delfa');

    expect(result.map((item) => item.id)).toEqual(['exact', 'partial']);
    expect(scoreDeviceQueryMatch(exact, 'НВЧ піч Delfa')).toBeLessThan(
      scoreDeviceQueryMatch(partial, 'НВЧ піч Delfa'),
    );
  });
});
