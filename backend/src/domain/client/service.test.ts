import { beforeEach, describe, expect, it, vi } from 'vitest';

const duplicatePhoneMessage = 'Client phone already exists.';

const setupClientService = async ({
  existingClientId,
}: {
  existingClientId?: string | null;
} = {}) => {
  const findOneLeanMock = vi.fn().mockResolvedValue(
    existingClientId
      ? { _id: { toString: () => existingClientId } }
      : null,
  );
  const findOneMock = vi.fn(() => ({ lean: findOneLeanMock }));
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

    expect(findOneMock).toHaveBeenCalledWith({ phone: '+380635567090' });
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

    expect(findOneMock).toHaveBeenCalledWith({ phone: '+380635567090' });
    expect(findByIdAndUpdateMock).not.toHaveBeenCalled();
  });
});
