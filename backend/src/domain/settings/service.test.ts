import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { defaultPrintForms, Settings } from './model';
import { getSettings, updatePrintForms, updateSettings } from './service';

const defaultDate = new Date('2026-05-29T10:00:00.000Z');

const makeSettingsDocument = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => 'settings-id' },
  serviceName: 'Service CRM',
  createdAt: defaultDate,
  updatedAt: defaultDate,
  ...overrides,
});

let storedSettings: Record<string, unknown> | null = null;
const updateCalls: Array<{ update: unknown; options?: unknown }> = [];

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(Settings, 'findOne').mockImplementation(
    () => leanResult(storedSettings) as never,
  );
  vi.spyOn(Settings, 'findOneAndUpdate').mockImplementation(
    (_query: unknown, update: unknown, options?: unknown) => {
      updateCalls.push({ update, options });
      const patch =
        update && typeof update === 'object' && '$set' in (update as object)
          ? (update as { $set: Record<string, unknown> }).$set
          : update;
      storedSettings = makeSettingsDocument({
        ...(storedSettings ?? {}),
        ...(patch as Record<string, unknown>),
      });
      return leanResult(storedSettings) as never;
    },
  );
  vi.spyOn(Settings.prototype, 'validate').mockResolvedValue(undefined as never);
  vi.spyOn(Settings.prototype, 'save').mockImplementation(async function saveSettings(
    this: any,
  ) {
    storedSettings = makeSettingsDocument({
      _id: { toString: () => 'created-id' },
      serviceName: this.serviceName ?? 'Service CRM',
      createdAt: this.createdAt ?? defaultDate,
      updatedAt: this.updatedAt ?? defaultDate,
    });
    return this;
  });
  vi.spyOn(Settings.prototype, 'toObject').mockImplementation(function toObject(
    this: any,
  ) {
    return makeSettingsDocument({
      _id: { toString: () => 'created-id' },
      serviceName: this.serviceName ?? 'Service CRM',
      createdAt: this.createdAt ?? defaultDate,
      updatedAt: this.updatedAt ?? defaultDate,
    }) as never;
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  storedSettings = null;
  updateCalls.length = 0;
  installSpies();
});

describe('settings service', () => {
  it('creates default settings with default print forms when none exist', async () => {
    const settings = await getSettings();

    expect(Settings.prototype.validate).toHaveBeenCalled();
    expect(Settings.prototype.save).toHaveBeenCalled();
    expect(settings).toMatchObject({
      id: 'created-id',
      serviceName: 'Service CRM',
      company: 'Service CRM',
      companyAddress: '',
      companyId: '',
      companyIban: '',
      companyEmail: '',
      companySite: '',
      orderDefaults: {
        defaultRepairTermDays: 7,
        defaultWarrantyMonths: 1,
        defaultRepairStatus: 'new',
        defaultSaleStatus: 'new',
      },
    });
    expect(settings.printForms.map((form) => form.id)).toEqual(
      defaultPrintForms.map((form) => form.id),
    );
  });

  it('updates and returns expanded settings', async () => {
    const updateResult = makeSettingsDocument({
      serviceName: 'Repair CRM',
      company: 'Repair Company',
      companyAddress: 'Kyiv, Main street 1',
      companyId: '12345678',
      companyIban: 'UA123456789123456789123456789',
      companyEmail: 'billing@example.com',
      companySite: 'https://example.com',
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
    storedSettings = updateResult;

    const settings = await updateSettings({
      serviceName: ' Repair CRM ',
      company: ' Repair Company ',
      companyAddress: ' Kyiv, Main street 1 ',
      companyId: ' 12345678 ',
      companyIban: ' UA123456789123456789123456789 ',
      companyEmail: ' billing@example.com ',
      companySite: ' https://example.com ',
      printForms: updateResult.printForms as never,
      financeDefaults: updateResult.financeDefaults as never,
    });

    expect(Settings.findOneAndUpdate).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        serviceName: 'Repair CRM',
        company: 'Repair Company',
        companyAddress: 'Kyiv, Main street 1',
        companyId: '12345678',
        companyIban: 'UA123456789123456789123456789',
        companyEmail: 'billing@example.com',
        companySite: 'https://example.com',
        printForms: [
          expect.objectContaining({
            id: 'invoice',
            title: 'Invoice',
            contentFormat: 'text',
            pageSize: 'A4',
            orientation: 'portrait',
          }),
        ],
      }),
      expect.objectContaining({
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
      }),
    );
    expect(settings).toMatchObject({
      serviceName: 'Repair CRM',
      company: 'Repair Company',
      companyAddress: 'Kyiv, Main street 1',
      companyId: '12345678',
      companyIban: 'UA123456789123456789123456789',
      financeDefaults: {
        currency: 'USD',
        paymentMethod: 'non-cash',
      },
    });
    expect(settings.printForms.some((form) => form.id === 'invoice')).toBe(true);
    expect(settings.printForms.some((form) => form.id === 'receipt')).toBe(true);
  });

  it('returns fallback company fields for old settings documents', async () => {
    storedSettings = makeSettingsDocument({
      printForms: defaultPrintForms,
    });

    const settings = await getSettings();

    expect(settings).toMatchObject({
      company: 'Service CRM',
      companyAddress: '',
      companyId: '',
      companyIban: '',
      companyEmail: '',
      companySite: '',
    });
  });

  it('migrates recognizable standard print forms and keeps custom forms', async () => {
    const migratedPrintForms = [
      {
        id: 'receipt',
        title: 'Receipt',
        type: 'receipt',
        content: 'Order {{orderNumber}} {{products_table}} {{services_table}}',
        isActive: true,
        sortOrder: 10,
      },
      {
        id: 'custom',
        title: 'Custom',
        type: 'custom',
        content: 'Custom {{orderNumber}}',
        isActive: true,
        sortOrder: 20,
      },
    ];
    const legacyReceipt = defaultPrintForms.find((form) => form.id === 'receipt');
    storedSettings = makeSettingsDocument({
      printForms: [
        {
          ...legacyReceipt,
          content: 'Order {{orderNumber}}',
        },
        {
          id: 'custom',
          title: 'Custom',
          type: 'custom',
          content: 'Custom {{orderNumber}}',
          isActive: true,
          sortOrder: 20,
        },
      ],
    });

    const settings = await getSettings();

    const migratedReceipt = settings.printForms.find((form) => form.id === 'receipt');
    expect(migratedReceipt?.content).toContain('{{products_table}}');
    expect(migratedReceipt?.content).toContain('{{services_table}}');
    expect(settings.printForms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'custom',
          content: 'Custom {{orderNumber}}',
        }),
      ]),
    );
    expect(Settings.findOneAndUpdate).toHaveBeenCalled();
  });

  it('updates only print forms without replacing other settings fields', async () => {
    storedSettings = makeSettingsDocument({
      serviceName: 'Repair CRM',
      company: 'Repair Company',
      printForms: defaultPrintForms,
    });
    const updatedPrintForms = [
      {
        id: 'custom-form',
        title: 'Custom form',
        type: 'custom',
        content: 'Order {{orderNumber}}',
        isActive: true,
        sortOrder: 10,
      },
    ];

    const settings = await updatePrintForms(updatedPrintForms);

    expect(Settings.findOneAndUpdate).toHaveBeenCalledWith(
      {},
      {
        $set: {
          printForms: expect.arrayContaining([
            expect.objectContaining({
              id: 'custom-form',
              title: 'Custom form',
            }),
            expect.objectContaining({
              id: 'receipt',
            }),
          ]),
        },
      },
      expect.objectContaining({
        returnDocument: 'after',
        runValidators: true,
      }),
    );
    expect(settings.serviceName).toBe('Repair CRM');
    expect(settings.company).toBe('Repair Company');
    expect(settings.printForms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'custom-form',
          title: 'Custom form',
        }),
      ]),
    );
  });
});