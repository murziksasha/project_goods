import { beforeEach, describe, expect, it, vi } from 'vitest';

const duplicatePhoneMessage = 'Client phone already exists.';

const setupClientService = async ({
  existingClientId,
}: {
  existingClientId?: string | null;
} = {}) => {
  const findOneLeanMock = vi.fn().mockResolvedValue(
    existingClientId
      ? { _id: { toString: () => existingClientId }, phone: '+380635567090', phones: ['+380635567090'] }
      : null,
  );
  const findOneMock = vi.fn((q: any) => ({ lean: findOneLeanMock }));
  const findByIdAndUpdateLeanMock = vi.fn().mockResolvedValue(null);
  const findByIdAndUpdateMock = vi.fn(() => ({
    lean: findByIdAndUpdateLeanMock,
  }));
  const validateMock = vi.fn().mockResolvedValue(undefined);
  const saveMock = vi.fn().mockResolvedValue(undefined);

  class FakeClient {
    static findOne = findOneMock;
    static findByIdAndUpdate = findByIdAndUpdateMock;
    static find = vi.fn();
    static findById = vi.fn();
    static findByIdAndDelete = vi.fn();
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

  vi.doMock('./model', () => ({
    Client: FakeClient,
  }));
  vi.doMock('../sale/model', () => ({
    Sale: {
      updateMany: vi.fn(),
      exists: vi.fn(),
      find: vi.fn(),
      countDocuments: vi.fn().mockResolvedValue(0),
    },
  }));

  const service = await import('./service');
  return {
    service,
    findOneMock,
    findByIdAndUpdateMock,
    validateMock,
    saveMock,
  };
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('client service', () => {
  it('rejects creating a client when normalized phone already exists', async () => {
    const { service, findOneMock, validateMock, saveMock } =
      await setupClientService({
        existingClientId: '507f1f77bcf86cd799439012',
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

    // our impl queries $or for phones/identities, check it was invoked
    expect(findOneMock).toHaveBeenCalled();
    const callArg = findOneMock.mock.calls[0]?.[0];
    expect(callArg && (callArg.$or || callArg.phone || callArg.phoneIdentities)).toBeTruthy();
    expect(validateMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('rejects updating a client to another client normalized phone', async () => {
    const { service, findOneMock, findByIdAndUpdateMock } =
      await setupClientService({
        existingClientId: '507f1f77bcf86cd799439012',
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
    const { service } = await setupClientService({ existingClientId: 'other-id' });
    await expect(
      service.createClient({
        phone: '+380991112233',
        phones: ['+380991112233', '0635567090'],
        name: 'Dup Add',
      }),
    ).rejects.toThrow(duplicatePhoneMessage);
  });

  it('allows updating a client own phones without duplicate errors', async () => {
    const findOneLeanMock = vi.fn().mockResolvedValue(null);
    const findOneMock = vi.fn(() => ({ lean: findOneLeanMock }));
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
    const findByIdAndUpdateLeanMock = vi.fn().mockResolvedValue(updatedClient);
    const findByIdAndUpdateMock = vi.fn(() => ({
      lean: findByIdAndUpdateLeanMock,
    }));

    class FakeClient {
      static findOne = findOneMock;
      static findByIdAndUpdate = findByIdAndUpdateMock;
      static find = vi.fn();
      static findById = vi.fn();
      static findByIdAndDelete = vi.fn();
      static exists = vi.fn();
    }

    vi.doMock('./model', () => ({ Client: FakeClient }));
    vi.doMock('../sale/model', () => ({
      Sale: {
        updateMany: vi.fn(),
        exists: vi.fn(),
        find: vi.fn(),
        countDocuments: vi.fn().mockResolvedValue(0),
      },
    }));

    const service = await import('./service');
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
    const { service, findByIdAndUpdateMock } = await setupClientService({
      existingClientId: '507f1f77bcf86cd799439012',
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
    const findOneLeanMock = vi.fn().mockResolvedValue(null);
    const findOneMock = vi.fn(() => ({ lean: findOneLeanMock }));
    const findByIdLeanMock = vi
      .fn()
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
    const findByIdMock = vi.fn(() => ({ lean: findByIdLeanMock }));
    const findByIdAndDeleteLeanMock = vi.fn().mockResolvedValue({
      _id: { toString: () => sourceId },
      phone: '+380978128020',
    });
    const findByIdAndDeleteMock = vi.fn(() => ({
      lean: findByIdAndDeleteLeanMock,
    }));
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
    const findByIdAndUpdateLeanMock = vi.fn().mockResolvedValue(updatedTarget);
    const findByIdAndUpdateMock = vi.fn(() => ({
      lean: findByIdAndUpdateLeanMock,
    }));
    const updateManyMock = vi.fn().mockResolvedValue({ modifiedCount: 2 });

    class FakeClient {
      static findOne = findOneMock;
      static findById = findByIdMock;
      static findByIdAndUpdate = findByIdAndUpdateMock;
      static findByIdAndDelete = findByIdAndDeleteMock;
      static find = vi.fn();
      static exists = vi.fn();
    }

    vi.doMock('./model', () => ({ Client: FakeClient }));
    vi.doMock('../sale/model', () => ({
      Sale: {
        updateMany: updateManyMock,
        exists: vi.fn(),
        find: vi.fn(),
        countDocuments: vi.fn().mockResolvedValue(0),
      },
    }));

    const service = await import('./service');
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
