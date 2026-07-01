import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as errors from '../../shared/lib/errors';
import { leanResult } from '../../test/mongoose-mocks';
import { Sale } from '../sale/model';
import { ClientDevice } from './model';
import { updateClientDevice } from './service';

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
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
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

let linkedSales: any[] = [];

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(errors, 'assertNotStale').mockImplementation(() => undefined);
  vi.spyOn(ClientDevice, 'findById').mockReturnValue(
    leanResult(existingDevice) as never,
  );
  vi.spyOn(ClientDevice, 'exists').mockResolvedValue(null as never);
  vi.spyOn(ClientDevice, 'findByIdAndUpdate').mockReturnValue(
    leanResult(updatedDevice) as never,
  );
  vi.spyOn(Sale, 'find').mockImplementation(
    () => leanResult(linkedSales) as never,
  );
  vi.spyOn(Sale, 'findByIdAndUpdate').mockResolvedValue(null as never);
  vi.spyOn(Sale, 'countDocuments').mockResolvedValue(1 as never);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  linkedSales = [linkedRepairSale];
  installSpies();
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

    expect(Sale.find).toHaveBeenCalledTimes(1);
    expect(Sale.find.mock.calls[0][0]).toEqual({
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
    expect(Sale.findByIdAndUpdate).toHaveBeenCalledWith(linkedSaleId, {
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
    linkedSales = [];

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

    expect(Sale.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});