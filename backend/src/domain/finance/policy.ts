import mongoose from 'mongoose';
import type { EmployeeDocument } from '../employee/model';
import { HttpError } from '../../shared/lib/errors';
import {
  FinancePolicy,
  FinancePolicyAuditLog,
  financePolicyReportPeriods,
  financePolicyReportSources,
  serviceProfitModes,
  type FinancePolicyAuditLogDocument,
  type FinancePolicyDocument,
  type FinancePolicyReportPeriod,
  type FinancePolicyReportSource,
  type ServiceProfitMode,
} from './model';

export type FinancePolicyReportDefaults = {
  period: FinancePolicyReportPeriod;
  source: FinancePolicyReportSource;
  showCharts: boolean;
  showTable: boolean;
};

export type FinancePolicySnapshot = {
  serviceAuditEnabled: boolean;
  serviceProfitMode: ServiceProfitMode;
  reportDefaults: FinancePolicyReportDefaults;
};

export type FinancePolicyState = FinancePolicySnapshot & {
  version: number;
  updatedById: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
};

export type FinancePolicyHistoryItem = {
  id: string;
  previousVersion: number;
  version: number;
  changedFields: string[];
  previous: FinancePolicySnapshot;
  next: FinancePolicySnapshot;
  reason: string;
  authorId: string | null;
  authorName: string;
  changedAt: string;
};

const POLICY_KEY = 'default';

const isMockedFn = (fn: unknown) =>
  typeof fn === 'function' && 'mock' in fn;

const canRunPolicyRead = () =>
  mongoose.connection.readyState !== 0 ||
  isMockedFn(FinancePolicy.findOne);

const canRunHistoryRead = () =>
  mongoose.connection.readyState !== 0 ||
  isMockedFn(FinancePolicyAuditLog.find);

export const defaultFinancePolicySnapshot = (): FinancePolicySnapshot => ({
  serviceAuditEnabled: false,
  serviceProfitMode: 'full',
  reportDefaults: {
    period: 'last30',
    source: 'all',
    showCharts: true,
    showTable: true,
  },
});

export const defaultFinancePolicyState = (): FinancePolicyState => ({
  ...defaultFinancePolicySnapshot(),
  version: 1,
  updatedById: null,
  updatedByName: null,
  updatedAt: null,
});

export const parseServiceProfitMode = (
  value: unknown,
  fallback: ServiceProfitMode = 'full',
): ServiceProfitMode => {
  const normalized = String(value ?? '').trim();
  return serviceProfitModes.includes(normalized as ServiceProfitMode)
    ? (normalized as ServiceProfitMode)
    : fallback;
};

const parseStrictServiceProfitMode = (value: unknown): ServiceProfitMode => {
  const normalized = String(value ?? '').trim();
  if (!serviceProfitModes.includes(normalized as ServiceProfitMode)) {
    throw new HttpError(
      400,
      'serviceProfitMode must be "full", "revenue_only", or "exclude".',
    );
  }
  return normalized as ServiceProfitMode;
};

const parseStrictReportPeriod = (value: unknown): FinancePolicyReportPeriod => {
  const normalized = String(value ?? '').trim();
  if (
    !financePolicyReportPeriods.includes(
      normalized as FinancePolicyReportPeriod,
    )
  ) {
    throw new HttpError(
      400,
      'reportDefaults.period must be one of: last30, whole, day, week, month, year.',
    );
  }
  return normalized as FinancePolicyReportPeriod;
};

const parseStrictReportSource = (value: unknown): FinancePolicyReportSource => {
  const normalized = String(value ?? '').trim();
  if (
    !financePolicyReportSources.includes(
      normalized as FinancePolicyReportSource,
    )
  ) {
    throw new HttpError(
      400,
      'reportDefaults.source must be "all", "sales", or "services".',
    );
  }
  return normalized as FinancePolicyReportSource;
};

const parseStrictBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new HttpError(400, `${label} must be a boolean.`);
  }
  return value;
};

const normalizeReportDefaults = (
  raw?: Partial<FinancePolicyReportDefaults> | null,
): FinancePolicyReportDefaults => {
  const fallback = defaultFinancePolicySnapshot().reportDefaults;
  const period = financePolicyReportPeriods.includes(
    raw?.period as FinancePolicyReportPeriod,
  )
    ? (raw?.period as FinancePolicyReportPeriod)
    : fallback.period;
  const source = financePolicyReportSources.includes(
    raw?.source as FinancePolicyReportSource,
  )
    ? (raw?.source as FinancePolicyReportSource)
    : fallback.source;
  return {
    period,
    source,
    showCharts:
      typeof raw?.showCharts === 'boolean' ? raw.showCharts : fallback.showCharts,
    showTable:
      typeof raw?.showTable === 'boolean' ? raw.showTable : fallback.showTable,
  };
};

export const formatFinancePolicy = (
  doc: Partial<FinancePolicyDocument> | null | undefined,
): FinancePolicyState => {
  if (!doc) return defaultFinancePolicyState();
  const defaults = normalizeReportDefaults(
    doc.reportDefaults as Partial<FinancePolicyReportDefaults> | undefined,
  );
  return {
    serviceAuditEnabled: Boolean(doc.serviceAuditEnabled),
    serviceProfitMode: parseServiceProfitMode(doc.serviceProfitMode, 'full'),
    reportDefaults: defaults,
    version:
      typeof doc.version === 'number' && Number.isFinite(doc.version) && doc.version >= 1
        ? Math.floor(doc.version)
        : 1,
    updatedById: doc.updatedById ? String(doc.updatedById) : null,
    updatedByName: doc.updatedByName ? String(doc.updatedByName) : null,
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : doc.updatedAt
          ? String(doc.updatedAt)
          : null,
  };
};

const toSnapshot = (state: FinancePolicySnapshot): FinancePolicySnapshot => ({
  serviceAuditEnabled: state.serviceAuditEnabled,
  serviceProfitMode: state.serviceProfitMode,
  reportDefaults: {
    period: state.reportDefaults.period,
    source: state.reportDefaults.source,
    showCharts: state.reportDefaults.showCharts,
    showTable: state.reportDefaults.showTable,
  },
});

const diffPolicySnapshots = (
  previous: FinancePolicySnapshot,
  next: FinancePolicySnapshot,
): string[] => {
  const changed: string[] = [];
  if (previous.serviceAuditEnabled !== next.serviceAuditEnabled) {
    changed.push('serviceAuditEnabled');
  }
  if (previous.serviceProfitMode !== next.serviceProfitMode) {
    changed.push('serviceProfitMode');
  }
  if (previous.reportDefaults.period !== next.reportDefaults.period) {
    changed.push('reportDefaults.period');
  }
  if (previous.reportDefaults.source !== next.reportDefaults.source) {
    changed.push('reportDefaults.source');
  }
  if (previous.reportDefaults.showCharts !== next.reportDefaults.showCharts) {
    changed.push('reportDefaults.showCharts');
  }
  if (previous.reportDefaults.showTable !== next.reportDefaults.showTable) {
    changed.push('reportDefaults.showTable');
  }
  return changed;
};

export const ensureFinancePolicy = async (): Promise<FinancePolicyState> => {
  if (!canRunPolicyRead()) {
    return defaultFinancePolicyState();
  }

  const existingQuery = FinancePolicy.findOne({ key: POLICY_KEY });
  const existing =
    existingQuery && typeof existingQuery.lean === 'function'
      ? await existingQuery.lean<FinancePolicyDocument | null>()
      : ((await existingQuery) as FinancePolicyDocument | null);

  if (existing) {
    return formatFinancePolicy(existing);
  }

  if (
    mongoose.connection.readyState === 0 &&
    !isMockedFn(FinancePolicy.findOneAndUpdate)
  ) {
    return defaultFinancePolicyState();
  }

  const defaults = defaultFinancePolicySnapshot();
  const created = await FinancePolicy.findOneAndUpdate(
    { key: POLICY_KEY },
    {
      $setOnInsert: {
        key: POLICY_KEY,
        serviceAuditEnabled: defaults.serviceAuditEnabled,
        serviceProfitMode: defaults.serviceProfitMode,
        reportDefaults: defaults.reportDefaults,
        version: 1,
        updatedById: null,
        updatedByName: null,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    },
  ).lean<FinancePolicyDocument | null>();

  return formatFinancePolicy(created);
};

export const getFinancePolicy = async (): Promise<FinancePolicyState> =>
  ensureFinancePolicy();

export const updateFinancePolicy = async (
  payload: {
    version?: unknown;
    serviceAuditEnabled?: unknown;
    serviceProfitMode?: unknown;
    reportDefaults?: unknown;
    reason?: unknown;
  },
  actor?: Pick<EmployeeDocument, '_id' | 'name'> | null,
): Promise<FinancePolicyState> => {
  const rawVersion = payload.version;
  const parsedVersion =
    typeof rawVersion === 'number' ? rawVersion : Number(rawVersion);
  if (
    !Number.isInteger(parsedVersion) ||
    parsedVersion < 1
  ) {
    throw new HttpError(400, 'Policy version must be a positive integer.');
  }
  const expectedVersion = parsedVersion;

  const current = await ensureFinancePolicy();
  if (current.version !== expectedVersion) {
    throw new HttpError(
      409,
      'Finance policy was modified by another user. Reload the latest policy before saving.',
    );
  }

  const nextServiceAuditEnabled =
    payload.serviceAuditEnabled !== undefined
      ? parseStrictBoolean(payload.serviceAuditEnabled, 'serviceAuditEnabled')
      : current.serviceAuditEnabled;

  const nextServiceProfitMode =
    payload.serviceProfitMode !== undefined
      ? parseStrictServiceProfitMode(payload.serviceProfitMode)
      : current.serviceProfitMode;

  let nextReportDefaults: FinancePolicyReportDefaults = {
    ...current.reportDefaults,
  };
  if (payload.reportDefaults !== undefined) {
    if (
      typeof payload.reportDefaults !== 'object' ||
      payload.reportDefaults === null ||
      Array.isArray(payload.reportDefaults)
    ) {
      throw new HttpError(400, 'reportDefaults must be an object.');
    }
    const rawDefaults = payload.reportDefaults as Record<string, unknown>;
    nextReportDefaults = {
      period:
        rawDefaults.period !== undefined
          ? parseStrictReportPeriod(rawDefaults.period)
          : current.reportDefaults.period,
      source:
        rawDefaults.source !== undefined
          ? parseStrictReportSource(rawDefaults.source)
          : current.reportDefaults.source,
      showCharts:
        rawDefaults.showCharts !== undefined
          ? parseStrictBoolean(rawDefaults.showCharts, 'reportDefaults.showCharts')
          : current.reportDefaults.showCharts,
      showTable:
        rawDefaults.showTable !== undefined
          ? parseStrictBoolean(rawDefaults.showTable, 'reportDefaults.showTable')
          : current.reportDefaults.showTable,
    };
  }

  if (
    nextServiceProfitMode === 'exclude' &&
    nextReportDefaults.source === 'services'
  ) {
    throw new HttpError(
      400,
      'Default report source cannot be "services" while services are excluded from profitability.',
    );
  }

  const reason = String(payload.reason ?? '').trim();
  if (reason.length > 300) {
    throw new HttpError(
      400,
      'Policy change reason must contain no more than 300 characters.',
    );
  }

  const previousSnapshot = toSnapshot(current);
  const nextSnapshot = toSnapshot({
    serviceAuditEnabled: nextServiceAuditEnabled,
    serviceProfitMode: nextServiceProfitMode,
    reportDefaults: nextReportDefaults,
  });

  const changedFields = diffPolicySnapshots(previousSnapshot, nextSnapshot);
  if (changedFields.length === 0) {
    return current;
  }

  const actorId = actor?._id ? actor._id.toString() : null;
  const actorName = String(actor?.name ?? '').trim() || 'Employee';

  const updated = await FinancePolicy.findOneAndUpdate(
    { key: POLICY_KEY, version: expectedVersion },
    {
      $set: {
        serviceAuditEnabled: nextSnapshot.serviceAuditEnabled,
        serviceProfitMode: nextSnapshot.serviceProfitMode,
        reportDefaults: nextSnapshot.reportDefaults,
        updatedById: actorId,
        updatedByName: actorName,
      },
      $inc: { version: 1 },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean<FinancePolicyDocument | null>();

  if (!updated) {
    throw new HttpError(
      409,
      'Finance policy was modified by another user. Reload the latest policy before saving.',
    );
  }

  const formattedUpdated = formatFinancePolicy(updated);

  await FinancePolicyAuditLog.create({
    policyKey: POLICY_KEY,
    previousVersion: expectedVersion,
    version: formattedUpdated.version,
    changedFields,
    previous: previousSnapshot,
    next: nextSnapshot,
    reason,
    authorId: actorId,
    authorName: actorName,
    changedAt: new Date(),
  });

  return formattedUpdated;
};

const formatPolicyHistoryItem = (
  doc: FinancePolicyAuditLogDocument,
): FinancePolicyHistoryItem => ({
  id: doc._id.toString(),
  previousVersion: doc.previousVersion,
  version: doc.version,
  changedFields: Array.isArray(doc.changedFields)
    ? doc.changedFields.map(String)
    : [],
  previous: toSnapshot({
    serviceAuditEnabled: Boolean(doc.previous?.serviceAuditEnabled),
    serviceProfitMode: parseServiceProfitMode(doc.previous?.serviceProfitMode),
    reportDefaults: normalizeReportDefaults(doc.previous?.reportDefaults),
  }),
  next: toSnapshot({
    serviceAuditEnabled: Boolean(doc.next?.serviceAuditEnabled),
    serviceProfitMode: parseServiceProfitMode(doc.next?.serviceProfitMode),
    reportDefaults: normalizeReportDefaults(doc.next?.reportDefaults),
  }),
  reason: String(doc.reason ?? ''),
  authorId: doc.authorId ? String(doc.authorId) : null,
  authorName: String(doc.authorName ?? 'Employee'),
  changedAt:
    doc.changedAt instanceof Date
      ? doc.changedAt.toISOString()
      : String(doc.changedAt ?? ''),
});

export const listFinancePolicyHistory = async (query: {
  page?: unknown;
  pageSize?: unknown;
} = {}) => {
  const page = Math.max(1, Math.min(Number(query.page) || 1, 10000));
  const pageSize = Math.max(1, Math.min(Number(query.pageSize) || 20, 100));

  if (!canRunHistoryRead()) {
    return { items: [], total: 0, page, pageSize };
  }

  const skip = (page - 1) * pageSize;
  const [docs, total] = await Promise.all([
    FinancePolicyAuditLog.find({ policyKey: POLICY_KEY })
      .sort({ changedAt: -1, version: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean<FinancePolicyAuditLogDocument[]>(),
    FinancePolicyAuditLog.countDocuments({ policyKey: POLICY_KEY }),
  ]);

  return {
    items: docs.map(formatPolicyHistoryItem),
    total,
    page,
    pageSize,
  };
};
