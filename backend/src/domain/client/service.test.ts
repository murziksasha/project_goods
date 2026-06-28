import { beforeEach, describe, expect, it, vi } from 'vitest';

const duplicatePhoneMessage = 'Client phone already exists.';

const {
  findOneLeanMock,
  findOneMock,
  findByIdLeanMock,
  findByIdMock,
  findByIdAndUpdateLeanMock,
  findByIdAndUpdateMock,
  findByIdAndDeleteLeanMock,
  findByIdAndDeleteMock,
  validateMock,
  saveMock,
  updateManyMock,
  countDocumentsMock,
  FakeClient,
} = vi.hoisted(() => {
  const findOneLeanMock = vi.fn();
  const findOneMock = vi.fn(() => ({ lean: findOneLeanMock }));
  const findByIdLeanMock = vi.fn();
  const findByIdMock = vi.fn(() => ({ lean: findByIdLeanMock }));
  const findByIdAndUpdateLeanMock = vi.fn();
  const findByIdAndUpdateMock = vi.fn(() => ({
    lean: findByIdAndUpdateLeanMock,
  }));
  const findByIdAndDeleteLeanMock = vi.fn();
  const findByIdAndDeleteMock = vi.fn(() => ({
    lean: findByIdAndDeleteLeanMock,
  }));
  const validateMock = vi.fn();
  const saveMock = vi.fn();
  const updateManyMock = vi.fn();
  const countDocumentsMock = vi.fn();

  class FakeClient {
    static findOne = findOneMock;
    static findById = findByIdMock;
    static findByIdAndUpdate = findByIdAndUpdateMock;
    static findByIdAndDelete = findByIdAndDeleteMock;
    static find = vi.fn();
    static exists = vi.fn();

    validate = validateMock;
    save = saveMock;

    constructor(input: Record<string, unknown>) {
      Object.assign(this, input);
    }

    toObject() {
      return {
        _id: { toString: () => 'created-client-id' },
        phone: '+380635567090',
        phones: ['+380635567090'],
        name: 'Created Client',
        email: '',
        address: '',
        registrationId: '',
        iban: '',
        note: '',
        status: 'new',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      };
    }
  }

  return {
    findOneLeanMock,
    findOneMock,
    findByIdLeanMock,
    findByIdMock,
    findByIdAndUpdateLeanMock,
    findByIdAndUpdateMock,
    findByIdAndDeleteLeanMock,
    findByIdAndDeleteMock,
    validateMock,
    saveMock,
    updateManyMock,
    countDocumentsMock,
    FakeClient,
  };
});

vi.mock('./model', () => ({
  Client: FakeClient,
}));

vi.mock('../sale/model', () => ({
  Sale: {
    updateMany: updateManyMock,
    exists: vi.fn(),
    find: vi.fn(),
    countDocuments: countDocumentsMock,
  },
}));

import * as service from './service';

beforeEach(() => {
  vi.clearAllMocks();
  findOneLeanMock.mockResolvedValue(null);
  findByIdLeanMock.mockResolvedValue(null);
  findByIdAndUpdateLeanMock.mockResolvedValue(null);
  findByIdAndDeleteLeanMock.mockResolvedValue(null);
  validateMock.mockResolvedValue(undefined);
  saveMock.mockResolvedValue(undefined);
  updateManyMock.mockResolvedValue({ modifiedCount: 0 });
  countDocumentsMock.mockResolvedValue(0);
});

describe('client service', () => {
  it('rejects creating a client when normalized phone already exists', async () => {
    findOneLeanMock.mockResolvedValue({
      _id: { toString: () => '507f1f77bcf86cd799439012' },
      phone: '+380635567090',
      phones: ['+380635567090'],
    });

    await expect(
      service.createClient({
        phone: '063 556 70 90',
        name: 'Another Client',
        email: '',
        address: '',
        registrationId: '',
        iban: '',
        note: '',
        status: 'new',
      }),
    ).rejects.toThrow(duplicatePhoneMessage);

    expect(findOneMock).toHaveBeenCalled();
    const callArg = findOneMock.mock.calls[0]?.[0];
    expect(callArg && (callArg.$or || callArg.phone || callArg.phoneIdentities)).toBeTruthy();
    expect(validateMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('rejects updating a client to another client normalized phone', async () => {
    findOneLeanMock.mockResolvedValue({
      _id: { toString: () => '507f1f77bcf86cd799439012' },
      phone: '+380635567090',
      phones: ['+380635567090'],
    });

    await expect(
      service.updateClient('507f1f77bcf86cd799439011', {
        phone: '063 556 70 90',
        name: 'Updated Client',
        email: '',
        address: '',
        registrationId: '',
        iban: '',
        note: '',
        status: 'new',
      }),
    ).rejects.toThrow(duplicatePhoneMessage);

    expect(findOneMock).toHaveBeenCalled();
    expect(findByIdAndUpdateMock).not.toHaveBeenCalled();
  });

  it('blocks create when any of the additional phones is already used', async () => {
    findOneLeanMock.mockResolvedValue({
      _id: { toString: () => 'other-id' },
      phone: '+380635567090',
      phones: ['+380635567090'],
    });

    await expect(
      service.createClient({
        phone: '+380991112233',
        phones: ['+380991112233', '0635567090'],
        name: 'Dup Add',
      }),
    ).rejects.toThrow(duplicatePhoneMessage);
  });

  it('allows updating a client own phones without duplicate errors', async () => {
    findOneLeanMock.mockResolvedValue(null);
    const updatedClient = {
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      phone: '+380635567090',
      phones: ['+380635567090', '+380501112233'],
      name: 'Updated Client',
      email: '',
      address: '',
      registrationId: '',
      iban: '',
      note: '',
      status: 'new',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    findByIdAndUpdateLeanMock.mockResolvedValue(updatedClient);

    const result = await service.updateClient('507f1f77bcf86cd799439011', {
      phone: '+380635567090',
      phones: ['+380635567090', '+380501112233'],
      name: 'Updated Client',
      email: '',
      address: '',
      registrationId: '',
      iban: '',
      note: '',
      status: 'new',
    });

    expect(result.phones).toEqual(['+380635567090', '+380501112233']);
    expect(findByIdAndUpdateMock).toHaveBeenCalled();
  });

  it('rejects updating a client to another clients additional phone', async () => {
    findOneLeanMock.mockResolvedValue({
      _id: { toString: () => '507f1f77bcf86cd799439012' },
      phone: '+380635567090',
      phones: ['+380635567090'],
    });

    await expect(
      service.updateClient('507f1f77bcf86cd799439011', {
        phone: '+380991112233',
        phones: ['+380991112233', '+380635567090'],
        name: 'Updated Client',
        email: '',
        address: '',
        registrationId: '',
        iban: '',
        note: '',
        status: 'new',
      }),
    ).rejects.toThrow(duplicatePhoneMessage);

    expect(findByIdAndUpdateMock).not.toHaveBeenCalled();
  });

  it('merges two clients without treating source phone as duplicate', async () => {
    const targetId = '507f1f77bcf86cd799439011';
    const sourceId = '507f1f77bcf86cd799439012';

    findOneLeanMock.mockResolvedValue(null);
    findByIdLeanMock
      .mockResolvedValueOnce({
        _id: { toString: () => targetId },
        phone: '+380635567090',
        phones: ['+380635567090'],
        name: 'Client One',
        email: '',
        address: '',
        registrationId: '',
        iban: '',
        note: '',
        status: 'new',
      })
      .mockResolvedValueOnce({
        _id: { toString: () => sourceId },
        phone: '+380978128020',
        phones: ['+380978128020'],
        name: 'Client Two',
        email: '',
        address: '',
        registrationId: '',
        iban: '',
        note: '',
        status: 'new',
      });
    findByIdAndDeleteLeanMock.mockResolvedValue({
      _id: { toString: () => sourceId },
      phone: '+380978128020',
    });
    const updatedTarget = {
      _id: { toString: () => targetId },
      phone: '+380635567090',
      phones: ['+380635567090', '+380978128020'],
      name: 'Client One',
      email: '',
      address: '',
      registrationId: '',
      iban: '',
      note: '',
      status: 'new',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    findByIdAndUpdateLeanMock.mockResolvedValue(updatedTarget);
    updateManyMock.mockResolvedValue({ modifiedCount: 2 });

    const result = await service.mergeClients(targetId, sourceId);

    expect(findOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $nin: [targetId, sourceId] },
      }),
    );
    expect(findByIdAndDeleteMock).toHaveBeenCalledWith(sourceId);
    expect(findByIdAndUpdateMock).toHaveBeenCalledWith(
      targetId,
      expect.objectContaining({
        phone: '+380635567090',
        phones: ['+380635567090', '+380978128020'],
      }),
      expect.any(Object),
    );
    expect(updateManyMock).toHaveBeenCalled();
    expect(result.client.phones).toEqual(['+380635567090', '+380978128020']);
    expect(result.removedClientId).toBe(sourceId);
  });
});