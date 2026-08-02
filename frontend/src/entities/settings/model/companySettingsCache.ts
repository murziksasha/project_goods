export const companySettingsStorageKey = 'project-goods.company-settings';
/** @deprecated kept for migration from earlier service-name-only cache */
export const serviceNameStorageKey = 'project-goods.service-name';

export type CachedCompanySettings = {
  serviceName: string;
  company: string;
  companyAddress: string;
  companyId: string;
  companyIban: string;
  companyEmail: string;
  companySite: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeCachedCompanySettings = (
  value: unknown,
): CachedCompanySettings | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isNonEmptyString(record.serviceName) && !isNonEmptyString(record.company)) {
    return null;
  }

  return {
    serviceName: isNonEmptyString(record.serviceName) ? record.serviceName.trim() : '',
    company: isNonEmptyString(record.company) ? record.company.trim() : '',
    companyAddress: isNonEmptyString(record.companyAddress)
      ? record.companyAddress.trim()
      : '',
    companyId: isNonEmptyString(record.companyId) ? record.companyId.trim() : '',
    companyIban: isNonEmptyString(record.companyIban) ? record.companyIban.trim() : '',
    companyEmail: isNonEmptyString(record.companyEmail) ? record.companyEmail.trim() : '',
    companySite: isNonEmptyString(record.companySite) ? record.companySite.trim() : '',
  };
};

export const readCachedCompanySettings = (): CachedCompanySettings | null => {
  try {
    const raw = window.localStorage.getItem(companySettingsStorageKey);
    if (raw) {
      try {
        const parsed = normalizeCachedCompanySettings(JSON.parse(raw));
        if (parsed) return parsed;
      } catch {
        // fall through to legacy key
      }
    }

    const legacyName = window.localStorage.getItem(serviceNameStorageKey)?.trim() ?? '';
    if (!legacyName) return null;
    return {
      serviceName: legacyName,
      company: '',
      companyAddress: '',
      companyId: '',
      companyIban: '',
      companyEmail: '',
      companySite: '',
    };
  } catch {
    return null;
  }
};

export const readCachedServiceName = (): string | null => {
  const cached = readCachedCompanySettings();
  const name = cached?.serviceName?.trim() ?? '';
  return name.length > 0 ? name : null;
};

export const writeCachedCompanySettings = (
  settings: Pick<
    CachedCompanySettings,
    | 'serviceName'
    | 'company'
    | 'companyAddress'
    | 'companyId'
    | 'companyIban'
    | 'companyEmail'
    | 'companySite'
  >,
) => {
  try {
    const payload: CachedCompanySettings = {
      serviceName: settings.serviceName.trim(),
      company: settings.company.trim(),
      companyAddress: settings.companyAddress.trim(),
      companyId: settings.companyId.trim(),
      companyIban: settings.companyIban.trim(),
      companyEmail: settings.companyEmail.trim(),
      companySite: settings.companySite.trim(),
    };

    if (!payload.serviceName && !payload.company) {
      window.localStorage.removeItem(companySettingsStorageKey);
      window.localStorage.removeItem(serviceNameStorageKey);
      return;
    }

    window.localStorage.setItem(companySettingsStorageKey, JSON.stringify(payload));
    if (payload.serviceName) {
      window.localStorage.setItem(serviceNameStorageKey, payload.serviceName);
    } else {
      window.localStorage.removeItem(serviceNameStorageKey);
    }
  } catch {
    // ignore quota / private mode
  }
};

export const writeCachedServiceName = (serviceName: string) => {
  const existing = readCachedCompanySettings();
  writeCachedCompanySettings({
    serviceName,
    company: existing?.company ?? '',
    companyAddress: existing?.companyAddress ?? '',
    companyId: existing?.companyId ?? '',
    companyIban: existing?.companyIban ?? '',
    companyEmail: existing?.companyEmail ?? '',
    companySite: existing?.companySite ?? '',
  });
};
