import {
  Settings,
  defaultPrintForms,
  legacyDefaultPrintFormTitles,
  type SettingsDocument,
} from './model';
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

const normalizePrintForms = (forms: SettingsDocument['printForms']) => {
  const rawPrintForms = Array.isArray(forms) ? forms : [];
  if (rawPrintForms.length === 0) return defaultPrintForms;

  const existingIds = new Set(rawPrintForms.map((form) => form.id));
  const shouldReplaceLegacyDefaults = rawPrintForms.every(
    (form) =>
      legacyDefaultPrintFormTitles.has(form.title) &&
      defaultPrintForms.some((defaultForm) => defaultForm.id === form.id),
  );

  if (shouldReplaceLegacyDefaults) {
    return defaultPrintForms;
  }

  return [
    ...rawPrintForms.map((form) => {
      const isPreviousDefaultInvoice =
        form.id === 'invoice' &&
        form.title === 'Рахунок' &&
        form.content.includes('<h1>Рахунок на оплату №{{orderNumber}}</h1>');
      const normalizedForm = isPreviousDefaultInvoice
        ? defaultPrintForms.find((defaultForm) => defaultForm.id === 'invoice') ?? form
        : form;

      return {
        ...normalizedForm,
        contentFormat: normalizedForm.contentFormat ?? 'text',
        pageSize:
          normalizedForm.pageSize ??
          (normalizedForm.type === 'barcode' ? 'label' : 'A4'),
        orientation: normalizedForm.orientation ?? 'portrait',
      };
    }),
    ...defaultPrintForms.filter((form) => !existingIds.has(form.id)),
  ].sort((first, second) => first.sortOrder - second.sortOrder);
};

const formatSettings = (settings: SettingsDocument) => {
  return {
    id: settings._id.toString(),
    serviceName: settings.serviceName,
    printForms: normalizePrintForms(settings.printForms),
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
  let wasCreated = false;
  let settings = await Settings.findOne().lean<SettingsDocument | null>();
  if (!settings) {
    const created = new Settings({ serviceName: 'Service CRM' });
    await created.validate();
    await created.save();
    settings = created.toObject<SettingsDocument>();
    wasCreated = true;
  }

  const formatted = formatSettings(settings);
  const shouldPersistMigratedPrintForms =
    JSON.stringify(settings.printForms ?? []) !==
    JSON.stringify(formatted.printForms);

  if (shouldPersistMigratedPrintForms) {
    if (wasCreated) {
      return formatted;
    }
    const updated = await Settings.findOneAndUpdate(
      {},
      { printForms: formatted.printForms },
      { returnDocument: 'after', runValidators: true },
    ).lean<SettingsDocument | null>();
    return formatSettings(updated ?? settings);
  }

  return formatted;
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
