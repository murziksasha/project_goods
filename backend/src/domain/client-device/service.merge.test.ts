import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Sale } from '../sale/model';
import { ClientDevice } from './model';
import { mergeClientDevices } from './service';

const clientId1 = '507f1f77bcf86cd799439011';
const clientId2 = '507f1f77bcf86cd799439022';
const targetDeviceId = '507f1f77bcf86cd799439033';
const sourceDeviceId = '507f1f77bcf86cd799439044';

const createMockDevice = (
  id: string,
  name: string,
  clientId: string | null,
  note = '',
) => ({
  _id: id,
  client: clientId,
  clientName: clientId ? 'Test Client' : '',
  clientPhone: clientId ? '+380501112233' : '',
  name,
  nameKey: name.toLowerCase(),
  serialNumber: 'SN-001',
  note,
  source: 'repairOrder',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  const salesFindLean = vi.fn().mockResolvedValue([]);
  vi.spyOn(Sale, 'find').mockReturnValue({
    lean: salesFindLean,
  } as never);
});

describe('mergeClientDevices', () => {
  it('rejects missing or invalid IDs', async () => {
    await expect(
      mergeClientDevices('', sourceDeviceId),
    ).rejects.toThrow(
      'Both targetDeviceId and sourceDeviceId are required.',
    );
    await expect(
      mergeClientDevices(targetDeviceId, targetDeviceId),
    ).rejects.toThrow('Select two different client devices.');
    await expect(
      mergeClientDevices('invalid-id', sourceDeviceId),
    ).rejects.toThrow('Valid targetDeviceId is required.');
  });

  it('rejects when target or source does not exist', async () => {
    vi.spyOn(ClientDevice, 'findById').mockImplementation(((
      id: string,
    ) => {
      if (id === targetDeviceId) {
        return leanResult(
          createMockDevice(targetDeviceId, 'iPhone 13', clientId1),
        );
      }
      return leanResult(null);
    }) as never);

    await expect(
      mergeClientDevices(targetDeviceId, sourceDeviceId),
    ).rejects.toThrow('Source client device not found.');
  });

  it('allows cross-client merges, relinking sales, preserving device continuity for source client, and deleting source', async () => {
    const target = createMockDevice(
      targetDeviceId,
      'iPhone 13',
      clientId1,
      'Target note',
    );
    const source = createMockDevice(
      sourceDeviceId,
      'iphone 13',
      clientId2,
      'Source note',
    );

    vi.spyOn(ClientDevice, 'findById').mockImplementation(((
      id: string,
    ) => {
      if (id === targetDeviceId) {
        return leanResult(target);
      }
      if (id === sourceDeviceId) {
        return leanResult(source);
      }
      return leanResult(null);
    }) as never);

    vi.spyOn(ClientDevice, 'exists').mockResolvedValue(
      false as never,
    );
    const saveSpy = vi
      .spyOn(ClientDevice.prototype, 'save')
      .mockResolvedValue({} as never);

    const matchingSale = {
      _id: 'sale-2',
      client: clientId2,
      kind: 'repair',
      productSnapshot: {
        article: 'ART-2',
        name: 'iphone 13',
        serialNumber: 'SN-001',
      },
      lineItems: [],
    };
    vi.spyOn(Sale, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([matchingSale]),
    } as never);
    const saleFindByIdAndUpdate = vi
      .spyOn(Sale, 'findByIdAndUpdate')
      .mockResolvedValue({} as never);

    vi.spyOn(ClientDevice, 'findByIdAndUpdate').mockImplementation(((
      id: string,
      update: any,
    ) =>
      leanResult({
        ...target,
        ...update,
      })) as never);
    const sourceFindByIdAndDelete = vi
      .spyOn(ClientDevice, 'findByIdAndDelete')
      .mockReturnValue(leanResult(source) as never);

    const result = await mergeClientDevices(
      targetDeviceId,
      sourceDeviceId,
      'Draft note',
    );

    expect(result.device.name).toBe('iPhone 13');
    expect(result.removedDeviceId).toBe(sourceDeviceId);
    expect(result.relinkedSalesCount).toBe(1);
    expect(result.movedSalesCount).toBe(1);
    expect(saveSpy).toHaveBeenCalled();
    expect(saleFindByIdAndUpdate).toHaveBeenCalledWith(
      'sale-2',
      expect.objectContaining({
        productSnapshot: expect.objectContaining({
          name: 'iPhone 13',
        }),
      }),
      expect.anything(),
    );
    expect(sourceFindByIdAndDelete).toHaveBeenCalledWith(
      sourceDeviceId,
      expect.anything(),
    );
  });

  it('allows merging unassigned source device (client: null) into client-assigned target device', async () => {
    const target = createMockDevice(
      targetDeviceId,
      'iPhone 13',
      clientId1,
      'Target note',
    );
    const source = createMockDevice(
      sourceDeviceId,
      'iphone 13',
      null,
      'Source note',
    );

    vi.spyOn(ClientDevice, 'findById').mockImplementation(((
      id: string,
    ) => {
      if (id === targetDeviceId) return leanResult(target);
      if (id === sourceDeviceId) return leanResult(source);
      return leanResult(null);
    }) as never);

    vi.spyOn(ClientDevice, 'findByIdAndUpdate').mockImplementation(((
      id: string,
      update: any,
    ) =>
      leanResult({
        ...target,
        ...update,
      })) as never);
    vi.spyOn(ClientDevice, 'findByIdAndDelete').mockReturnValue(
      leanResult(source) as never,
    );

    const result = await mergeClientDevices(
      targetDeviceId,
      sourceDeviceId,
    );

    expect(result.device.name).toBe('iPhone 13');
    expect(result.removedDeviceId).toBe(sourceDeviceId);
    expect(result.movedSalesCount).toBe(0);
  });

  it('merges devices belonging to the same client, consolidates notes, relinks sales, and deletes source', async () => {
    const target = createMockDevice(
      targetDeviceId,
      'iPhone 13',
      clientId1,
      'Target note',
    );
    const source = createMockDevice(
      sourceDeviceId,
      'iphone 13',
      clientId1,
      'Source note',
    );

    vi.spyOn(ClientDevice, 'findById').mockImplementation(((
      id: string,
    ) => {
      if (id === targetDeviceId) return leanResult(target);
      if (id === sourceDeviceId) return leanResult(source);
      return leanResult(null);
    }) as never);

    const matchingSale = {
      _id: 'sale-1',
      client: clientId1,
      kind: 'repair',
      productSnapshot: {
        article: 'ART-1',
        name: 'iphone 13',
        serialNumber: 'SN-HISTORICAL',
      },
      lineItems: [
        {
          id: 'line-1',
          kind: 'product',
          name: 'iphone 13',
          price: 1500,
          quantity: 1,
        },
      ],
    };

    const salesFindLean = vi.fn().mockResolvedValue([matchingSale]);
    vi.spyOn(Sale, 'find').mockReturnValue({
      lean: salesFindLean,
    } as never);

    const saleFindByIdAndUpdate = vi
      .spyOn(Sale, 'findByIdAndUpdate')
      .mockResolvedValue({} as never);
    const targetFindByIdAndUpdate = vi
      .spyOn(ClientDevice, 'findByIdAndUpdate')
      .mockImplementation(((id: string, update: any) =>
        leanResult({
          ...target,
          ...update,
        })) as never);
    const sourceFindByIdAndDelete = vi
      .spyOn(ClientDevice, 'findByIdAndDelete')
      .mockReturnValue(leanResult(source) as never);

    const result = await mergeClientDevices(
      targetDeviceId,
      sourceDeviceId,
      'Draft note',
    );

    expect(targetFindByIdAndUpdate).toHaveBeenCalledWith(
      targetDeviceId,
      { note: 'Target note\nSource note\nDraft note' },
      expect.anything(),
    );

    expect(saleFindByIdAndUpdate).toHaveBeenCalledWith(
      'sale-1',
      {
        productSnapshot: {
          article: 'ART-1',
          name: 'iPhone 13',
          serialNumber: 'SN-HISTORICAL',
        },
        lineItems: [
          {
            id: 'line-1',
            kind: 'product',
            name: 'iPhone 13',
            price: 1500,
            quantity: 1,
          },
        ],
      },
      expect.anything(),
    );

    expect(sourceFindByIdAndDelete).toHaveBeenCalledWith(
      sourceDeviceId,
      expect.anything(),
    );
    expect(result.removedDeviceId).toBe(sourceDeviceId);
    expect(result.relinkedSalesCount).toBe(1);
    expect(result.device.name).toBe('iPhone 13');
  });

  it('allows merging unassigned devices (client: null)', async () => {
    const target = createMockDevice(
      targetDeviceId,
      'iPad Pro',
      null,
      'Target note',
    );
    const source = createMockDevice(
      sourceDeviceId,
      'ipad pro',
      null,
      'Source note',
    );

    vi.spyOn(ClientDevice, 'findById').mockImplementation(((
      id: string,
    ) => {
      if (id === targetDeviceId) return leanResult(target);
      if (id === sourceDeviceId) return leanResult(source);
      return leanResult(null);
    }) as never);

    vi.spyOn(ClientDevice, 'findByIdAndUpdate').mockImplementation(((
      id: string,
      update: any,
    ) =>
      leanResult({
        ...target,
        ...update,
      })) as never);
    vi.spyOn(ClientDevice, 'findByIdAndDelete').mockReturnValue(
      leanResult(source) as never,
    );

    const result = await mergeClientDevices(
      targetDeviceId,
      sourceDeviceId,
    );

    expect(result.device.name).toBe('iPad Pro');
    expect(result.removedDeviceId).toBe(sourceDeviceId);
    expect(result.relinkedSalesCount).toBe(0);
  });
});
