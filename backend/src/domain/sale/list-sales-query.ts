import mongoose from 'mongoose';
import { escapeRegExp } from '../../shared/lib/query';

/** Hard cap when `limit` query is provided (LAN safety). */
export const SALES_LIST_MAX_LIMIT = 5000;

/**
 * Fields omitted from list responses when `compact=1`.
 * Full card/history loads those arrays via GET /sales/:id. Dashboard list uses compact=1.
 */
export const SALES_LIST_COMPACT_EXCLUDE =
  '-timeline -paymentHistory' as const;

export const saleKinds = ['sale', 'repair'] as const;
export type SaleKind = (typeof saleKinds)[number];

export const SALES_LIST_DEFAULT_PAGE_SIZE = 30;
export const SALES_LIST_MAX_PAGE_SIZE = 500;

export type SaleRepairTypeFilter = 'paid' | 'warranty';
export type SalePaymentMethodFilter = 'cash' | 'non-cash';

export type ListSalesOptions = {
  kind?: SaleKind;
  status?: string;
  statuses?: string[];
  excludeStatuses?: string[];
  dateFrom?: string;
  dateTo?: string;
  isFavorite?: boolean;
  isRapidSale?: boolean;
  clientId?: string;
  assigneeId?: string;
  masterId?: string;
  recordNumber?: string;
  client?: string;
  product?: string;
  service?: string;
  repairType?: SaleRepairTypeFilter;
  paymentMethod?: SalePaymentMethodFilter;
  q?: string;
  /** When set, caps result size (newest first). Omit = no limit (legacy full list). */
  limit?: number;
  page?: number;
  pageSize?: number;
  /**
   * When true, Mongo projection drops timeline + paymentHistory to shrink payload.
   * Only safe for callers that do not render those arrays from the list response.
   */
  compact?: boolean;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateKey = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return DATE_KEY_PATTERN.test(normalized) ? normalized : undefined;
};

const parseKind = (value: unknown): SaleKind | undefined => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return saleKinds.includes(normalized as SaleKind)
    ? (normalized as SaleKind)
    : undefined;
};

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return undefined;
};

const parseObjectId = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return mongoose.isValidObjectId(normalized) ? normalized : undefined;
};

const parseLimit = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(parsed, SALES_LIST_MAX_LIMIT);
};

const parsePositiveInt = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const parseStringList = (value: unknown): string[] | undefined => {
  const raw = Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
  return raw.length > 0 ? raw : undefined;
};

const parseRepairType = (value: unknown): SaleRepairTypeFilter | undefined => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'paid' || normalized === 'warranty' ? normalized : undefined;
};

const parsePaymentMethod = (
  value: unknown,
): SalePaymentMethodFilter | undefined => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'cash' || normalized === 'non-cash' ? normalized : undefined;
};

export const parseListSalesQuery = (
  query: Record<string, unknown> = {},
): ListSalesOptions => {
  const status = String(query.status ?? '').trim();
  const q = String(query.q ?? query.query ?? '').trim();
  const page = parsePositiveInt(query.page);
  const pageSize = parsePositiveInt(query.pageSize);

  return {
    kind: parseKind(query.kind),
    status: status || undefined,
    statuses: parseStringList(query.statuses),
    excludeStatuses: parseStringList(query.excludeStatuses),
    dateFrom: parseDateKey(query.dateFrom),
    dateTo: parseDateKey(query.dateTo),
    isFavorite: parseOptionalBoolean(query.isFavorite),
    isRapidSale: parseOptionalBoolean(query.isRapidSale),
    clientId: parseObjectId(query.clientId),
    assigneeId: parseObjectId(query.assigneeId),
    masterId: parseObjectId(query.masterId),
    recordNumber: String(query.recordNumber ?? '').trim() || undefined,
    client: String(query.client ?? '').trim() || undefined,
    product: String(query.product ?? '').trim() || undefined,
    service: String(query.service ?? '').trim() || undefined,
    repairType: parseRepairType(query.repairType),
    paymentMethod: parsePaymentMethod(query.paymentMethod),
    q: q || undefined,
    limit: parseLimit(query.limit),
    page,
    pageSize: page
      ? Math.min(pageSize ?? SALES_LIST_DEFAULT_PAGE_SIZE, SALES_LIST_MAX_PAGE_SIZE)
      : undefined,
    compact: parseOptionalBoolean(query.compact) === true ? true : undefined,
  };
};

export type SalesMongoFilter = Record<string, unknown>;

const textOr = (pattern: string) => [
  { recordNumber: { $regex: pattern, $options: 'i' } },
  { note: { $regex: pattern, $options: 'i' } },
  { userNote: { $regex: pattern, $options: 'i' } },
  { 'clientSnapshot.name': { $regex: pattern, $options: 'i' } },
  { 'clientSnapshot.phone': { $regex: pattern, $options: 'i' } },
  { 'clientSnapshot.phones': { $regex: pattern, $options: 'i' } },
  { 'productSnapshot.name': { $regex: pattern, $options: 'i' } },
  { 'productSnapshot.serialNumber': { $regex: pattern, $options: 'i' } },
  { 'productSnapshot.article': { $regex: pattern, $options: 'i' } },
  { 'lineItems.name': { $regex: pattern, $options: 'i' } },
];

export const buildSalesFilter = (options: ListSalesOptions): SalesMongoFilter => {
  const filter: SalesMongoFilter = {};
  const and: SalesMongoFilter[] = [];

  if (options.kind) {
    filter.kind = options.kind;
  }

  if (options.statuses && options.statuses.length > 0) {
    filter.status = { $in: options.statuses };
  } else if (options.status) {
    filter.status = options.status;
  } else if (options.excludeStatuses && options.excludeStatuses.length > 0) {
    filter.status = { $nin: options.excludeStatuses };
  }

  if (options.isFavorite !== undefined) {
    filter.isFavorite = options.isFavorite;
  }

  if (options.isRapidSale !== undefined) {
    filter.isRapidSale = options.isRapidSale;
  }

  if (options.clientId) {
    filter.client = options.clientId;
  }

  if (options.masterId) {
    filter.master = options.masterId;
  } else if (options.assigneeId) {
    and.push({
      $or: [{ master: options.assigneeId }, { manager: options.assigneeId }],
    });
  }

  if (options.dateFrom || options.dateTo) {
    const saleDate: Record<string, Date> = {};
    if (options.dateFrom) {
      saleDate.$gte = new Date(`${options.dateFrom}T00:00:00.000Z`);
    }
    if (options.dateTo) {
      saleDate.$lte = new Date(`${options.dateTo}T23:59:59.999Z`);
    }
    filter.saleDate = saleDate;
  }

  if (options.recordNumber) {
    filter.recordNumber = {
      $regex: escapeRegExp(options.recordNumber),
      $options: 'i',
    };
  }

  if (options.repairType === 'warranty') {
    filter.lineItems = {
      $elemMatch: { kind: 'service', warrantyPeriod: { $gt: 0 } },
    };
  } else if (options.repairType === 'paid') {
    filter.lineItems = {
      $not: { $elemMatch: { kind: 'service', warrantyPeriod: { $gt: 0 } } },
    };
  }

  if (options.paymentMethod) {
    filter.paymentHistory = {
      $elemMatch: { type: 'deposit', paymentMethod: options.paymentMethod },
    };
  }

  if (options.q) {
    and.push({ $or: textOr(escapeRegExp(options.q)) });
  }

  if (options.client) {
    const pattern = escapeRegExp(options.client);
    and.push({
      $or: [
        { 'clientSnapshot.name': { $regex: pattern, $options: 'i' } },
        { 'clientSnapshot.phone': { $regex: pattern, $options: 'i' } },
        { 'clientSnapshot.phones': { $regex: pattern, $options: 'i' } },
        { recordNumber: { $regex: pattern, $options: 'i' } },
      ],
    });
  }

  if (options.product) {
    const pattern = escapeRegExp(options.product);
    and.push({
      $or: [
        { 'productSnapshot.name': { $regex: pattern, $options: 'i' } },
        {
          lineItems: {
            $elemMatch: { kind: 'product', name: { $regex: pattern, $options: 'i' } },
          },
        },
      ],
    });
  }

  if (options.service) {
    const pattern = escapeRegExp(options.service);
    and.push({
      lineItems: {
        $elemMatch: { kind: 'service', name: { $regex: pattern, $options: 'i' } },
      },
    });
  }

  if (and.length === 1) {
    Object.assign(filter, and[0]);
  } else if (and.length > 1) {
    filter.$and = and;
  }

  return filter;
};

export const hasSalesListFilters = (options: ListSalesOptions) =>
  Boolean(
    options.kind ||
      options.status ||
      options.statuses?.length ||
      options.excludeStatuses?.length ||
      options.dateFrom ||
      options.dateTo ||
      options.isFavorite !== undefined ||
      options.isRapidSale !== undefined ||
      options.clientId ||
      options.assigneeId ||
      options.masterId ||
      options.recordNumber ||
      options.client ||
      options.product ||
      options.service ||
      options.repairType ||
      options.paymentMethod ||
      options.q ||
      options.limit !== undefined ||
      options.page !== undefined,
  );
