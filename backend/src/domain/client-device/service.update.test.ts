import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientId = '507f1f77bcf86cd799439011';
const deviceId = '507f1f77bcf86cd799439012';
const linkedSaleId = '507f1f77bcf86cd799439013';
const existingDevice = {
  _id: deviceId,
  client: clientId,
  clientName: 'Client',
  clientPhone: '+380000000000',
  name: 'Wrong name',
  serialNumber: 'SN-OLD',
  note: '',
  source: 'repairOrder',
  isActive: true,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const updatedDevice = {
  ...existingDevice,
  name: 'Correct name',
  serialNumber: 'SN-NEW',
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const linkedRepairSale = {
  _id: linkedSaleId,
  client: clientId,
  kind: 'repair',
  productSnapshot: {
    article: 'REPAIR',
    name: 'Wrong name',
    serialNumber: 'SN-OLD',
  },
  lineItems: [
    {
      id: 'line-1',
      kind: 'product',
      name: 'Wrong name',
      price: 0,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
};

const {
  clientDeviceModel,
  saleModel,
  assertNotStaleMock,
  formatClientDeviceMock,
} = vi.hoisted(() => ({
  clientDeviceModel: {
    findById: vi.fn(),
    exists: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  saleModel: {
    find: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
  },
  assertNotStaleMock: vi.fn(),
  formatClientDeviceMock: vi.fn((device, usageCount = 0) => ({
    id: device._id,
    clientId: device.client?.toString?.() ?? device.client,
    name: device.name,
    serialNumber: device.serialNumber,
    usageCount,
    canRemove: usageCount === 0,
  })),
}));

vi.mock('./model', () => ({
  ClientDevice: clientDeviceModel,
}));

vi.mock('../sale/model', () => ({
  Sale: saleModel,
}));

vi.mock('../../shared/lib/formatters', () => ({
  formatClientDevice: formatClientDeviceMock,
}));

vi.mock('../../shared/lib/query', () => ({
  isValidObjectIdOrThrow: vi.fn(),
}));

vi.mock('../../shared/lib/errors', () => ({
  assertNotStale: assertNotStaleMock,
}));

import { updateClientDevice } from './service';

beforeEach(() => {
  vi.clearAllMocks();
  clientDeviceModel.findById.mockReturnValue({
    lean: vi.fn().mockResolvedValue(existingDevice),
  });
  clientDeviceModel.exists.mockResolvedValue(false);
  clientDeviceModel.findByIdAndUpdate.mockReturnValue({
    lean: vi.fn().mockResolvedValue(updatedDevice),
  });
  saleModel.find.mockReturnValue({
    lean: vi.fn().mockResolvedValue([linkedRepairSale]),
  });
  saleModel.findByIdAndUpdate.mockResolvedValue(null);
  saleModel.countDocuments.mockResolvedValue(1);
});

describe('updateClientDevice repair sale propagation', () => {
  it('updates linked repair sales when a client device name changes', async () => {
    await updateClientDevice(deviceId, {
      clientId,
      clientName: 'Client',
      clientPhone: '+380000000000',
      name: 'Correct name',
      serialNumber: 'SN-NEW',
      note: '',
      source: 'repairOrder',
      isActive: true,
    });

    expect(saleModel.find).toHaveBeenCalledTimes(1);
    expect(saleModel.find.mock.calls[0][0]).toEqual({
      client: clientId,
      kind: 'repair',
      $or: [
        {
          'productSnapshot.name': {
            $regex: '^Wrong\\s+name$',
            $options: 'i',
          },
        },
        {
          'lineItems.name': {
            $regex: '^Wrong\\s+name(?:\\s*\\(.*\\))?$',
            $options: 'i',
          },
        },
        {
          'productSnapshot.serialNumber': 'SN-OLD',
        },
      ],
    });
    expect(saleModel.findByIdAndUpdate).toHaveBeenCalledWith(linkedSaleId, {
      productSnapshot: {
        article: 'REPAIR',
        name: 'Correct name',
        serialNumber: 'SN-NEW',
      },
      lineItems: [
        expect.objectContaining({
          id: 'line-1',
          kind: 'product',
          name: 'Correct name',
        }),
      ],
    });
  });

  it('does not update repair sales that no longer match the previous device name', async () => {
    saleModel.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });

    await updateClientDevice(deviceId, {
      clientId,
      clientName: 'Client',
      clientPhone: '+380000000000',
      name: 'Correct name',
      serialNumber: 'SN-NEW',
      note: '',
      source: 'repairOrder',
      isActive: true,
    });

    expect(saleModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});