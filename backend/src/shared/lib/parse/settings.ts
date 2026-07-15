import type { SettingsPayload } from '../../../domain/shared/types';
import { toNonEmptyString, toNumber } from './primitives';

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return fallback;
};

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampInteger = (
  value: unknown,
  fallback: number,
  min: number,
) => Math.max(min, Math.floor(toFiniteNumber(value, fallback)));

const defaultLabelSize = {
  presetId: '25x40',
  widthMm: 25,
  heightMm: 40,
};

const labelSizePresetIds = new Set([
  '25x40',
  '40x25',
  '30x20',
  '58x40',
  '58x30',
  'custom',
]);

const clampLabelSizeMm = (value: unknown, fallback: number) =>
  Math.min(Math.max(toFiniteNumber(value, fallback), 10), 120);

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const defaultLabelContentMargins = {
  topMm: 0.45,
  rightMm: 1.25,
  bottomMm: 0.45,
  leftMm: 1.25,
};

const defaultDocumentContentMargins = {
  topMm: 0,
  rightMm: 0,
  bottomMm: 0,
  leftMm: 0,
};

const clampContentMarginMm = (value: unknown, fallback: number) =>
  Math.min(Math.max(toFiniteNumber(value, fallback), 0), 60);

const normalizeContentMargins = (
  value: unknown,
  pageSize: 'A4' | 'label',
) => {
  const defaults =
    pageSize === 'label'
      ? defaultLabelContentMargins
      : defaultDocumentContentMargins;
  const source = readObject(value);

  return {
    topMm: clampContentMarginMm(source.topMm, defaults.topMm),
    rightMm: clampContentMarginMm(source.rightMm, defaults.rightMm),
    bottomMm: clampContentMarginMm(source.bottomMm, defaults.bottomMm),
    leftMm: clampContentMarginMm(source.leftMm, defaults.leftMm),
  };
};

const rateProviderIds = new Set(['nbu', 'privat', 'mono']);
const forecastViewIds = new Set(['today', 'tomorrow', 'fiveDay']);

const normalizeDashboardPreferences = (value: unknown) => {
  const source = readObject(value);
  const currencies = Array.isArray(source.currencies)
    ? source.currencies
        .map((item) => toNonEmptyString(item).toUpperCase())
        .filter(Boolean)
    : ['USD', 'EUR'];
  const rateProviders = Array.isArray(source.rateProviders)
    ? source.rateProviders
        .map((item) => toNonEmptyString(item).toLowerCase())
        .filter((item): item is 'nbu' | 'privat' | 'mono' => rateProviderIds.has(item))
    : ['nbu', 'privat'];
  const weatherProvider =
    toNonEmptyString(source.weatherProvider) === 'openweather'
      ? 'openweather'
      : 'open-meteo';
  const defaultForecastView = forecastViewIds.has(
    toNonEmptyString(source.defaultForecastView),
  )
    ? (toNonEmptyString(source.defaultForecastView) as 'today' | 'tomorrow' | 'fiveDay')
    : 'today';

  const weatherLocationIds = new Set(['chornomorsk', 'odesa']);
  const legacyWeatherLocation =
    toFiniteNumber(source.defaultWeatherLatitude, 0) === 46.4825 &&
    toFiniteNumber(source.defaultWeatherLongitude, 0) === 30.7233
      ? 'odesa'
      : 'chornomorsk';
  const defaultWeatherLocation = weatherLocationIds.has(
    toNonEmptyString(source.defaultWeatherLocation),
  )
    ? (toNonEmptyString(source.defaultWeatherLocation) as 'chornomorsk' | 'odesa')
    : legacyWeatherLocation;

  return {
    marketWeatherEnabled: toBoolean(source.marketWeatherEnabled, true),
    exchangeRatesEnabled: toBoolean(source.exchangeRatesEnabled, true),
    weatherEnabled: toBoolean(source.weatherEnabled, true),
    weatherAnimationEnabled: toBoolean(source.weatherAnimationEnabled, true),
    weatherProvider,
    openWeatherApiKey: toNonEmptyString(source.openWeatherApiKey),
    defaultWeatherLocation,
    currencies: currencies.length > 0 ? currencies : ['USD', 'EUR'],
    rateProviders: rateProviders.length > 0 ? rateProviders : ['nbu', 'privat'],
    defaultForecastView,
  };
};

export const normalizeSettingsPayload = (payload: SettingsPayload) => {
  const orderDefaults = readObject(payload.orderDefaults);
  const numbering = readObject(payload.numbering);
  const financeDefaults = readObject(payload.financeDefaults);
  const notificationSettings = readObject(payload.notificationSettings);
  const paymentMethod =
    toNonEmptyString(financeDefaults.paymentMethod) === 'non-cash'
      ? 'non-cash'
      : 'cash';

  return {
    serviceName: toNonEmptyString(payload.serviceName) || 'Service CRM',
    company: toNonEmptyString(payload.company) || 'Service CRM',
    companyAddress: toNonEmptyString(payload.companyAddress),
    companyId: toNonEmptyString(payload.companyId),
    companyIban: toNonEmptyString(payload.companyIban),
    companyEmail: toNonEmptyString(payload.companyEmail),
    companySite: toNonEmptyString(payload.companySite),
    printForms: Array.isArray(payload.printForms)
      ? payload.printForms
          .map((item, index) => {
            const source = readObject(item);
            const title = toNonEmptyString(source.title);
            const content = toNonEmptyString(source.content);
            if (!title || !content) return null;

            const pageSize =
              toNonEmptyString(source.pageSize) === 'label'
                ? 'label'
                : 'A4';
            const labelSize = readObject(source.labelSize);
            const presetId = toNonEmptyString(labelSize.presetId);
            const layoutVersion =
              Number(source.layoutVersion) === 1 ? 1 : undefined;
            const layoutBlocks = Array.isArray(source.layoutBlocks)
              ? source.layoutBlocks.filter((block) => typeof block === 'object' && block !== null)
              : undefined;

            return {
              id:
                toNonEmptyString(source.id) ||
                `form-${Date.now()}-${index}`,
              title,
              type: toNonEmptyString(source.type) || 'custom',
              content,
              contentFormat:
                toNonEmptyString(source.contentFormat) === 'html'
                  ? 'html'
                  : 'text',
              ...(layoutVersion && layoutBlocks && layoutBlocks.length > 0
                ? { layoutVersion, layoutBlocks }
                : {}),
              pageSize,
              labelSize:
                pageSize === 'label'
                  ? {
                      presetId: labelSizePresetIds.has(presetId)
                        ? presetId
                        : defaultLabelSize.presetId,
                      widthMm: clampLabelSizeMm(
                        labelSize.widthMm,
                        defaultLabelSize.widthMm,
                      ),
                      heightMm: clampLabelSizeMm(
                        labelSize.heightMm,
                        defaultLabelSize.heightMm,
                      ),
                    }
                  : undefined,
              orientation:
                toNonEmptyString(source.orientation) === 'landscape'
                  ? 'landscape'
                  : 'portrait',
              contentMargins: normalizeContentMargins(
                source.contentMargins,
                pageSize,
              ),
              isActive: toBoolean(source.isActive, true),
              sortOrder: clampInteger(source.sortOrder, (index + 1) * 10, 0),
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [],
    orderDefaults: {
      defaultRepairTermDays: clampInteger(
        orderDefaults.defaultRepairTermDays,
        7,
        0,
      ),
      defaultWarrantyMonths: clampInteger(
        orderDefaults.defaultWarrantyMonths,
        1,
        0,
      ),
      defaultRepairStatus:
        toNonEmptyString(orderDefaults.defaultRepairStatus) || 'new',
      defaultSaleStatus:
        toNonEmptyString(orderDefaults.defaultSaleStatus) || 'new',
    },
    numbering: {
      repairPrefix: toNonEmptyString(numbering.repairPrefix) || 'r',
      salePrefix: toNonEmptyString(numbering.salePrefix) || 's',
      supplierOrderPrefix:
        toNonEmptyString(numbering.supplierOrderPrefix) || 'SO',
      nextRepairNumber: clampInteger(numbering.nextRepairNumber, 1, 1),
      nextSaleNumber: clampInteger(numbering.nextSaleNumber, 1, 1),
      nextSupplierOrderNumber: clampInteger(
        numbering.nextSupplierOrderNumber,
        1,
        1,
      ),
    },
    financeDefaults: {
      currency:
        toNonEmptyString(financeDefaults.currency).toUpperCase() || 'UAH',
      paymentMethod,
    },
    notificationSettings: {
      smsEnabled: toBoolean(notificationSettings.smsEnabled),
      messengerEnabled: toBoolean(notificationSettings.messengerEnabled),
      emailEnabled: toBoolean(notificationSettings.emailEnabled),
    },
    dashboardPreferences: normalizeDashboardPreferences(payload.dashboardPreferences),
  };
};
