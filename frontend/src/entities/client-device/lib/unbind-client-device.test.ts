import { describe, expect, it, vi } from 'vitest';
import type { ClientDevice } from '../model/types';
import {
  buildUnbindClientDevicePayload,
  filterActiveClientDevicesForClient,
  getUnbindClientDeviceAction,
  unbindClientDevice,
} from './unbind-client-device';

const device = (patch: Partial<ClientDevice> = {}): ClientDevice => ({
  id: 'device-1',
  clientId: 'client-1',
  clientName: 'Client',
  clientPhone: '+380501111111',
  name: 'Coffee machine',
  serialNumber: '',
  note: 'Kitchen',
  source: 'repairOrder',
  isActive: true,
  canRemove: true,
  usageCount: 0,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  ...patch,
});

describe('unbind-client-device helpers', () => {
  it('returns delete when device can be removed', () => {
    expect(getUnbindClientDeviceAction(device())).toBe('delete');
  });

  it('returns deactivate when device is used in orders', () => {
    expect(
      getUnbindClientDeviceAction(device({ canRemove: false, usageCount: 2 })),
    ).toBe('deactivate');
  });

  it('builds deactivate payload with optimistic concurrency', () => {
    expect(buildUnbindClientDevicePayload(device())).toEqual({
      clientId: 'client-1',
      clientName: 'Client',
      clientPhone: '+380501111111',
      name: 'Coffee machine',
      serialNumber: '',
      note: 'Kitchen',
      source: 'repairOrder',
      isActive: false,
      expectedUpdatedAt: '2026-01-02T10:00:00.000Z',
    });
  });

  it('filters active devices for one client and deduplicates by name', () => {
    const devices = [
      device({ id: 'device-1', name: 'Phone' }),
      device({ id: 'device-2', name: 'phone' }),
      device({ id: 'device-3', clientId: 'client-2', name: 'Other client phone' }),
      device({ id: 'device-4', name: 'Inactive', isActive: false }),
    ];

    expect(filterActiveClientDevicesForClient(devices, 'client-1')).toEqual([
      devices[0],
    ]);
  });

  it('deletes removable devices through unbind helper', async () => {
    const onDelete = vi.fn(async () => true);
    const onUpdate = vi.fn(async () => true);

    await expect(
      unbindClientDevice(device(), { onDelete, onUpdate }),
    ).resolves.toBe(true);
    expect(onDelete).toHaveBeenCalledWith('device-1');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('deactivates used devices through unbind helper', async () => {
    const onDelete = vi.fn(async () => true);
    const onUpdate = vi.fn(async () => true);

    await expect(
      unbindClientDevice(device({ canRemove: false }), {
        onDelete,
        onUpdate,
      }),
    ).resolves.toBe(true);
    expect(onUpdate).toHaveBeenCalledWith(
      'device-1',
      buildUnbindClientDevicePayload(device({ canRemove: false })),
    );
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('skips inactive devices', async () => {
    const onDelete = vi.fn(async () => true);
    const onUpdate = vi.fn(async () => true);

    await expect(
      unbindClientDevice(device({ isActive: false }), {
        onDelete,
        onUpdate,
      }),
    ).resolves.toBe(false);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});