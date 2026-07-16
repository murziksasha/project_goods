import mongoose from 'mongoose';
import { escapeRegExp } from '../../shared/lib/query';

/** Hard cap when `limit` query is provided (LAN safety). */
export const SALES_LIST_MAX_LIMIT = 5000;

export const saleKinds = ['sale', 'repair'] as const;
export type SaleKind = (typeof saleKinds)[number];

export type ListSalesOptions = {
  kind?: SaleKind;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  isFavorite?: boolean;
  isRapidSale?: boolean;
  clientId?: string;
  q?: string;
  /** When set, caps result size (newest first). Omit = no limit (legacy full list). */
  limit?: number;
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

export const parseListSalesQuery = (
  query: Record<string, unknown> = {},
): ListSalesOptions => {
  const status = String(query.status ?? '').trim();
  const q = String(query.q ?? query.query ?? '').trim();

  return {
    kind: parseKind(query.kind),
    status: status || undefined,
    dateFrom: parseDateKey(query.dateFrom),
    dateTo: parseDateKey(query.dateTo),
    isFavorite: parseOptionalBoolean(query.isFavorite),
    isRapidSale: parseOptionalBoolean(query.isRapidSale),
    clientId: parseObjectId(query.clientId),
    q: q || undefined,
    limit: parseLimit(query.limit),
  };
};

export type SalesMongoFilter = Record<string, unknown>;

export const buildSalesFilter = (options: ListSalesOptions): SalesMongoFilter => {
  const filter: SalesMongoFilter = {};

  if (options.kind) {
    filter.kind = options.kind;
  }

  if (options.status) {
    filter.status = options.status;
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

  if (options.q) {
    const pattern = escapeRegExp(options.q);
    filter.$or = [
      { recordNumber: { $regex: pattern, $options: 'i' } },
      { note: { $regex: pattern, $options: 'i' } },
      { userNote: { $regex: pattern, $options: 'i' } },
      { 'clientSnapshot.name': { $regex: pattern, $options: 'i' } },
      { 'clientSnapshot.phone': { $regex: pattern, $options: 'i' } },
      { 'productSnapshot.name': { $regex: pattern, $options: 'i' } },
      { 'productSnapshot.serialNumber': { $regex: pattern, $options: 'i' } },
      { 'productSnapshot.article': { $regex: pattern, $options: 'i' } },
    ];
  }

  return filter;
};

export const hasSalesListFilters = (options: ListSalesOptions) =>
  Boolean(
    options.kind ||
      options.status ||
      options.dateFrom ||
      options.dateTo ||
      options.isFavorite !== undefined ||
      options.isRapidSale !== undefined ||
      options.clientId ||
      options.q ||
      options.limit !== undefined,
  );
