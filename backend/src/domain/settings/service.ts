import { Settings, defaultPrintForms, type SettingsDocument } from './model';
import { normalizeSettingsPayload } from '../../shared/lib/parsers';
import type { SettingsPayload } from '../shared/types';

const defaultOrderDefaults = {
  defaultRepairTermDays: 7,
  defaultWarrantyMonths: 1,
  defaultRepairStatus: 'new',
  defaultSaleStatus: 'new',
};

const defaultNumbering = {
  repairPrefix: 'r',
  salePrefix: 's',
  supplierOrderPrefix: 'SO',
  nextRepairNumber: 1,
  nextSaleNumber: 1,
  nextSupplierOrderNumber: 1,
};

const defaultFinanceDefaults = {
  currency: 'UAH',
  paymentMethod: 'cash' as const,
};

const defaultNotificationSettings = {
  smsEnabled: false,
  messengerEnabled: false,
  emailEnabled: false,
};

const formatSettings = (settings: SettingsDocument) => {
  const rawPrintForms = Array.isArray(settings.printForms)
    ? settings.printForms
    : [];

  return {
    id: settings._id.toString(),
    serviceName: settings.serviceName,
    printForms: rawPrintForms.length > 0 ? rawPrintForms : defaultPrintForms,
    orderDefaults: {
      ...defaultOrderDefaults,
      ...(settings.orderDefaults ?? {}),
    },
    numbering: {
      ...defaultNumbering,
      ...(settings.numbering ?? {}),
    },
    financeDefaults: {
      ...defaultFinanceDefaults,
      ...(settings.financeDefaults ?? {}),
    },
    notificationSettings: {
      ...defaultNotificationSettings,
      ...(settings.notificationSettings ?? {}),
    },
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
};

export const getSettings = async () => {
  let settings = await Settings.findOne().lean<SettingsDocument | null>();
  if (!settings) {
    const created = new Settings({ serviceName: 'Service CRM' });
    await created.validate();
    await created.save();
    settings = created.toObject<SettingsDocument>();
  }

  return formatSettings(settings);
};

export const updateSettings = async (payload: SettingsPayload) => {
  const normalized = normalizeSettingsPayload(payload);
  const settings = await Settings.findOneAndUpdate({}, normalized, {
    upsert: true,
    returnDocument: 'after',
    runValidators: true,
    setDefaultsOnInsert: true,
  }).lean<SettingsDocument | null>();

  if (!settings) {
    throw new Error('Settings not found.');
  }

  return formatSettings(settings);
};
