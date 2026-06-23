import { clientStatuses, type ClientStatus } from '../../domain/client/constants';
import {
  defaultEmployeePermissionsByRole,
  employeePermissions,
  employeeRoles,
  type EmployeePermission,
  type EmployeeRole,
} from '../../domain/employee/constants';
import type {
  ClientPayload,
  EmployeePayload,
  ProductPayload,
  SalePayload,
  SettingsPayload,
  SupplierPayload,
  WarehouseSettingsPayload,
} from '../../domain/shared/types';

export const toNonEmptyString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const toOptionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const normalizedValue = value.trim().replace(/\s+/g, '').replace(',', '.');
    if (!/^-?\d+(?:\.\d*)?$/.test(normalizedValue)) return NaN;

    return Number(normalizedValue);
  }

  return NaN;
};

const splitNumericList = (value: unknown) => {
  if (Array.isArray(value)) return value;

  const rawValue = String(value ?? '').trim();
  if (!rawValue) return [];
  if (rawValue.includes(';') || rawValue.includes('\n')) {
    return rawValue.split(/[;\n]/);
  }

  return rawValue.split(/,\s+/);
};

export const normalizePhone = (value: unknown) =>
  String(value ?? '')
    .replace(/[^\d+]/g, '')
    .trim();

export const normalizeClientPhone = (value: unknown) => {
  const normalized = normalizePhone(value);
  const digits = normalized.replace(/\D/g, '');
  if (digits.startsWith('380') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+380${digits.slice(1)}`;
  if (digits.length === 9) return `+380${digits}`;
  return normalized;
};

export const normalizeEmail = (value: unknown) => toNonEmptyString(value).toLowerCase();

export const normalizeProductPayload = (payload: ProductPayload) => ({
  name: toNonEmptyString(payload.name),
  article: toNonEmptyString(payload.article).toUpperCase(),
  serialNumber: toNonEmptyString(payload.serialNumber).toUpperCase(),
  price: toNumber(payload.price),
  salePriceOptions: Array.isArray(payload.salePriceOptions)
    ? payload.salePriceOptions
        .map((value) => toNumber(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
    : splitNumericList(payload.salePriceOptions)
        .map((value) => toNumber(String(value).trim()))
        .filter((value) => Number.isFinite(value) && value >= 0),
  quantity: toNumber(payload.quantity),
  note: toNonEmptyString(payload.note),
  reservedQuantity:
    payload.reservedQuantity === '' || payload.reservedQuantity === undefined
      ? 0
      : toNumber(payload.reservedQuantity),
  purchasePlace: toNonEmptyString(payload.purchasePlace),
  warehouseId: toNonEmptyString(payload.warehouseId),
  locationId: toNonEmptyString(payload.locationId),
  purchaseDate: toOptionalDate(payload.purchaseDate),
  warrantyPeriod:
    payload.warrantyPeriod === '' || payload.warrantyPeriod === undefined
      ? 0
      : toNumber(payload.warrantyPeriod),
});

const normalizePhonesList = (payload: { phone?: unknown; phones?: unknown }) => {
  const legacyPhone = normalizeClientPhone(payload.phone);

  let inputPhones: unknown[] = [];
  if (Array.isArray(payload.phones)) {
    inputPhones = payload.phones;
  } else if (typeof payload.phones === 'string' && payload.phones.trim()) {
    inputPhones = payload.phones.split(/[;,\n\r]+/);
  }

  const normalizedList = inputPhones
    .map(normalizeClientPhone)
    .filter((p) => p && p.length > 0);

  if (legacyPhone && !normalizedList.includes(legacyPhone)) {
    normalizedList.unshift(legacyPhone);
  }
  if (normalizedList.length === 0 && legacyPhone) {
    normalizedList.push(legacyPhone);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of normalizedList) {
    if (!seen.has(p)) {
      seen.add(p);
      unique.push(p);
    }
  }

  const phone = legacyPhone || unique[0] || '';
  const phones = phone
    ? [phone, ...unique.filter((value) => value !== phone)]
    : [];

  return { phone, phones };
};

export const normalizeClientPayload = (payload: ClientPayload) => {
  const { phone, phones } = normalizePhonesList(payload);

  return {
    phone,
    phones,
    name: toNonEmptyString(payload.name),
    email: toNonEmptyString(payload.email),
    address: toNonEmptyString(payload.address),
    registrationId: toNonEmptyString(payload.registrationId),
    iban: toNonEmptyString(payload.iban).replace(/\s+/g, '').toUpperCase(),
    note: toNonEmptyString(payload.note),
    status: (() => {
      const raw = String(payload.status ?? '');
      if (raw === '') return '';
      return clientStatuses.includes(raw as ClientStatus)
        ? (raw as ClientStatus)
        : '';
    })(),
  };
};

export const normalizeSupplierPayload = (payload: SupplierPayload) => {
  const { phone, phones } = normalizePhonesList(payload);

  return {
    phone,
    phones,
    name: toNonEmptyString(payload.name),
    note: toNonEmptyString(payload.note),
    supplierOrder: toNonEmptyString(payload.supplierOrder),
    isActive:
      payload.isActive === undefined
        ? true
        : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
  };
};

export const normalizeSalePayload = (payload: SalePayload) => ({
  saleDate: toOptionalDate(payload.saleDate) ?? new Date(),
  clientId: toNonEmptyString(payload.clientId),
  productId: toNonEmptyString(payload.productId),
  quantity: toNumber(payload.quantity),
  salePrice: toNumber(payload.salePrice),
  note: toNonEmptyString(payload.note),
  managerId: toNonEmptyString(payload.managerId),
  masterId: toNonEmptyString(payload.masterId),
  issuedById: toNonEmptyString(payload.issuedById),
  kind: toNonEmptyString(payload.kind) === 'sale' ? 'sale' : 'repair',
  status: toNonEmptyString(payload.status) || 'new',
  paidAmount:
    payload.paidAmount === undefined ? 0 : toNumber(payload.paidAmount),
  timeline: Array.isArray(payload.timeline)
    ? payload.timeline
        .map((entry) => ({
          id: toNonEmptyString((entry as { id?: unknown })?.id),
          kind:
            toNonEmptyString((entry as { kind?: unknown })?.kind) === 'manual'
              ? 'manual'
              : toNonEmptyString((entry as { kind?: unknown })?.kind) === 'system'
                ? 'system'
                : undefined,
          author: toNonEmptyString((entry as { author?: unknown })?.author),
          message: toNonEmptyString((entry as { message?: unknown })?.message),
          createdAt:
            toOptionalDate((entry as { createdAt?: unknown })?.createdAt) ?? new Date(),
        }))
        .filter((entry) => entry.id && entry.author && entry.message)
    : [],
  paymentHistory: Array.isArray(payload.paymentHistory)
    ? payload.paymentHistory
        .map((entry) => ({
          id: toNonEmptyString((entry as { id?: unknown })?.id),
          type: toNonEmptyString((entry as { type?: unknown })?.type),
          paymentMethod:
            toNonEmptyString((entry as { paymentMethod?: unknown })?.paymentMethod) === 'non-cash'
              ? 'non-cash'
              : 'cash',
          amount: toNumber((entry as { amount?: unknown })?.amount),
          cashboxId: toNonEmptyString((entry as { cashboxId?: unknown })?.cashboxId),
          cashboxName: toNonEmptyString((entry as { cashboxName?: unknown })?.cashboxName),
          author: toNonEmptyString((entry as { author?: unknown })?.author),
          createdAt:
            toOptionalDate((entry as { createdAt?: unknown })?.createdAt) ?? new Date(),
        }))
        .filter(
          (entry) =>
            entry.id &&
            (entry.type === 'deposit' || entry.type === 'refund') &&
            (entry.paymentMethod === 'cash' || entry.paymentMethod === 'non-cash') &&
            Number.isFinite(entry.amount) &&
            entry.amount >= 0 &&
            entry.cashboxId &&
            entry.cashboxName &&
            entry.author,
        )
    : [],
  lineItems: Array.isArray(payload.lineItems)
    ? payload.lineItems
        .map((item) => ({
          id: toNonEmptyString((item as { id?: unknown })?.id),
          kind: toNonEmptyString((item as { kind?: unknown })?.kind),
          productId:
            toNonEmptyString((item as { productId?: unknown })?.productId) ||
            undefined,
          catalogProductId:
            toNonEmptyString(
              (item as { catalogProductId?: unknown })?.catalogProductId,
            ) || undefined,
          serviceId:
            toNonEmptyString((item as { serviceId?: unknown })?.serviceId) ||
            undefined,
          name: toNonEmptyString((item as { name?: unknown })?.name),
          price: toNumber((item as { price?: unknown })?.price),
          quantity: toNumber((item as { quantity?: unknown })?.quantity),
          warrantyPeriod:
            (item as { warrantyPeriod?: unknown })?.warrantyPeriod === undefined
              ? 0
              : toNumber((item as { warrantyPeriod?: unknown })?.warrantyPeriod),
          serialNumbers: Array.isArray(
            (item as { serialNumbers?: unknown })?.serialNumbers,
          )
            ? Array.from(
                new Set(
                  ((item as { serialNumbers?: unknown[] }).serialNumbers ?? [])
                    .map((value) => toNonEmptyString(value).toUpperCase())
                    .filter(Boolean),
                ),
              )
            : [],
        }))
        .filter(
          (item) =>
            item.id &&
            (item.kind === 'product' || item.kind === 'service') &&
            item.name &&
            Number.isFinite(item.price) &&
            item.price >= 0 &&
            Number.isFinite(item.quantity) &&
            item.quantity > 0 &&
            Number.isFinite(item.warrantyPeriod) &&
            item.warrantyPeriod >= 0,
        )
    : [],
  discount: (() => {
    if (!payload.discount || typeof payload.discount !== 'object') {
      return { mode: 'amount' as const, value: 0 };
    }

    const modeRaw = toNonEmptyString((payload.discount as { mode?: unknown }).mode);
    const valueRaw = toNumber((payload.discount as { value?: unknown }).value);

    return {
      mode: modeRaw === 'percent' ? 'percent' : 'amount',
      value: Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0,
    };
  })(),
  deviceName: toNonEmptyString(payload.deviceName),
  serialNumber: toNonEmptyString(payload.serialNumber).toUpperCase(),
});

export const normalizeEmployeePayload = (payload: EmployeePayload) => {
  const roleRaw = String(payload.role ?? '');
  const role = employeeRoles.includes(roleRaw as EmployeeRole)
    ? (roleRaw as EmployeeRole)
    : 'manager';
  const parsedPermissions = Array.isArray(payload.permissions)
    ? payload.permissions
        .map((value) => String(value))
        .filter((value): value is EmployeePermission =>
          employeePermissions.includes(value as EmployeePermission),
        )
    : String(payload.permissions ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is EmployeePermission =>
          employeePermissions.includes(value as EmployeePermission),
        );

  const normalizedPermissions =
    parsedPermissions.length > 0
      ? Array.from(new Set(parsedPermissions))
      : defaultEmployeePermissionsByRole[role];
  const permissions =
    role === 'owner' && !normalizedPermissions.includes('employees.manage')
      ? [...normalizedPermissions, 'employees.manage']
      : normalizedPermissions;

  return {
    name: toNonEmptyString(payload.name),
    phone: normalizePhone(payload.phone),
    email: normalizeEmail(payload.email),
    username: toNonEmptyString(payload.username).toLowerCase(),
    password: toNonEmptyString(payload.password),
    role,
    permissions,
    isActive:
      payload.isActive === undefined
        ? true
        : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
    note: toNonEmptyString(payload.note),
  };
};

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

export const normalizeWarehouseSettingsPayload = (
  payload: WarehouseSettingsPayload,
) => {
  const serviceCenters = Array.isArray(payload.serviceCenters)
    ? payload.serviceCenters
        .map((item, index) => {
          const source =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {};
          const id =
            toNonEmptyString(source.id) || `sc-${Date.now()}-${index}`;
          const name = toNonEmptyString(source.name);
          if (!name) return null;
          return {
            id,
            name,
            color: toNonEmptyString(source.color) || '#000000',
            address: toNonEmptyString(source.address),
            phone: toNonEmptyString(source.phone),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  const warehouses = Array.isArray(payload.warehouses)
    ? payload.warehouses
        .map((item, index) => {
          const source =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {};
          const id =
            toNonEmptyString(source.id) || `w-${Date.now()}-${index}`;
          const name = toNonEmptyString(source.name);
          const serviceCenterId = toNonEmptyString(source.serviceCenterId);
          if (!name || !serviceCenterId) return null;
          const locations = Array.isArray(source.locations)
            ? source.locations
                .map((location, locationIndex) => {
                  const locationSource =
                    location && typeof location === 'object'
                      ? (location as Record<string, unknown>)
                      : {};
                  const locationName = toNonEmptyString(
                    locationSource.name,
                  );
                  if (!locationName) return null;
                  return {
                    id:
                      toNonEmptyString(locationSource.id) ||
                      `l-${Date.now()}-${index}-${locationIndex}`,
                    name: locationName,
                  };
                })
                .filter(
                  (location): location is NonNullable<typeof location> =>
                    Boolean(location),
                )
            : [];

          return {
            id,
            name,
            isActive:
              source.isActive === undefined
                ? true
                : source.isActive === true ||
                  String(source.isActive).toLowerCase() === 'true',
            serviceCenterId,
            receiptAddress: toNonEmptyString(source.receiptAddress),
            receiptPhone: toNonEmptyString(source.receiptPhone),
            locations,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  const administrators = Array.isArray(payload.administrators)
    ? payload.administrators
        .map((item) => {
          const source =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {};
          const employeeId = toNonEmptyString(source.employeeId);
          if (!employeeId) return null;
          const warehouseIds = Array.isArray(source.warehouseIds)
            ? source.warehouseIds.map(toNonEmptyString).filter(Boolean)
            : [];
          return {
            employeeId,
            warehouseIds,
            defaultWarehouseId: toNonEmptyString(source.defaultWarehouseId),
            defaultLocationId: toNonEmptyString(source.defaultLocationId),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return {
    serviceCenters,
    warehouses,
    administrators,
  };
};
