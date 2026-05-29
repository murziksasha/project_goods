import { beforeEach, describe, expect, it, vi } from 'vitest';

const defaultPrintForms = [
  {
    id: 'receipt',
    title: 'Receipt',
    type: 'receipt',
    content: 'Order {{orderNumber}}',
    isActive: true,
    sortOrder: 10,
  },
];

const makeSettingsDocument = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => 'settings-id' },
  serviceName: 'Service CRM',
  createdAt: new Date('2026-05-29T10:00:00.000Z'),
  updatedAt: new Date('2026-05-29T10:00:00.000Z'),
  ...overrides,
});

const setupSettingsService = async ({
  findOneResult,
  updateResult,
}: {
  findOneResult?: Record<string, unknown> | null;
  updateResult?: Record<string, unknown> | null;
} = {}) => {
  const findOneLean = vi.fn().mockResolvedValue(findOneResult ?? null);
  const findOneMock = vi.fn(() => ({ lean: findOneLean }));
  const findOneAndUpdateLean = vi
    .fn()
    .mockResolvedValue(updateResult ?? makeSettingsDocument());
  const findOneAndUpdateMock = vi.fn(() => ({
    lean: findOneAndUpdateLean,
  }));
  const validateMock = vi.fn().mockResolvedValue(undefined);
  const saveMock = vi.fn().mockResolvedValue(undefined);

  class FakeSettings {
    _id = { toString: () => 'created-id' };
    serviceName = 'Service CRM';
    createdAt = new Date('2026-05-29T10:00:00.000Z');
    updatedAt = new Date('2026-05-29T10:00:00.000Z');

    constructor(input: Record<string, unknown>) {
      Object.assign(this, input);
    }

    validate = validateMock;
    save = saveMock;

    toObject() {
      return {
        _id: this._id,
        serviceName: this.serviceName,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    }

    static findOne = findOneMock;
    static findOneAndUpdate = findOneAndUpdateMock;
  }

  vi.doMock('./model', () => ({
    Settings: FakeSettings,
    defaultPrintForms,
  }));

  const service = await import('./service');
  return {
    service,
    findOneMock,
    findOneAndUpdateMock,
    validateMock,
    saveMock,
  };
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('settings service', () => {
  it('creates default settings with default print forms when none exist', async () => {
    const { service, validateMock, saveMock } = await setupSettingsService();

    const settings = await service.getSettings();

    expect(validateMock).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalled();
    expect(settings).toMatchObject({
      id: 'created-id',
      serviceName: 'Service CRM',
      printForms: defaultPrintForms,
      orderDefaults: {
        defaultRepairTermDays: 7,
        defaultWarrantyMonths: 1,
        defaultRepairStatus: 'new',
        defaultSaleStatus: 'new',
      },
    });
  });

  it('updates and returns expanded settings', async () => {
    const updateResult = makeSettingsDocument({
      serviceName: 'Repair CRM',
      printForms: [
        {
          id: 'invoice',
          title: 'Invoice',
          type: 'invoice',
          content: 'Total {{total}}',
          isActive: true,
          sortOrder: 1,
        },
      ],
      financeDefaults: {
        currency: 'USD',
        paymentMethod: 'non-cash',
      },
    });
    const { service, findOneAndUpdateMock } = await setupSettingsService({
      updateResult,
    });

    const settings = await service.updateSettings({
      serviceName: ' Repair CRM ',
      printForms: updateResult.printForms,
      financeDefaults: updateResult.financeDefaults,
    });

    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        serviceName: 'Repair CRM',
        printForms: updateResult.printForms,
      }),
      expect.objectContaining({
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
      }),
    );
    expect(settings).toMatchObject({
      serviceName: 'Repair CRM',
      printForms: updateResult.printForms,
      financeDefaults: {
        currency: 'USD',
        paymentMethod: 'non-cash',
      },
    });
  });
});
